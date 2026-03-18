"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth, getStoredToken } from "@/components/AuthProvider";

interface Beat {
  beatId: string;
  userId: string;
  creatorUsername: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl?: string;
  originalFileUrl?: string;
  previewFileUrl: string;
  minimumPriceCents: number;
  createdAt: string;
}

export default function BeatPage() {
  const params = useParams();
  const slug = (params?.slug as string) ?? "";
  const { session } = useAuth();
  const [beat, setBeat] = useState<Beat | null>(null);
  const [amountCents, setAmountCents] = useState(100);
  const [loading, setLoading] = useState(true);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [previewTimedOut, setPreviewTimedOut] = useState(false);

  const fetchBeat = () => {
    if (!slug) return;
    return fetch(`/api/dropflow/beats/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setBeat(data ?? null);
        if (data?.minimumPriceCents) {
          setAmountCents(Math.max(100, data.minimumPriceCents));
        }
        return data;
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    fetchBeat();
  }, [slug]);

  // When preview is missing but original exists, poll until ready or timeout (90s)
  const previewProcessing = beat && !beat.previewFileUrl && !!beat.originalFileUrl && !previewTimedOut;
  useEffect(() => {
    setPreviewTimedOut(false);
  }, [slug]);
  useEffect(() => {
    if (!beat || !slug || beat.previewFileUrl || !beat.originalFileUrl) return;
    const PREVIEW_TIMEOUT_MS = 90_000;
    const timeoutId = setTimeout(() => setPreviewTimedOut(true), PREVIEW_TIMEOUT_MS);
    const interval = setInterval(() => {
      fetch(`/api/dropflow/beats/${slug}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const url = data?.previewFileUrl;
          if (url && typeof url === "string" && url.length > 0) {
            setBeat((prev) => (prev ? { ...prev, previewFileUrl: url } : null));
          }
        })
        .catch(() => {});
    }, 3000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
    };
  }, [beat?.beatId, beat?.originalFileUrl, beat?.previewFileUrl, slug]);

  useEffect(() => {
    if (!beat?.beatId) return;
    fetch("/api/dropflow/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "beat_viewed", beatId: beat.beatId }),
    }).catch(() => {});
  }, [beat?.beatId]);

  const handlePlay = () => {
    if (beat?.beatId) {
      fetch("/api/dropflow/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "preview_played", beatId: beat.beatId }),
      }).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }
  if (!beat) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 md:max-w-2xl lg:max-w-xl">
        <p className="text-gray-400">Song or beat not found.</p>
        <Link href="/dropflow" className="mt-4 inline-block text-brand hover:underline">
          Browse Dropflow
        </Link>
      </div>
    );
  }

  const minDollars = (beat.minimumPriceCents / 100).toFixed(2);
  const amountDollars = (amountCents / 100).toFixed(2);

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:max-w-2xl lg:max-w-xl">
      {beat.thumbnailUrl ? (
        <img
          src={beat.thumbnailUrl}
          alt=""
          className="w-full aspect-video object-cover rounded-xl border border-white/10"
        />
      ) : (
        <div className="w-full aspect-video rounded-xl border border-white/10 bg-surface-muted flex items-center justify-center text-gray-500">
          No image
        </div>
      )}

      <h1 className="mt-6 text-xl font-semibold text-white">{beat.title}</h1>
      <p className="mt-1 text-sm text-gray-400">
        by{" "}
        <Link
          href={`/dropflow/u/${encodeURIComponent(beat.creatorUsername)}`}
          className="text-brand hover:underline"
        >
          {beat.creatorUsername}
        </Link>
      </p>
      {beat.description && (
        <p className="mt-3 text-gray-300 text-sm">{beat.description}</p>
      )}
      {beat.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {beat.tags.map((t) => (
            <Link
              key={t}
              href={`/dropflow?tag=${encodeURIComponent(t)}`}
              className="rounded-lg border border-white/10 bg-surface-elevated px-2.5 py-1 text-xs text-gray-400 hover:border-brand/50 hover:text-brand"
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        <p className="text-sm text-gray-400 mb-2">Preview (15s)</p>
        {beat.previewFileUrl ? (
          <audio
            controls
            src={beat.previewFileUrl}
            className="w-full"
            onPlay={handlePlay}
          />
        ) : previewProcessing ? (
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-surface-elevated px-4 py-3">
            <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden />
            <p className="text-sm text-gray-400">Track is being processed. It can take up to 2 minutes.</p>
          </div>
        ) : previewTimedOut && beat?.originalFileUrl ? (
          <div className="rounded-lg border border-white/10 bg-surface-elevated px-4 py-3">
            <p className="text-sm text-gray-400">Preview is taking longer than expected. You can still purchase and download the full track below.</p>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No preview yet.</p>
        )}
      </div>

      <div className="mt-8 rounded-xl border border-white/10 bg-surface-elevated p-4">
        <p className="text-sm text-gray-400 mb-2">
          Pay what you want (min ${minDollars})
        </p>
        {!session ? (
          <p className="mt-2 text-sm text-gray-400">
            You can browse and play previews without an account.{" "}
            <Link
              href={`/login?redirect=${encodeURIComponent(`/dropflow/b/${beat.beatId}`)}`}
              className="text-brand hover:underline"
            >
              Sign in
            </Link>{" "}
            and verify your phone in Profile to purchase.
          </p>
        ) : (
          <>
            <input
              type="number"
              min={beat.minimumPriceCents / 100}
              step={1}
              value={amountCents / 100}
              onChange={(e) => {
                setAmountCents(Math.max(100, Math.round(parseFloat(e.target.value || "0") * 100)));
                setBuyError(null);
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-surface-muted px-3 py-2 text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {buyError && (
              <p className="mt-2 text-sm text-amber-400">{buyError}</p>
            )}
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-brand py-3 font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              onClick={async () => {
                setBuyError(null);
                fetch("/api/dropflow/events", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: "purchase_started",
                    beatId: beat.beatId,
                  }),
                }).catch(() => {});
                const token = getStoredToken();
                const res = await fetch("/api/dropflow/checkout", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({
                    beatId: beat.beatId,
                    amountCents,
                    successUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/dropflow/b/${beat.beatId}?paid=1`,
                    cancelUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/dropflow/b/${beat.beatId}`,
                  }),
                });
                const data = await res.json().catch(() => ({}));
                if (data.url) window.location.href = data.url;
                else if (data.error) setBuyError(data.error);
              }}
            >
              Buy for ${amountDollars}
            </button>
          </>
        )}
      </div>

      <p className="mt-8 text-center text-sm text-gray-500">
        <Link href="/dropflow?mode=creator" className="text-brand hover:underline">
          ← Dropflow
        </Link>
      </p>
    </div>
  );
}
