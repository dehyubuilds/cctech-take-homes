import { NextRequest, NextResponse } from "next/server";
import { getAotqVideoProjectRepository } from "@/lib/art-of-the-question/aotq-video-project-repository";
import { getAotqSessionUser } from "@/lib/art-of-the-question/aotq-route-auth";
import { createVideoProject } from "@/lib/art-of-the-question/aotq-video-project-service";

export async function GET(request: NextRequest) {
  const session = await getAotqSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const repo = getAotqVideoProjectRepository();
  const rows = await repo.listProjectsForUser(session.userId);
  const projects = await Promise.all(
    rows.map(async (p) => ({
      ...p,
      sourceCount: await repo.countSources(p.projectId),
    }))
  );
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const session = await getAotqSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const project = await createVideoProject(session.userId, name);
  return NextResponse.json({ project });
}
