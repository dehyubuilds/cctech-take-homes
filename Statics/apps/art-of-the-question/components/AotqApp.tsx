"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

type Row = { interviewId: string; title: string; updatedAt: string; questionCount: number };

export function AotqApp() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/art-of-the-question/catalog")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.interviews ?? []);
        if (d.error) setErr(d.error);
      })
      .catch(() => setErr("Could not load."));
  }, []);

  return (
    <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-14 sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
          Art of the Question
        </p>
        <h1 className="mt-4 font-serif text-4xl font-medium leading-[1.1] tracking-tight text-white sm:text-5xl">
          Signal, not clips.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          A studio for interview craft: the moments that unlocked real answers, why they worked, and how to reuse them.
          Pair curated breakdowns with your own multi-video projects and transcript-grounded Q&A.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/art-of-the-question/projects"
            className="rounded-2xl bg-aotq px-5 py-3 text-sm font-semibold text-slate-950 shadow-md shadow-aotq/15 hover:bg-aotq-hover"
          >
            Video projects
          </Link>
          <Link
            href="/art-of-the-question/learn"
            className="rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-zinc-200 ring-1 ring-white/5 hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
          >
            Question taxonomy
          </Link>
          {isAdmin() ? (
            <Link
              href="/art-of-the-question/playlist-triage"
              className="rounded-2xl border border-zinc-600/40 bg-zinc-900/50 px-5 py-3 text-sm font-medium text-zinc-300 ring-1 ring-white/10 hover:border-white/20 hover:text-zinc-100"
            >
              Playlist triage
            </Link>
          ) : null}
        </div>
      </header>

      <div className="mt-16 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/50 p-8 ring-1 ring-white/[0.04]">
          <h2 className="text-lg font-semibold text-white">Your transcript workspace</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Create a named project, paste YouTube links, and ask across every ready transcript. Ingest runs in-app or
            hands off to Lambda when{" "}
            <span className="font-mono text-xs text-zinc-500">AOTQ_MEDIA_INGEST_FUNCTION</span> is set — swap the worker
            for yt-dlp, ffmpeg, or Whisper when you are ready.
          </p>
          <Link href="/art-of-the-question/projects" className="mt-6 inline-flex text-sm font-medium text-aotq hover:text-aotq-hover">
            Open projects →
          </Link>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/50 p-8 ring-1 ring-white/[0.04]">
          <h2 className="text-lg font-semibold text-white">Curated breakdowns</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Published interviews with scored questions, rewrites, and execution signals — the original Art of the
            Question library.
          </p>
        </section>
      </div>

      {err && (
        <p className="mt-12 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          {err} — run <code className="text-zinc-300">npm run create-aotq-table</code> and{" "}
          <code className="text-zinc-300">npm run seed-aotq-demo</code> if the table is empty.
        </p>
      )}

      <section className="mt-14">
        <div className="flex items-end justify-between gap-4 border-b border-white/[0.07] pb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Published interviews</h2>
        </div>
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.interviewId}>
              <Link
                href={`/art-of-the-question/interviews/${encodeURIComponent(r.interviewId)}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-zinc-900/35 px-5 py-4 transition-all hover:border-aotq/25 hover:bg-zinc-900/60"
              >
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-zinc-100 group-hover:text-white">{r.title}</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {r.questionCount} questions · {new Date(r.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="shrink-0 text-zinc-600 transition group-hover:text-aotq" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {rows.length === 0 && !err && (
          <p className="mt-16 text-center text-sm text-zinc-500">No published breakdowns yet.</p>
        )}
      </section>
    </div>
  );
}
