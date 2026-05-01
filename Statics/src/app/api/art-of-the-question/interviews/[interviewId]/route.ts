import { NextResponse } from "next/server";
import { getPublishedBundle } from "@/lib/art-of-the-question/aotq-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ interviewId: string }> }
) {
  const { interviewId } = await context.params;
  const bundle = await getPublishedBundle(interviewId);
  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ bundle });
}
