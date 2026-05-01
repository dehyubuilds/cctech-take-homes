import { NextRequest, NextResponse } from "next/server";
import { runPlaylistTriageAnalysis } from "@/lib/art-of-the-question/aotq-project-bedrock";
import { requireAotqAdminSession } from "@/lib/art-of-the-question/aotq-route-auth";
import type { AotqChannelPlaylistMeta } from "@/lib/art-of-the-question/aotq-youtube";

function parsePlaylists(raw: unknown): AotqChannelPlaylistMeta[] | null {
  if (!Array.isArray(raw)) return null;
  const out: AotqChannelPlaylistMeta[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const playlistId = typeof o.playlistId === "string" ? o.playlistId.trim() : "";
    const title = typeof o.title === "string" ? o.title : "";
    if (!/^[\w-]+$/.test(playlistId)) continue;
    out.push({
      playlistId,
      title: title || "(untitled)",
      description: typeof o.description === "string" ? o.description.slice(0, 8000) : "",
      publishedAt: typeof o.publishedAt === "string" ? o.publishedAt : "",
      itemCount: typeof o.itemCount === "number" && Number.isFinite(o.itemCount) ? o.itemCount : null,
      playlistUrl:
        typeof o.playlistUrl === "string" && o.playlistUrl.startsWith("http")
          ? o.playlistUrl
          : `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
    });
    if (out.length > 220) break;
  }
  return out.length ? out : null;
}

export async function POST(request: NextRequest) {
  const gate = await requireAotqAdminSession(request);
  if (!gate.ok) return gate.response;

  const body = await request.json().catch(() => ({}));
  const channelId = String(body.channelId ?? "").trim();
  const channelTitle = String(body.channelTitle ?? "").trim();
  const prompt = String(body.prompt ?? "").trim();
  const playlists = parsePlaylists(body.playlists);

  if (!channelId || !/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
    return NextResponse.json({ error: "channelId must be a valid YouTube channel id (24-character UC… id)." }, { status: 400 });
  }
  if (!channelTitle) {
    return NextResponse.json({ error: "channelTitle is required." }, { status: 400 });
  }
  if (!prompt || prompt.length < 8) {
    return NextResponse.json({ error: "prompt must be at least 8 characters." }, { status: 400 });
  }
  if (prompt.length > 8000) {
    return NextResponse.json({ error: "prompt is too long (max 8000 characters)." }, { status: 400 });
  }
  if (!playlists?.length) {
    return NextResponse.json({ error: "playlists array is required (run scan first)." }, { status: 400 });
  }

  try {
    const analysis = await runPlaylistTriageAnalysis({
      channelTitle,
      channelId,
      playlists: playlists.slice(0, 200),
      userPrompt: prompt,
    });
    return NextResponse.json({ analysis });
  } catch (e) {
    console.error("[aotq/playlist-triage/analyze]", e);
    const raw = e instanceof Error ? e.message : String(e);
    const detail =
      process.env.NODE_ENV === "development"
        ? raw.slice(0, 800)
        : "Check Bedrock model access, AOTQ_BEDROCK_MODEL_ID, and IAM bedrock:InvokeModel.";
    return NextResponse.json({ error: "Analysis failed", detail }, { status: 502 });
  }
}
