"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredToken } from "@/components/AuthProvider";
import { MarkdownContent } from "@/components/MarkdownContent";
import type { InterviewDetailBundle } from "@/lib/art-of-the-question/types";

export function AotqQuestionPage({ interviewId, questionId }: { interviewId: string; questionId: string }) {
  const [bundle, setBundle] = useState<InterviewDetailBundle | null>(null);
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/art-of-the-question/interviews/${encodeURIComponent(interviewId)}`)
      .then(async (r) => {
        const d = await r.json();
        if (cancelled) return;
        if (r.ok && d.bundle) setBundle(d.bundle as InterviewDetailBundle);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  if (!bundle) {
    return <div className="py-20 text-center text-gray-500">Loading…</div>;
  }

  const q = bundle.questions.find((x) => x.questionId === questionId);
  const a = bundle.analyses[questionId];
  const asset = bundle.assets.find((x) => x.questionId === questionId);

  if (!q || !a) {
    return (
      <div className="py-20 text-center text-gray-400">
        Question not found.
        <Link href={`/art-of-the-question/interviews/${encodeURIComponent(interviewId)}`} className="mt-4 block text-aotq">
          ← Back
        </Link>
      </div>
    );
  }

  const ask = async () => {
    const token = getStoredToken();
    if (!token) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (!prompt.trim()) return;
    setLoading(true);
    setReply(null);
    try {
      const res = await fetch("/api/art-of-the-question/follow-up", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId, questionId, prompt: prompt.trim() }),
      });
      const j = await res.json();
      setReply(j.answer || j.error || "No response");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    const token = getStoredToken();
    if (!token) return;
    setSaving(true);
    try {
      await fetch("/api/art-of-the-question/save", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId, questionId }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href={`/art-of-the-question/interviews/${encodeURIComponent(interviewId)}`}
        className="text-sm text-aotq hover:underline"
      >
        ← Interview
      </Link>

      <article className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-aotq/90">Question · {q.questionTypeId}</p>
        <h1 className="mt-3 text-2xl font-semibold leading-snug text-white">{q.text}</h1>
        <p className="mt-2 text-sm text-gray-500">Score {q.score}</p>

        <section className="mt-10 space-y-8 text-sm leading-relaxed text-gray-300">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Why it worked</h2>
            <p className="mt-2">{a.whyItWorked}</p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Outcome</h2>
            <p className="mt-2">{a.outcome}</p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Stronger version</h2>
            <p className="mt-2 text-white">{a.rewrite}</p>
            {a.alternativePhrasings?.length ? (
              <ul className="mt-2 list-disc pl-5 text-gray-400">
                {a.alternativePhrasings.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Execution signal</h2>
            <p className="mt-2">{a.executionSignal}</p>
            <p className="mt-1 text-gray-500">When: {a.whenToUse}</p>
            <p className="mt-1 text-gray-500">Avoid: {a.whatToAvoid}</p>
          </div>
        </section>

        {asset && (
          <section className="mt-10 rounded-2xl border border-white/10 bg-[#0c0c0c] p-5">
            <h2 className="text-sm font-semibold text-white">Content pack</h2>
            <p className="mt-2 text-sm text-gray-400">{asset.caption}</p>
            <div className="mt-4 text-xs text-gray-500">
              <p className="font-medium text-gray-400">Voiceover</p>
              <p className="mt-1 whitespace-pre-wrap">{asset.voiceoverScript}</p>
            </div>
            {asset.titleVariations?.length ? (
              <ul className="mt-3 text-sm text-aotq/90">
                {asset.titleVariations.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : null}
          </section>
        )}

        <div className="mt-10 rounded-2xl border border-aotq/25 bg-[#120810] p-5">
          <h2 className="text-lg font-semibold text-white">Ask a follow-up</h2>
          <p className="mt-1 text-xs text-gray-500">Grounded in this question — not generic chat.</p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Explain more simply / how do I use this in my interview / bad vs good version…"
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:border-aotq/40 focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void ask()}
              disabled={loading}
              className="rounded-lg bg-aotq px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-aotq-hover disabled:opacity-50"
            >
              {loading ? "…" : "Ask"}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
            >
              {saving ? "…" : "Save to library"}
            </button>
          </div>
          {reply && (
            <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-4 text-sm">
              <MarkdownContent>{reply}</MarkdownContent>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
