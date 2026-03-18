"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Beat {
  beatId: string;
  creatorUsername: string;
  title: string;
  description?: string;
  tags?: string[];
  thumbnailUrl?: string;
  minimumPriceCents: number;
}

export default function CreatorCollectionPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const [username, setUsername] = useState("");
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setUsername(p.username));
  }, [params]);

  useEffect(() => {
    if (!username) return;
    const q = username.trim().toLowerCase();
    fetch(`/api/dropflow/beats?username=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => setBeats(data.beats ?? []))
      .finally(() => setLoading(false));

    fetch("/api/dropflow/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "collection_viewed",
        metadata: { username: q },
      }),
    }).catch(() => {});
  }, [username]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  const displayName = username; // could come from profile later

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:max-w-2xl lg:max-w-4xl xl:max-w-5xl">
      <h1 className="text-2xl font-semibold text-white">{displayName}</h1>
      <p className="mt-1 text-gray-400 text-sm">Creator</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {beats.length === 0 ? (
          <p className="col-span-full rounded-lg border border-white/10 bg-surface-elevated p-8 text-center text-gray-400">
            No songs or beats yet.
          </p>
        ) : (
          beats.map((beat) => (
            <Link
              key={beat.beatId}
              href={`/dropflow/b/${beat.beatId}`}
              className="overflow-hidden rounded-xl border border-white/10 bg-surface-elevated transition hover:border-white/20"
            >
              {beat.thumbnailUrl ? (
                <img
                  src={beat.thumbnailUrl}
                  alt=""
                  className="w-full aspect-video object-cover"
                />
              ) : (
                <div className="w-full aspect-video bg-surface-muted flex items-center justify-center text-gray-500 text-sm">
                  No image
                </div>
              )}
              <div className="p-4">
                <p className="font-medium text-white truncate">{beat.title}</p>
                <p className="mt-1 text-sm text-gray-400">
                  From ${(beat.minimumPriceCents / 100).toFixed(2)}
                </p>
                {beat.tags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {beat.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded border border-white/10 px-1.5 py-0.5 text-xs text-gray-500"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </Link>
          ))
        )}
      </div>

      <p className="mt-8 text-center text-sm text-gray-500">
        <Link href="/dropflow" className="text-brand hover:underline">
          ← Dropflow
        </Link>
      </p>
    </div>
  );
}
