import { NextRequest, NextResponse } from "next/server";
import { requireAotqAdminSession } from "@/lib/art-of-the-question/aotq-route-auth";
import {
  listYoutubeChannelPlaylists,
  resolveYoutubeChannelFromQuery,
} from "@/lib/art-of-the-question/aotq-youtube";

export async function POST(request: NextRequest) {
  const gate = await requireAotqAdminSession(request);
  if (!gate.ok) return gate.response;

  const body = await request.json().catch(() => ({}));
  const channel = String(body.channel ?? "").trim();
  if (!channel) {
    return NextResponse.json({ error: "channel is required (name, @handle, or UC… id)." }, { status: 400 });
  }

  try {
    const resolved = await resolveYoutubeChannelFromQuery(channel);
    const playlists = await listYoutubeChannelPlaylists(resolved.channelId, 200);
    return NextResponse.json({
      channelId: resolved.channelId,
      channelTitle: resolved.title,
      playlistCount: playlists.length,
      playlists,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "YOUTUBE_DATA_API_KEY_MISSING") {
      return NextResponse.json(
        { error: "YouTube Data API key is not configured (config.youtubeDataApiKey or YOUTUBE_DATA_API_KEY)." },
        { status: 503 }
      );
    }
    if (msg === "CHANNEL_QUERY_EMPTY") {
      return NextResponse.json({ error: "Channel query is empty." }, { status: 400 });
    }
    if (msg === "CHANNEL_NOT_FOUND") {
      return NextResponse.json(
        { error: "No channel matched that query. Try @handle, the exact channel name, or the UC… channel id." },
        { status: 404 }
      );
    }
    console.error("[aotq/playlist-triage/scan]", e);
    return NextResponse.json({ error: "Could not list playlists for that channel." }, { status: 502 });
  }
}
