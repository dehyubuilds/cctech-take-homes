import { NextResponse } from "next/server";
import { getAppRepository } from "@/lib/repositories";

/** Prevent prerender at build time so we never need AWS credentials during build. */
export const dynamic = "force-dynamic";

export async function GET() {
  const repo = getAppRepository();
  const apps = await repo.list("active");
  return NextResponse.json({ apps });
}
