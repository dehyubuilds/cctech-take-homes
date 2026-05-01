import { config } from "@/lib/config";

/** Max single-video length (product rule). */
export const AOTQ_MAX_VIDEO_DURATION_SECONDS = 90 * 60;

const YT_HOSTS = /^(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)$/i;

function youtubeDataApiKey(): string | null {
  const fromConfig = String(config.youtubeDataApiKey ?? "").trim();
  const fromEnv = process.env.YOUTUBE_DATA_API_KEY?.trim() ?? "";
  const k = fromConfig || fromEnv;
  return k || null;
}

/** Throws `YOUTUBE_DATA_API_KEY_MISSING` when the Data API key is not configured. */
export function requireYoutubeDataApiKey(): string {
  const k = youtubeDataApiKey();
  if (!k) throw new Error("YOUTUBE_DATA_API_KEY_MISSING");
  return k;
}

/**
 * YouTube playlist id from a `playlist?list=` URL or a `watch` URL that includes `list=`.
 * youtu.be links never return a playlist id here.
 */
export function extractYoutubePlaylistId(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!YT_HOSTS.test(url.hostname)) return null;
    if (url.hostname.replace(/^www\./, "") === "youtu.be") return null;

    const list = url.searchParams.get("list");
    if (!list || !/^[\w-]{10,}$/.test(list)) return null;

    const path = url.pathname.replace(/\/$/, "") || "/";
    if (path === "/playlist") return list;
    if (path === "/watch" || path.startsWith("/watch")) return list;
    return null;
  } catch {
    return null;
  }
}

type PlaylistItemRow = { contentDetails?: { videoId?: string } };

/** Paginates `playlistItems.list` until `maxItems` ids or playlist ends. Server-only. */
export async function listYoutubePlaylistVideoIds(playlistId: string, maxItems: number): Promise<string[]> {
  const key = youtubeDataApiKey();
  if (!key) {
    throw new Error("YOUTUBE_DATA_API_KEY_MISSING");
  }

  const ids: string[] = [];
  let pageToken: string | undefined;
  const cap = Math.max(1, Math.min(Math.floor(maxItems), 500));

  while (ids.length < cap) {
    const u = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    u.searchParams.set("part", "contentDetails");
    u.searchParams.set("playlistId", playlistId);
    u.searchParams.set("maxResults", String(Math.min(50, cap - ids.length)));
    u.searchParams.set("key", key);
    if (pageToken) u.searchParams.set("pageToken", pageToken);

    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`YouTube playlist API ${res.status}: ${text.slice(0, 240)}`);
    }
    const j = (await res.json()) as { items?: PlaylistItemRow[]; nextPageToken?: string };
    const items = j.items ?? [];
    if (items.length === 0) break;
    for (const row of items) {
      const vid = row.contentDetails?.videoId;
      if (vid && /^[\w-]{11}$/.test(vid)) {
        ids.push(vid);
      }
      if (ids.length >= cap) break;
    }
    if (ids.length >= cap) break;
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }

  return ids;
}

type VideoStatusItem = { id?: string; status?: { privacyStatus?: string } };

/**
 * Uses YouTube Data API `videos.list` (up to 50 ids per call).
 * Drops **private** videos and ids **not returned** (deleted / unavailable).
 * Preserves first-seen order from `videoIds`. If the API key is missing, returns the input unchanged.
 */
export async function filterYoutubeVideoIdsForIngest(videoIds: string[]): Promise<{
  ingestable: string[];
  skippedPrivate: number;
  skippedDeleted: number;
}> {
  const key = youtubeDataApiKey();
  if (!key || videoIds.length === 0) {
    return { ingestable: videoIds, skippedPrivate: 0, skippedDeleted: 0 };
  }

  const orderedUnique: string[] = [];
  const seen = new Set<string>();
  for (const id of videoIds) {
    if (!/^[\w-]{11}$/.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    orderedUnique.push(id);
  }

  const statusById = new Map<string, "public_or_unlisted" | "private" | "missing">();

  for (let i = 0; i < orderedUnique.length; i += 50) {
    const chunk = orderedUnique.slice(i, i + 50);
    const u = new URL("https://www.googleapis.com/youtube/v3/videos");
    u.searchParams.set("part", "status");
    u.searchParams.set("id", chunk.join(","));
    u.searchParams.set("key", key);
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) {
      for (const id of chunk) {
        statusById.set(id, "public_or_unlisted");
      }
      continue;
    }
    const j = (await res.json()) as { items?: VideoStatusItem[] };
    const returned = new Set<string>();
    for (const item of j.items ?? []) {
      const id = item.id;
      if (!id) continue;
      returned.add(id);
      if (item.status?.privacyStatus === "private") {
        statusById.set(id, "private");
      } else {
        statusById.set(id, "public_or_unlisted");
      }
    }
    for (const id of chunk) {
      if (!returned.has(id)) {
        statusById.set(id, "missing");
      }
    }
  }

  let skippedPrivate = 0;
  let skippedDeleted = 0;
  const ingestable: string[] = [];
  for (const id of orderedUnique) {
    const st = statusById.get(id) ?? "public_or_unlisted";
    if (st === "private") {
      skippedPrivate += 1;
      continue;
    }
    if (st === "missing") {
      skippedDeleted += 1;
      continue;
    }
    ingestable.push(id);
  }

  return { ingestable, skippedPrivate, skippedDeleted };
}

/** When the Data API key is set, blocks private or missing videos before a Dynamo row is created. */
export async function assertYoutubeVideoIngestableOrThrow(videoId: string): Promise<void> {
  const key = youtubeDataApiKey();
  if (!key) return;
  const u = new URL("https://www.googleapis.com/youtube/v3/videos");
  u.searchParams.set("part", "status");
  u.searchParams.set("id", videoId);
  u.searchParams.set("key", key);
  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) return;
  const j = (await res.json()) as { items?: VideoStatusItem[] };
  const item = j.items?.[0];
  if (!item) {
    throw new Error("VIDEO_UNAVAILABLE");
  }
  if (item.status?.privacyStatus === "private") {
    throw new Error("VIDEO_PRIVATE");
  }
}

export function extractYoutubeVideoId(raw: string): string | null {
  const u = raw.trim();
  try {
    const url = new URL(u);
    if (!YT_HOSTS.test(url.hostname)) return null;
    if (url.hostname.replace(/^www\./, "") === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    const v = url.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const embed = url.pathname.match(/\/embed\/([\w-]{11})/);
    if (embed) return embed[1];
    const shorts = url.pathname.match(/\/shorts\/([\w-]{11})/);
    if (shorts) return shorts[1];
  } catch {
    return null;
  }
  return null;
}

export async function fetchYoutubeOEmbed(url: string): Promise<{ title: string; author_name?: string } | null> {
  const o = new URL("https://www.youtube.com/oembed");
  o.searchParams.set("url", url);
  o.searchParams.set("format", "json");
  const r = await fetch(o.toString(), { next: { revalidate: 0 } });
  if (!r.ok) return null;
  const j = (await r.json()) as { title?: string; author_name?: string };
  if (!j.title) return null;
  return { title: j.title, author_name: j.author_name };
}

/** Playlist row for Playlist Triage (metadata only; no video bodies). */
export type AotqChannelPlaylistMeta = {
  playlistId: string;
  title: string;
  description: string;
  publishedAt: string;
  itemCount: number | null;
  playlistUrl: string;
};

type ChannelListItem = { id?: string; snippet?: { title?: string; customUrl?: string } };

async function channelsList(params: Record<string, string>): Promise<ChannelListItem[]> {
  const key = requireYoutubeDataApiKey();
  const u = new URL("https://www.googleapis.com/youtube/v3/channels");
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  u.searchParams.set("part", "snippet");
  u.searchParams.set("key", key);
  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube channels API ${res.status}: ${text.slice(0, 240)}`);
  }
  const j = (await res.json()) as { items?: ChannelListItem[] };
  return j.items ?? [];
}

/**
 * Resolve a channel from @handle, raw handle, `UC…` id, or a free-text name (search).
 */
export async function resolveYoutubeChannelFromQuery(raw: string): Promise<{
  channelId: string;
  title: string;
  customUrl?: string;
}> {
  const q = raw.trim();
  if (!q) throw new Error("CHANNEL_QUERY_EMPTY");

  if (/^UC[\w-]{22}$/.test(q)) {
    const items = await channelsList({ id: q });
    const ch = items[0];
    if (!ch?.id) throw new Error("CHANNEL_NOT_FOUND");
    return {
      channelId: ch.id,
      title: ch.snippet?.title ?? ch.id,
      customUrl: ch.snippet?.customUrl,
    };
  }

  const handle = q.startsWith("@") ? q.slice(1).trim() : q;
  if (handle && !/\s/.test(handle) && handle.length >= 2 && handle.length <= 100) {
    const items = await channelsList({ forHandle: handle });
    const ch = items[0];
    if (ch?.id) {
      return {
        channelId: ch.id,
        title: ch.snippet?.title ?? handle,
        customUrl: ch.snippet?.customUrl,
      };
    }
  }

  const key = requireYoutubeDataApiKey();
  const searchQ = q.startsWith("@") ? q.slice(1).trim() || q : q;
  const su = new URL("https://www.googleapis.com/youtube/v3/search");
  su.searchParams.set("part", "snippet");
  su.searchParams.set("type", "channel");
  su.searchParams.set("maxResults", "5");
  su.searchParams.set("q", searchQ);
  su.searchParams.set("key", key);
  const sres = await fetch(su.toString(), { cache: "no-store" });
  if (!sres.ok) {
    const text = await sres.text().catch(() => "");
    throw new Error(`YouTube search API ${sres.status}: ${text.slice(0, 240)}`);
  }
  const sj = (await sres.json()) as {
    items?: { id?: { channelId?: string }; snippet?: { title?: string; channelTitle?: string } }[];
  };
  const first = sj.items?.[0];
  const channelId = first?.id?.channelId;
  if (!channelId) throw new Error("CHANNEL_NOT_FOUND");
  return {
    channelId,
    title: first?.snippet?.title ?? first?.snippet?.channelTitle ?? channelId,
  };
}

/**
 * All playlists owned by the channel (paginated). Caps at `maxPlaylists` (default 200).
 */
export async function listYoutubeChannelPlaylists(
  channelId: string,
  maxPlaylists = 200
): Promise<AotqChannelPlaylistMeta[]> {
  const key = requireYoutubeDataApiKey();
  const out: AotqChannelPlaylistMeta[] = [];
  let pageToken: string | undefined;
  const cap = Math.max(1, Math.min(maxPlaylists, 500));

  while (out.length < cap) {
    const u = new URL("https://www.googleapis.com/youtube/v3/playlists");
    u.searchParams.set("part", "snippet,contentDetails");
    u.searchParams.set("channelId", channelId);
    u.searchParams.set("maxResults", String(Math.min(50, cap - out.length)));
    u.searchParams.set("key", key);
    if (pageToken) u.searchParams.set("pageToken", pageToken);

    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`YouTube playlists API ${res.status}: ${text.slice(0, 240)}`);
    }
    const j = (await res.json()) as {
      items?: {
        id?: string;
        snippet?: { title?: string; description?: string; publishedAt?: string };
        contentDetails?: { itemCount?: number };
      }[];
      nextPageToken?: string;
    };

    const items = j.items ?? [];
    if (items.length === 0) break;

    for (const row of items) {
      const pid = row.id;
      if (!pid || !/^[\w-]+$/.test(pid)) continue;
      out.push({
        playlistId: pid,
        title: row.snippet?.title ?? "(untitled)",
        description: (row.snippet?.description ?? "").slice(0, 5000),
        publishedAt: row.snippet?.publishedAt ?? "",
        itemCount: typeof row.contentDetails?.itemCount === "number" ? row.contentDetails.itemCount : null,
        playlistUrl: `https://www.youtube.com/playlist?list=${encodeURIComponent(pid)}`,
      });
      if (out.length >= cap) break;
    }
    if (out.length >= cap) break;
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }

  return out;
}
