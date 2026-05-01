import { NextResponse } from "next/server";
import { QUESTION_TYPE_TAXONOMY } from "@/lib/art-of-the-question/taxonomy";

export async function GET() {
  return NextResponse.json({ types: QUESTION_TYPE_TAXONOMY });
}
