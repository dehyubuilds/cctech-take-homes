import { NextResponse } from "next/server";
import { getAppRepository } from "@/lib/repositories";

export async function GET() {
  const repo = getAppRepository();
  const apps = await repo.list("active");
  return NextResponse.json({ apps });
}
