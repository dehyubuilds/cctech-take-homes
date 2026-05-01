"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { getStoredToken, useAuth } from "@/components/AuthProvider";

type PlaylistMeta = {
  playlistId: string;
  title: string;
  description: string;
  publishedAt: string;
  itemCount: number | null;
  playlistUrl: string;
};

function authHeaders(): HeadersInit {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function AotqPlaylistTriagePage() {
  const { isAdmin } = useAuth();
  const admin = isAdmin();

  const [channelQuery, setChannelQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelTitle, setChannelTitle] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistMeta[]>([]);
  const [prompt, setPrompt] = useState(
    "Prioritize playlists that look like long-form interviews, keynotes, or deep technical series. Deprioritize shorts, trailers, and music. Explain briefly why each pick is worth ingesting next."
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const formattedAnalysis = useMemo(() => {
    if (!analysis) return null;
    try {
      const parsed = JSON.parse(analysis) as unknown;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return analysis;
    }
  }, [analysis]);

  const scan = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      window.location.href = `/login?redirect=${encodeURIComponent("/art-of-the-question/playlist-triage")}`;
      return;
    }
    if (!channelQuery.trim()) return;
    setScanning(true);
    setErr(null);
    setAnalysis(null);
    try {
      const res = await fetch("/api/art-of-the-question/playlist-triage/scan", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channelQuery.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error || "Scan failed.");
        setPlaylists([]);
        setChannelId(null);
        setChannelTitle(null);
        return;
      }
      setChannelId(typeof j.channelId === "string" ? j.channelId : null);
      setChannelTitle(typeof j.channelTitle === "string" ? j.channelTitle : null);
      setPlaylists(Array.isArray(j.playlists) ? j.playlists : []);
    } finally {
      setScanning(false);
    }
  }, [channelQuery]);

  const runAnalyze = useCallback(async () => {
    const token = getStoredToken();
    if (!token || !channelId || !channelTitle || playlists.length === 0) return;
    setAnalyzing(true);
    setErr(null);
    try {
      const res = await fetch("/api/art-of-the-question/playlist-triage/analyze", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          channelTitle,
          playlists,
          prompt: prompt.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = typeof j.detail === "string" ? j.detail : "";
        setErr(detail ? `${j.error || "Analyze failed."} — ${detail}` : j.error || "Analyze failed.");
        setAnalysis(null);
        return;
      }
      setAnalysis(typeof j.analysis === "string" ? j.analysis : null);
    } finally {
      setAnalyzing(false);
    }
  }, [channelId, channelTitle, playlists, prompt]);

  if (!admin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Link href="/art-of-the-question/projects" className="text-sm text-aotq hover:text-aotq-hover">
          ← Video projects
        </Link>
        <p className="mt-10 text-sm text-zinc-400">Playlist Triage is an internal admin tool. Sign in with an admin account to use it.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 pb-24 sm:px-6">
      <nav className="text-sm">
        <Link href="/art-of-the-question/projects" className="text-aotq hover:text-aotq-hover">
          ← Video projects
        </Link>
      </nav>

      <header className="mt-8 border-b border-white/[0.08] pb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-aotq">Internal · Art of the Question</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-white sm:text-4xl">Playlist Triage</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Load every playlist on a channel via the YouTube Data API, then run a custom Bedrock prompt over playlist metadata
          (titles, descriptions, sizes) to get ranked playlist URLs worth ingesting next into a video project.
        </p>
      </header>

      {err && (
        <p className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{err}</p>
      )}

      <section className="mt-10 rounded-2xl border border-aotq/25 bg-[#140a10] p-6 sm:p-7 ring-1 ring-aotq/10">
        <h2 className="text-sm font-semibold text-white">1. Channel</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Use <span className="font-mono text-zinc-400">@Handle</span>, a channel name (search), or the{" "}
          <span className="font-mono text-zinc-400">UC…</span> channel id.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={channelQuery}
            onChange={(e) => setChannelQuery(e.target.value)}
            placeholder="@AWSCloud or AWS Events or UC…"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-aotq/40 focus:outline-none"
          />
          <button
            type="button"
            disabled={scanning || !channelQuery.trim()}
            onClick={() => void scan()}
            className="shrink-0 rounded-xl bg-aotq px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-aotq-hover disabled:opacity-50"
          >
            {scanning ? "Loading…" : "Load playlists"}
          </button>
        </div>
        {channelTitle && channelId ? (
          <p className="mt-4 text-xs text-zinc-400">
            Resolved: <span className="font-medium text-zinc-200">{channelTitle}</span>{" "}
            <span className="font-mono text-aotq/80">{channelId}</span> · {playlists.length} playlist(s)
          </p>
        ) : null}
      </section>

      {playlists.length > 0 && (
        <section className="mt-10 rounded-2xl border border-white/[0.08] bg-zinc-900/35 p-6 sm:p-7">
          <h2 className="text-sm font-semibold text-white">2. Analysis prompt</h2>
          <p className="mt-1 text-xs text-zinc-500">
            The model only sees playlist metadata below — not video transcripts. It returns JSON with ranked{" "}
            <span className="font-mono text-zinc-400">playlistUrl</span> values you can paste into a project.
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            className="mt-4 w-full rounded-xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-aotq/40 focus:outline-none"
          />
          <button
            type="button"
            disabled={analyzing || prompt.trim().length < 8}
            onClick={() => void runAnalyze()}
            className="mt-4 rounded-xl bg-aotq px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-aotq-hover disabled:opacity-50"
          >
            {analyzing ? "Running Bedrock…" : "Run triage"}
          </button>

          <details className="mt-8 border-t border-white/10 pt-6">
            <summary className="cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-200">
              Show all {playlists.length} playlists (metadata)
            </summary>
            <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto text-xs text-zinc-400">
              {playlists.map((p) => (
                <li key={p.playlistId} className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
                  <span className="font-medium text-zinc-200">{p.title}</span>{" "}
                  <span className="text-zinc-500">· {p.itemCount ?? "?"} videos</span>
                  <div className="mt-1 font-mono text-[10px] text-aotq/70">{p.playlistUrl}</div>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {formattedAnalysis && (
        <section className="mt-10 rounded-2xl border border-aotq/25 bg-[#140a10] p-6 sm:p-7 ring-1 ring-aotq/10">
          <h2 className="text-sm font-semibold text-white">3. Triage result</h2>
          <p className="mt-1 text-xs text-zinc-500">Copy playlist URLs into a video project’s Add YouTube field (playlist URL imports up to the project limit).</p>
          <pre className="mt-4 max-h-[min(70vh,520px)] overflow-auto whitespace-pre-wrap rounded-xl border border-white/[0.08] bg-black/50 p-4 font-mono text-[11px] leading-relaxed text-zinc-200">
            {formattedAnalysis}
          </pre>
        </section>
      )}
    </div>
  );
}
