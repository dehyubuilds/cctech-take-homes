"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { QuestionType } from "@/lib/art-of-the-question/types";

export function AotqLearnPage() {
  const [types, setTypes] = useState<QuestionType[]>([]);

  useEffect(() => {
    fetch("/api/art-of-the-question/taxonomy")
      .then((r) => r.json())
      .then((d) => setTypes(d.types ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/art-of-the-question" className="text-sm text-aotq hover:underline">
        ← Art of the Question
      </Link>
      <header className="mt-6 border-b border-white/10 pb-8">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Question taxonomy</h1>
        <p className="mt-2 text-sm text-gray-400">
          Core IP — definitions, when to use, why they work, and failure modes. Same vocabulary powers breakdowns and
          learning.
        </p>
      </header>
      <ul className="mt-10 space-y-8">
        {types.map((t) => (
          <li key={t.typeId} className="rounded-2xl border border-white/10 bg-[#101010] p-6">
            <h2 className="text-lg font-semibold text-aotq">{t.name}</h2>
            <p className="mt-2 text-sm text-gray-300">{t.definition}</p>
            <div className="mt-4 text-sm">
              <p className="text-gray-500">When to use</p>
              <p className="text-gray-300">{t.useCase}</p>
            </div>
            <div className="mt-3 text-sm">
              <p className="text-gray-500">Why it works</p>
              <p className="text-gray-300">{t.whyItWorks}</p>
            </div>
            {t.examples.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm text-gray-400">
                {t.examples.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 text-sm text-rose-200/80">
              <p className="font-medium text-rose-200/90">Anti-patterns</p>
              <ul className="mt-1 list-disc pl-5">
                {t.antiPatterns.map((ap, i) => (
                  <li key={i}>{ap}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
