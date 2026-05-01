import { getAotqRepository } from "@/lib/repositories/aotq-repository";
import { runInterviewAnalysisPipeline } from "./aotq-orchestration-graph";
import type { Interview, InterviewDetailBundle, InterviewSource, InterviewStatus } from "./types";

function nowIso() {
  return new Date().toISOString();
}

export async function createInterviewFromTranscript(params: {
  title: string;
  transcript: string;
  source: InterviewSource;
  sourceUrl?: string;
  metadata?: Interview["metadata"];
  context?: string;
}): Promise<{ interviewId: string; bundle: InterviewDetailBundle } | { error: string }> {
  const interviewId = `aotq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const t = nowIso();

  const parsed = await runInterviewAnalysisPipeline({
    transcript: params.transcript,
    title: params.title,
    context: params.context,
  });

  if (!parsed || parsed.questions.length === 0) {
    return {
      error:
        "Analysis did not produce questions. Add a longer transcript or configure OpenAI in config; check server logs.",
    };
  }

  const interview: Interview = {
    interviewId,
    title: params.title,
    source: params.source,
    sourceUrl: params.sourceUrl,
    transcript: params.transcript.slice(0, 500_000),
    metadata: params.metadata,
    status: "published" as InterviewStatus,
    createdAt: t,
    updatedAt: t,
  };

  const questions = parsed.questions.map((q) => ({
    ...q,
    interviewId,
  }));
  const analyses = parsed.analyses.map((a) => ({
    ...a,
    interviewId,
  }));
  const assets = parsed.assets.map((c) => ({
    ...c,
    interviewId,
  }));

  await getAotqRepository().putInterviewBundle({
    interview,
    questions,
    analyses,
    assets,
  });

  const analysesMap: InterviewDetailBundle["analyses"] = {};
  for (const a of analyses) {
    analysesMap[a.questionId] = a;
  }

  return {
    interviewId,
    bundle: {
      interview,
      questions,
      analyses: analysesMap,
      assets,
    },
  };
}

export async function getPublishedBundle(interviewId: string): Promise<InterviewDetailBundle | null> {
  const repo = getAotqRepository();
  const b = await repo.getBundle(interviewId);
  if (!b || b.interview.status !== "published") return null;
  const analyses: InterviewDetailBundle["analyses"] = {};
  for (const a of b.analyses) {
    analyses[a.questionId] = a;
  }
  return {
    interview: b.interview,
    questions: b.questions,
    analyses,
    assets: b.assets,
  };
}
