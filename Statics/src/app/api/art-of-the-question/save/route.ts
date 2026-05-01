import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthService } from "@/lib/services";
import { getAotqRepository } from "@/lib/repositories/aotq-repository";

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
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 4000) : undefined;
  if (!interviewId || !questionId) {
    return NextResponse.json({ error: "interviewId and questionId required" }, { status: 400 });
  }

  const saveId = randomUUID();
  const savedAt = new Date().toISOString();
  await getAotqRepository().putUserSave({
    saveId,
    userId: session.userId,
    interviewId,
    questionId,
    notes,
    savedAt,
  });

  return NextResponse.json({ ok: true, saveId });
}
