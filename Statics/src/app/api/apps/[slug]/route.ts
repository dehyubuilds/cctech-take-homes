import { NextRequest, NextResponse } from "next/server";
import { getAppRepository } from "@/lib/repositories";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const repo = getAppRepository();
  const app = await repo.getBySlug(slug);
  if (!app) {
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }
  return NextResponse.json(app);
}
