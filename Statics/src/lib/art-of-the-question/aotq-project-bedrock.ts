import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import type { AotqChannelPlaylistMeta } from "@/lib/art-of-the-question/aotq-youtube";
import { config } from "@/lib/config";

const DEFAULT_MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

/** Max characters of combined corpus sent to Bedrock (full transcripts can be large). Override with AOTQ_BEDROCK_CORPUS_MAX_CHARS. */
function corpusCharLimit(): number {
  const n = Number(process.env.AOTQ_BEDROCK_CORPUS_MAX_CHARS ?? "350000");
  return Number.isFinite(n) && n > 10_000 ? Math.min(n, 900_000) : 350_000;
}

/**
 * Max tokens for the model reply. Default was 4096 and long answers (code, outlines) were cut off at max_tokens.
 * Override with AOTQ_BEDROCK_MAX_OUTPUT_TOKENS (cap 64000).
 */
function maxOutputTokens(): number {
  const n = Number(process.env.AOTQ_BEDROCK_MAX_OUTPUT_TOKENS ?? "16384");
  if (!Number.isFinite(n) || n < 512) return 16_384;
  return Math.min(Math.floor(n), 64_000);
}

function client(): BedrockRuntimeClient {
  const region = config.dynamo.region;
  const requestHandler = new NodeHttpHandler({
    /** Long answers + large corpus can exceed 2m; override with AOTQ_BEDROCK_TIMEOUT_MS. */
    requestTimeout: Number(process.env.AOTQ_BEDROCK_TIMEOUT_MS ?? "300000"),
    connectionTimeout: 30000,
  });
  return new BedrockRuntimeClient({
    region,
    requestHandler,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
}

function modelId(): string {
  return process.env.AOTQ_BEDROCK_MODEL_ID?.trim() || process.env.GRANT_AGENT_MODEL_ID?.trim() || DEFAULT_MODEL;
}

function priorTurnsCharBudget(): number {
  const n = Number(process.env.AOTQ_BEDROCK_PRIOR_CONTEXT_MAX_CHARS ?? "80000");
  return Number.isFinite(n) && n > 2000 ? Math.min(Math.floor(n), 250_000) : 80_000;
}

function priorTurnsMaxCount(): number {
  const n = Number(process.env.AOTQ_BEDROCK_PRIOR_TURNS_MAX ?? "8");
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 24) : 8;
}

const PRIOR_PROMPT_MAX = 4000;
const PRIOR_ANSWER_MAX = 14_000;

export type AotqAskPriorTurn = { prompt: string; answer: string };

/**
 * Shapes prior Ask turns for Bedrock: oldest-first, capped count and per-field length, total char budget.
 */
export function trimPriorTurnsForBedrock(turnsOldestFirst: AotqAskPriorTurn[]): AotqAskPriorTurn[] {
  const maxN = priorTurnsMaxCount();
  if (maxN === 0 || turnsOldestFirst.length === 0) return [];
  const slice = turnsOldestFirst.slice(-maxN);
  const budget = priorTurnsCharBudget();
  let used = 0;
  const reversed = [...slice].reverse();
  const packed: AotqAskPriorTurn[] = [];
  for (const t of reversed) {
    const p = (t.prompt || "").slice(0, PRIOR_PROMPT_MAX);
    const a = (t.answer || "").slice(0, PRIOR_ANSWER_MAX);
    const block = p.length + a.length + 80;
    if (used + block > budget) break;
    packed.push({ prompt: p, answer: a });
    used += block;
  }
  return packed.reverse();
}

export async function runProjectQuestionAnswer(params: {
  projectName: string;
  corpus: string;
  userQuestion: string;
  /** Prior Ask turns on this project (oldest first). Used for follow-ups; corpus remains source of truth for video facts. */
  priorTurns?: AotqAskPriorTurn[];
}): Promise<string> {
  const priors = trimPriorTurnsForBedrock(params.priorTurns ?? []);
  const system = [
    "You answer questions about the project using the provided video transcript corpus as the source of truth for anything stated about the videos.",
    "Cite sources as [Video title or Video ID @ mm:ss–mm:ss] when possible.",
    "If the corpus does not contain the answer, say so briefly and suggest what to add or ingest.",
    priors.length > 0
      ? "Prior Q&A in this session may appear below for follow-up continuity (definitions, what was already summarized). Treat prior assistant text as non-authoritative for video facts unless it matches the corpus; prefer the corpus when they conflict."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cap = corpusCharLimit();
  const corpus = params.corpus.length > cap ? `${params.corpus.slice(0, cap)}\n\n[Corpus truncated at ${cap} characters for model input.]` : params.corpus;

  const priorBlock =
    priors.length > 0
      ? [
          "--- Prior Q&A on this project (oldest → newest; for follow-ups) ---",
          ...priors.map(
            (t, i) =>
              `Turn ${i + 1}\nUser: ${t.prompt}\nAssistant: ${t.answer}`
          ),
        ].join("\n\n")
      : "";

  const user = [
    `Project: ${params.projectName}`,
    priorBlock,
    "--- Corpus (video transcripts) ---",
    corpus,
    "--- Current question ---",
    params.userQuestion,
  ]
    .filter((s) => s.trim().length > 0)
    .join("\n\n");

  const br = client();
  const out = await br.send(
    new ConverseCommand({
      modelId: modelId(),
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: user }] }],
      inferenceConfig: { maxTokens: maxOutputTokens(), temperature: 0.2 },
    })
  );
  const blocks = out.output?.message?.content ?? [];
  let text = blocks.map((b) => ("text" in b ? b.text : "")).join("\n").trim();
  if (!text) throw new Error("Empty model response");
  if (out.stopReason === "max_tokens") {
    text +=
      "\n\n[Reply stopped at the output token limit. Set AOTQ_BEDROCK_MAX_OUTPUT_TOKENS (e.g. 32000) or ask in smaller chunks.]";
  }
  return text;
}

/**
 * Admin-only Playlist Triage: rank playlists from metadata + user criteria (Bedrock).
 * Returns model text (prefer JSON object per system instructions).
 */
export async function runPlaylistTriageAnalysis(params: {
  channelTitle: string;
  channelId: string;
  playlists: AotqChannelPlaylistMeta[];
  userPrompt: string;
}): Promise<string> {
  const system = [
    "You help prioritize which YouTube playlists to ingest next for transcript/Q&A work.",
    "You receive playlist metadata only (titles, descriptions, sizes, dates) — not video transcripts.",
    "Respond with a single valid JSON object (no markdown fences) using this shape:",
    '{"channelSummary":"string","criteriaEcho":"string","recommendations":[{"rank":1,"playlistUrl":"https://www.youtube.com/playlist?list=...","playlistId":"string","title":"string","rationale":"string"}]}',
    "Include at most 12 entries in recommendations, ordered best-first. Only use playlistId values that appear in the provided list.",
    "If nothing fits the user criteria, return an empty recommendations array and explain in channelSummary.",
  ].join(" ");

  const slim = params.playlists.map((p) => ({
    playlistId: p.playlistId,
    title: p.title,
    description: (p.description || "").slice(0, 600),
    publishedAt: p.publishedAt,
    itemCount: p.itemCount,
    playlistUrl: p.playlistUrl,
  }));

  const user = [
    `Channel: ${params.channelTitle} (${params.channelId})`,
    `User analysis instructions:\n${params.userPrompt.trim()}`,
    "--- Playlists (JSON) ---",
    JSON.stringify(slim),
  ].join("\n\n");

  const br = client();
  const out = await br.send(
    new ConverseCommand({
      modelId: modelId(),
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: user }] }],
      inferenceConfig: { maxTokens: Math.min(maxOutputTokens(), 8192), temperature: 0.15 },
    })
  );
  const blocks = out.output?.message?.content ?? [];
  let text = blocks.map((b) => ("text" in b ? b.text : "")).join("\n").trim();
  if (!text) throw new Error("Empty model response");
  if (out.stopReason === "max_tokens") {
    text += "\n\n[Reply may be truncated; increase AOTQ_BEDROCK_MAX_OUTPUT_TOKENS if needed.]";
  }
  return text;
}
