"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { InterviewDetailBundle } from "@/lib/art-of-the-question/types";

export function AotqInterviewPage({ interviewId }: { interviewId: string }) {
  const [bundle, setBundle] = useState<InterviewDetailBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/art-of-the-question/interviews/${encodeURIComponent(interviewId)}`)
      .then(async (r) => {
        const d = await r.json();
        if (cancelled) return;
        if (!r.ok) setErr(typeof d.error === "string" ? d.error : "Not found");
        else setBundle(d.bundle as InterviewDetailBundle);
      })
      .catch(() => {
        if (!cancelled) setErr("Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  if (err || !bundle) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center text-gray-400">
        {err || "Loading…"}
        <div className="mt-6">
          <Link href="/art-of-the-question" className="text-aotq hover:underline">
            ← Home
          </Link>
        </div>
      </div>
    );
  }

  const { interview, questions, analyses } = bundle;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/art-of-the-question" className="text-sm text-aotq hover:underline">
        ← Breakdowns
      </Link>
      <header className="mt-6 border-b border-white/10 pb-8">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">{interview.title}</h1>
        {interview.metadata?.guest && (
          <p className="mt-2 text-sm text-gray-400">Guest / context: {interview.metadata.guest}</p>
        )}
      </header>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">High-signal questions</h2>
        <ol className="mt-4 space-y-4">
          {questions
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((q, i) => {
              const a = analyses[q.questionId];
              return (
                <li key={q.questionId}>
                  <Link
                    href={`/art-of-the-question/interviews/${encodeURIComponent(interviewId)}/questions/${encodeURIComponent(q.questionId)}`}
                    className="block rounded-2xl border border-white/10 bg-[#101010] p-5 hover:border-aotq/30"
                  >
                    <span className="text-xs font-medium text-aotq">#{i + 1} · score {q.score}</span>
                    <p className="mt-2 text-base font-medium leading-snug text-white">{q.text}</p>
                    {a && (
                      <p className="mt-3 line-clamp-2 text-sm text-gray-400">{a.whyItWorked}</p>
                    )}
                  </Link>
                </li>
              );
            })}
        </ol>
      </section>
    </div>
  );
}
