/**
 * Art of the Question — internal LangGraph (not exposed in UI).
 * Transcript → ranked questions + analyses + optional content assets.
 */

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { openAiLangChainConfiguration, resolveOpenAiApiKey } from "@/lib/openai-client-shared";
import { QUESTION_TYPE_TAXONOMY } from "./taxonomy";
import type { ContentAsset, Question, QuestionAnalysis, QuestionTypeId } from "./types";

function extractBalancedJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function extractJsonObject(raw: string): string {
  const s = raw.trim();
  const fenced = /```(?:json)?\s*\n?([\s\S]*?)\n?```/im.exec(s);
  if (fenced?.[1]) {
    const inner = fenced[1].trim();
    return extractBalancedJsonObject(inner) ?? inner;
  }
  return extractBalancedJsonObject(s) ?? s;
}

const TaxonomyPromptBlock = QUESTION_TYPE_TAXONOMY.map(
  (t) => `- ${t.typeId}: ${t.name} — ${t.definition.slice(0, 120)}…`
).join("\n");

const AnalyzeAnnotation = Annotation.Root({
  transcript: Annotation<string>({ reducer: (_p, n) => n, default: () => "" }),
  title: Annotation<string>({ reducer: (_p, n) => n, default: () => "" }),
  context: Annotation<string>({ reducer: (_p, n) => n, default: () => "" }),
  rawJson: Annotation<string>({ reducer: (_p, n) => n, default: () => "" }),
  error: Annotation<string>({ reducer: (_p, n) => n, default: () => "" }),
});

async function nodeAnalyzeTranscript(state: typeof AnalyzeAnnotation.State): Promise<Partial<typeof AnalyzeAnnotation.State>> {
  const key = resolveOpenAiApiKey();
  if (!key) return { error: "no_openai" };

  const { ChatOpenAI } = await import("@langchain/openai");
  const { HumanMessage } = await import("@langchain/core/messages");
  const openAiCfg = openAiLangChainConfiguration();

  const prompt = `You are the analysis engine for "Art of the Question" — find high-signal QUESTIONS from an interview transcript.
Do not summarize the whole interview. Identify interviewer questions that unlock real answers.

Taxonomy (use typeId exactly from this list):
${TaxonomyPromptBlock}

Transcript:
${state.transcript.slice(0, 24000)}

Optional context:
${state.context?.trim() || "(none)"}

Return ONLY valid JSON:
{
  "questions": [
    {
      "text": "exact question text",
      "timestampStartSec": null or number,
      "speaker": "Interviewer name or Interviewer",
      "score": 0-100,
      "questionTypeId": "one of the typeId values above",
      "whyItWorked": "2-4 sentences: mechanism, what it unlocked vs weak questions",
      "outcome": "how the guest responded / what changed",
      "rewrite": "one stronger version",
      "alternativePhrasings": ["...", "..."],
      "executionSignal": "how an aspiring interviewer uses this pattern",
      "whenToUse": "short",
      "whatToAvoid": "short",
      "responseDepth": "shallow|medium|deep",
      "caption": "social caption: hook + insight, max 400 chars",
      "voiceoverScript": "short script: hook, setup, why it works, takeaway",
      "titleVariations": ["...", "...", "..."]
    }
  ]
}

Rules:
- Return 3–8 questions max, ranked by score descending.
- Remove filler questions; prioritize moments with clear emotional or intellectual unlock.
- If transcript lacks clear questions, return best-effort interrogative moments.`;

  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.2,
    apiKey: key,
    ...(openAiCfg ? { configuration: openAiCfg } : {}),
  });
  const msg = await llm.invoke([new HumanMessage(prompt)]);
  const content = msg.content;
  const text =
    typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => ("text" in c ? c.text : "")).join("") : "";
  return { rawJson: text };
}

const analyzeWorkflow = new StateGraph(AnalyzeAnnotation)
  .addNode("analyze", nodeAnalyzeTranscript)
  .addEdge(START, "analyze")
  .addEdge("analyze", END);

let analyzeCompiled: ReturnType<typeof analyzeWorkflow.compile> | null = null;

function getAnalyzeGraph() {
  if (!analyzeCompiled) analyzeCompiled = analyzeWorkflow.compile();
  return analyzeCompiled;
}

const VALID_TYPES = new Set<string>(QUESTION_TYPE_TAXONOMY.map((t) => t.typeId));

export type ParsedAnalyzeResult = {
  questions: Question[];
  analyses: QuestionAnalysis[];
  assets: ContentAsset[];
};

export async function runInterviewAnalysisPipeline(params: {
  transcript: string;
  title: string;
  context?: string;
}): Promise<ParsedAnalyzeResult | null> {
  if (!resolveOpenAiApiKey()) return null;
  try {
    const app = getAnalyzeGraph();
    const out = await app.invoke({
      transcript: params.transcript,
      title: params.title,
      context: params.context ?? "",
      rawJson: "",
      error: "",
    });
    if (out.error === "no_openai" || !out.rawJson?.trim()) return null;

    const jsonStr = extractJsonObject(out.rawJson);
    const parsed = JSON.parse(jsonStr) as {
      questions?: Array<{
        text?: string;
        timestampStartSec?: number | null;
        speaker?: string;
        score?: number;
        questionTypeId?: string;
        whyItWorked?: string;
        outcome?: string;
        rewrite?: string;
        alternativePhrasings?: string[];
        executionSignal?: string;
        whenToUse?: string;
        whatToAvoid?: string;
        responseDepth?: string;
        caption?: string;
        voiceoverScript?: string;
        titleVariations?: string[];
      }>;
    };

    const rawList = parsed.questions ?? [];
    const questions: Question[] = [];
    const analyses: QuestionAnalysis[] = [];
    const assets: ContentAsset[] = [];

    let order = 0;
    for (const row of rawList.slice(0, 12)) {
      const text = String(row.text ?? "").trim();
      if (!text) continue;
      const qid = `q_${Date.now()}_${order}`;
      const typeId = (VALID_TYPES.has(String(row.questionTypeId))
        ? row.questionTypeId
        : "other") as QuestionTypeId;

      questions.push({
        questionId: qid,
        interviewId: "",
        text,
        timestampStartSec: typeof row.timestampStartSec === "number" ? row.timestampStartSec : undefined,
        speaker: row.speaker?.trim() || "Interviewer",
        score: Math.min(100, Math.max(0, typeof row.score === "number" ? row.score : 50)),
        questionTypeId: typeId,
        sortOrder: order,
      });

      analyses.push({
        analysisId: `a_${qid}`,
        questionId: qid,
        interviewId: "",
        type: typeId,
        whyItWorked: String(row.whyItWorked ?? "").slice(0, 4000),
        outcome: String(row.outcome ?? "").slice(0, 4000),
        rewrite: String(row.rewrite ?? "").slice(0, 2000),
        alternativePhrasings: Array.isArray(row.alternativePhrasings)
          ? row.alternativePhrasings.map(String).slice(0, 5)
          : [],
        executionSignal: String(row.executionSignal ?? "").slice(0, 2000),
        whenToUse: String(row.whenToUse ?? "").slice(0, 1000),
        whatToAvoid: String(row.whatToAvoid ?? "").slice(0, 1000),
        responseDepth:
          row.responseDepth === "shallow" || row.responseDepth === "deep" || row.responseDepth === "medium"
            ? row.responseDepth
            : "medium",
      });

      assets.push({
        assetId: `asset_${qid}`,
        interviewId: "",
        questionId: qid,
        clipStartSec: typeof row.timestampStartSec === "number" ? row.timestampStartSec : undefined,
        caption: String(row.caption ?? "").slice(0, 800),
        voiceoverScript: String(row.voiceoverScript ?? "").slice(0, 3000),
        titleVariations: Array.isArray(row.titleVariations) ? row.titleVariations.map(String).slice(0, 5) : [],
        format: "why_worked",
        createdAt: new Date().toISOString(),
      });

      order++;
    }

    if (questions.length === 0) return null;
    return { questions, analyses, assets };
  } catch (e) {
    console.error("[aotq/analyze-graph]", e);
    return null;
  }
}

// --- Follow-up (question breakdown coach) ---

const FuAnnotation = Annotation.Root({
  questionText: Annotation<string>({ reducer: (_p, n) => n, default: () => "" }),
  analysisSummary: Annotation<string>({ reducer: (_p, n) => n, default: () => "" }),
  userPrompt: Annotation<string>({ reducer: (_p, n) => n, default: () => "" }),
  route: Annotation<"simplified" | "standard" | "rewrite" | "bad">({ reducer: (_p, n) => n, default: () => "standard" }),
  answer: Annotation<string>({ reducer: (_p, n) => n, default: () => "" }),
});

function classifyFu(q: string): "simplified" | "standard" | "rewrite" | "bad" {
  const s = q.toLowerCase();
  if (/\b(simpler|eli5|confus|don't understand)\b/.test(s)) return "simplified";
  if (/\b(rewrite|my context|my interview)\b/.test(s)) return "rewrite";
  if (/\b(bad|weak|terrible|worst)\b/.test(s)) return "bad";
  return "standard";
}

async function fuClassify(state: typeof FuAnnotation.State): Promise<Partial<typeof FuAnnotation.State>> {
  return { route: classifyFu(state.userPrompt) };
}

function fuRoute(state: typeof FuAnnotation.State): string {
  return state.route;
}

async function fuRespond(state: typeof FuAnnotation.State, mode: string): Promise<Partial<typeof FuAnnotation.State>> {
  const key = resolveOpenAiApiKey();
  if (!key) return {};
  const { ChatOpenAI } = await import("@langchain/openai");
  const { HumanMessage } = await import("@langchain/core/messages");
  const openAiCfg = openAiLangChainConfiguration();

  const hints: Record<string, string> = {
    simplified: "Very short sentences. One analogy max. Under 220 words.",
    standard: "Structured, sharp, under 400 words. No graph/agent jargon.",
    rewrite: "Focus on rewriting for THEIR context; ask clarifying dimensions only if essential.",
    bad: "Contrast a weak question vs strong; be concrete.",
  };

  const prompt = `You are a master interviewer coach (Art of the Question). Never mention systems, graphs, or AI.

Question analyzed:
${state.questionText.slice(0, 2000)}

Analysis context:
${state.analysisSummary.slice(0, 4000)}

User message:
${state.userPrompt.trim()}

Mode: ${mode}
${hints[mode] ?? hints.standard}

Reply only with coaching text the user reads — no JSON, no bullet labels like "Mode:".`;

  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: mode === "simplified" ? 0.15 : 0.35,
    apiKey: key,
    ...(openAiCfg ? { configuration: openAiCfg } : {}),
  });
  const msg = await llm.invoke([new HumanMessage(prompt)]);
  const content = msg.content;
  const text =
    typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => ("text" in c ? c.text : "")).join("") : "";
  return { answer: text.trim().slice(0, 6000) };
}

async function fuSimplified(s: typeof FuAnnotation.State) {
  return fuRespond(s, "simplified");
}
async function fuStandard(s: typeof FuAnnotation.State) {
  return fuRespond(s, "standard");
}
async function fuRewrite(s: typeof FuAnnotation.State) {
  return fuRespond(s, "rewrite");
}
async function fuBad(s: typeof FuAnnotation.State) {
  return fuRespond(s, "bad");
}

const fuWorkflow = new StateGraph(FuAnnotation)
  .addNode("classify", fuClassify)
  .addNode("simplified", fuSimplified)
  .addNode("standard", fuStandard)
  .addNode("rewrite", fuRewrite)
  .addNode("bad", fuBad)
  .addEdge(START, "classify")
  .addConditionalEdges("classify", fuRoute, {
    simplified: "simplified",
    standard: "standard",
    rewrite: "rewrite",
    bad: "bad",
  })
  .addEdge("simplified", END)
  .addEdge("standard", END)
  .addEdge("rewrite", END)
  .addEdge("bad", END);

let fuCompiled: ReturnType<typeof fuWorkflow.compile> | null = null;

function getFuGraph() {
  if (!fuCompiled) fuCompiled = fuWorkflow.compile();
  return fuCompiled;
}

export async function runAotqFollowUpOrchestration(params: {
  questionText: string;
  analysisSummary: string;
  userPrompt: string;
}): Promise<string | null> {
  if (!resolveOpenAiApiKey()) return null;
  try {
    const app = getFuGraph();
    const out = await app.invoke({
      questionText: params.questionText,
      analysisSummary: params.analysisSummary,
      userPrompt: params.userPrompt,
      route: "standard",
      answer: "",
    });
    return out.answer?.trim() || null;
  } catch (e) {
    console.error("[aotq/followup-graph]", e);
    return null;
  }
}
