import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthService } from "@/lib/services";
import { getAotqRepository } from "@/lib/repositories/aotq-repository";
import { runAotqFollowUpOrchestration } from "@/lib/art-of-the-question/aotq-orchestration-graph";
import { getPublishedBundle } from "@/lib/art-of-the-question/aotq-service";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const session = await getAuthService().getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const interviewId = String(body.interviewId ?? "").trim();
  const questionId = String(body.questionId ?? "").trim();
  const prompt = String(body.prompt ?? "").trim();
  if (!interviewId || !questionId || !prompt) {
    return NextResponse.json({ error: "interviewId, questionId, prompt required" }, { status: 400 });
  }

  const bundle = await getPublishedBundle(interviewId);
  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const q = bundle.questions.find((x) => x.questionId === questionId);
  const a = bundle.analyses[questionId];
  if (!q || !a) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const analysisSummary = [
    `Type: ${a.type}`,
    `Why it worked: ${a.whyItWorked}`,
    `Outcome: ${a.outcome}`,
    `Execution: ${a.executionSignal}`,
  ].join("\n");

  let answer =
    (await runAotqFollowUpOrchestration({
      questionText: q.text,
      analysisSummary,
      userPrompt: prompt,
    })) ?? "";

  if (!answer) {
    answer = `(${q.text.slice(0, 80)}…) Configure OpenAI in Statics config for contextual coaching. Your question: “${prompt.slice(0, 200)}”.`;
  }

  const createdAt = new Date().toISOString();
  const followUpId = randomUUID();
  await getAotqRepository().putFollowUp({
    followUpId,
    userId: session.userId,
    interviewId,
    questionId,
    prompt,
    response: answer,
    createdAt,
  });

  return NextResponse.json({ answer, followUpId });
}
