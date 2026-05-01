"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useAuth, getStoredToken } from "@/components/AuthProvider";
import {
  YoutubeImportBlock,
  type YoutubeImportResult,
} from "@/components/media/YoutubeImportBlock";
const ADD_FORM_KEYS = {
  username: "dropflow_add_creatorUsername",
  title: "dropflow_add_title",
  description: "dropflow_add_description",
  tags: "dropflow_add_tags",
};

function getStored(key: keyof typeof ADD_FORM_KEYS): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(ADD_FORM_KEYS[key]) ?? "";
}

function setStored(key: keyof typeof ADD_FORM_KEYS, value: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ADD_FORM_KEYS[key], value);
}

type ListGate = "loading" | "no-auth" | "no-username" | "no-stripe" | "ok";

export default function AddBeatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading: authLoading } = useAuth();
  const [listGate, setListGate] = useState<ListGate>("loading");
  const [creatorUsername, setCreatorUsername] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [priceDollars, setPriceDollars] = useState("1.00");
  const [isFreeTrack, setIsFreeTrack] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [trackFile, setTrackFile] = useState<File | null>(null);
  /** Audio already in S3 from POST /api/youtube-import (dropflow_track) — same pipeline + bucket as Private Collection. */
  const [youtubeTrack, setYoutubeTrack] = useState<YoutubeImportResult | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [trackPreviewUrl, setTrackPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [createdBeatId, setCreatedBeatId] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewLongWait, setPreviewLongWait] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const trackInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URLs on change/unmount to avoid leaks
  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
      if (trackPreviewUrl) URL.revokeObjectURL(trackPreviewUrl);
    };
  }, [thumbnailPreviewUrl, trackPreviewUrl]);

  // Poll until previewFileUrl is set — never show "View track" until the API confirms preview exists
  useEffect(() => {
    if (!createdBeatId || previewReady) return;
    const longWaitId = setTimeout(() => setPreviewLongWait(true), 120_000);
    const check = () => {
      fetch(`/api/dropflow/beats/${createdBeatId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const url = data?.previewFileUrl;
          if (url && typeof url === "string" && url.length > 0) setPreviewReady(true);
        })
        .catch(() => {});
    };
    const interval = setInterval(check, 2000);
    check();
    return () => {
      clearInterval(interval);
      clearTimeout(longWaitId);
    };
  }, [createdBeatId, previewReady]);

  useEffect(() => {
    if (previewReady) setPreviewLongWait(false);
  }, [previewReady]);

  // When preview becomes ready, update success message
  useEffect(() => {
    if (createdBeatId && previewReady) {
      setMessage({ type: "success", text: "Preview ready. View your track or add another below." });
    }
  }, [createdBeatId, previewReady]);

  // On every visit to Add page: clear title, description, tags, thumbnail, track (keep username from profile).
  useLayoutEffect(() => {
    setStored("title", "");
    setStored("description", "");
    setStored("tags", "");
    setTitle("");
    setDescription("");
    setTagsStr("");
    setThumbnailFile(null);
    setTrackFile(null);
    setYoutubeTrack(null);
    setThumbnailPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setTrackPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
    if (trackInputRef.current) trackInputRef.current.value = "";
  }, []);

  // Restore creator username from sessionStorage or ?username= (title/description/tags cleared on mount above).
  useLayoutEffect(() => {
    const fromUrl = searchParams?.get("username")?.trim();
    setCreatorUsername(fromUrl || getStored("username"));
    setTitle(getStored("title"));
    setDescription(getStored("description"));
    setTagsStr(getStored("tags"));
  }, [searchParams]);

  // Gate listing: must be signed in, have Dropflow username, and Stripe payouts set up (in Profile).
  useEffect(() => {
    if (authLoading) return;
    if (!session?.userId) {
      setListGate("no-auth");
      return;
    }
    const uid = session.userId;
    setListGate("loading");
    fetch(`/api/dropflow/me?userId=${encodeURIComponent(uid)}&checkStripe=1`)
      .then((r) => r.json())
      .then((data) => {
        const profile = data.profile;
        if (!profile) {
          setListGate("no-username");
          return;
        }
        if (profile.username) {
          setCreatorUsername(profile.username);
          setStored("username", profile.username);
        }
        const stripeOk = !!(profile.stripeAccountId && profile.stripeOnboardingComplete);
        if (!stripeOk) {
          setListGate("no-stripe");
          return;
        }
        if (typeof window !== "undefined") window.localStorage.setItem("dropflow_userId", uid);
        setListGate("ok");
      })
      .catch(() => setListGate("no-stripe"));
  }, [session?.userId, authLoading]);

  // Fetch profile and set username (API overrides stored value so checkmark state is correct).
  useEffect(() => {
    const uid = typeof window !== "undefined" ? localStorage.getItem("dropflow_userId") ?? "" : "";
    if (!uid || listGate !== "ok") return;
    fetch(`/api/dropflow/me?userId=${encodeURIComponent(uid)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.profile?.username) {
          const un = data.profile.username;
          setCreatorUsername(un);
          setStored("username", un);
        }
      })
      .catch(() => {});
  }, [listGate]);

  // Persist form fields so they survive navigation (e.g. "← Dropflow" then "Add a track" again).
  useEffect(() => {
    setStored("title", title);
    setStored("description", description);
    setStored("tags", tagsStr);
  }, [title, description, tagsStr]);
  useEffect(() => {
    setStored("username", creatorUsername);
  }, [creatorUsername]);

  async function uploadFile(
    type: "thumbnail" | "track",
    file: File
  ): Promise<{ fileUrl: string; key?: string }> {
    const res = await fetch("/api/dropflow/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        contentType: file.type,
        fileName: file.name,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || "Upload URL failed");
    const uploadUrl = (data as { uploadUrl?: string }).uploadUrl as string;
    const fileUrl = (data as { fileUrl?: string }).fileUrl as string;
    const key = (data as { key?: string }).key;
    if (!uploadUrl) throw new Error("No upload URL returned");
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || (type === "thumbnail" ? "image/jpeg" : "audio/mpeg") },
    });
    if (!putRes.ok) {
      throw new Error(
        "Storage upload failed. The S3 bucket may need CORS configured for your origin—see scripts/set-dropflow-bucket-cors.sh."
      );
    }
    return type === "track" && key ? { fileUrl, key } : { fileUrl };
  }

  function clearFormForNewTrack() {
    setTitle("");
    setDescription("");
    setTagsStr("");
    setStored("title", "");
    setStored("description", "");
    setStored("tags", "");
    setThumbnailFile(null);
    setTrackFile(null);
    setYoutubeTrack(null);
    if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    if (trackPreviewUrl) URL.revokeObjectURL(trackPreviewUrl);
    setThumbnailPreviewUrl(null);
    setTrackPreviewUrl(null);
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
    if (trackInputRef.current) trackInputRef.current.value = "";
    setCreatedBeatId(null);
    setPreviewReady(false);
    setPreviewLongWait(false);
    setMessage(null);
    setIsFreeTrack(false);
    const uid = typeof window !== "undefined" ? localStorage.getItem("dropflow_userId") ?? "" : "";
    if (uid) {
      fetch(`/api/dropflow/me?userId=${encodeURIComponent(uid)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.profile?.username) {
            setCreatorUsername(data.profile.username);
            setStored("username", data.profile.username);
          } else {
            setCreatorUsername("");
            setStored("username", "");
          }
        })
        .catch(() => {});
    } else {
      setCreatorUsername("");
    }
  }

  function handleAddAnotherTrack() {
    clearFormForNewTrack();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const hasTrack = Boolean(trackFile) || Boolean(youtubeTrack);
    if (!creatorUsername.trim() || creatorUsername.trim().length < 2 || !title.trim() || !hasTrack) {
      setMessage({
        type: "error",
        text: "Fill in creator username, title, and upload a track file or import audio from YouTube.",
      });
      return;
    }
    const priceParsed = parseFloat(priceDollars.replace(/[^0-9.]/g, "")) || 0;
    const priceCents = Math.round(priceParsed * 100);
    if (!isFreeTrack && priceCents < 100) {
      setMessage({
        type: "error",
        text: "Listing price must be at least $1.00 (or mark the track as free).",
      });
      return;
    }
    setSaving(true);
    const token = getStoredToken();
    const userId =
      session?.userId ??
      (typeof window !== "undefined" ? localStorage.getItem("dropflow_userId") ?? "" : "");
    if (!token || !userId) {
      setMessage({ type: "error", text: "Sign in again to create a track." });
      setSaving(false);
      return;
    }
    try {
      let thumbnailUrl = "";
      if (thumbnailFile) {
        const th = await uploadFile("thumbnail", thumbnailFile);
        thumbnailUrl = th.fileUrl;
      } else if (youtubeTrack?.thumbnailUrl) {
        thumbnailUrl = youtubeTrack.thumbnailUrl;
      }
      let originalFileUrl: string;
      let originalS3Key: string | undefined;
      if (trackFile) {
        const trackUp = await uploadFile("track", trackFile);
        originalFileUrl = trackUp.fileUrl;
        originalS3Key = trackUp.key;
      } else if (youtubeTrack) {
        originalFileUrl = youtubeTrack.fileUrl;
        originalS3Key = youtubeTrack.s3Key;
      } else {
        setMessage({ type: "error", text: "Add a track file or complete a YouTube import." });
        setSaving(false);
        return;
      }

      const tags = tagsStr.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
      const res = await fetch("/api/dropflow/beats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          creatorUsername: creatorUsername.trim() || undefined,
          title: title.trim() || "Untitled",
          description: description.trim(),
          tags,
          thumbnailUrl: thumbnailUrl || undefined,
          originalFileUrl,
          ...(isFreeTrack ? { isFree: true } : { priceCents }),
          ...(originalS3Key ? { originalS3Key } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to create." });
        setSaving(false);
        return;
      }
      const beatId = data.beat?.beatId ?? null;
      setCreatedBeatId(beatId);
      setPreviewReady(false);
      setPreviewLongWait(false);
      setMessage({ type: "success", text: "Track created. Generating preview…" });
      // Keep thumbnail/track in the form until preview is ready so fields still show what you uploaded.
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload or create failed.";
      const hint =
        msg === "Failed to fetch"
          ? " Network error—often caused by S3 CORS. Run scripts/set-dropflow-bucket-cors.sh then try again."
          : "";
      setMessage({
        type: "error",
        text: msg + hint,
      });
    }
    setSaving(false);
  };

  const filesLocked = Boolean(createdBeatId && !previewReady);

  // Gate: must be signed in, have username, and Stripe payouts set up (in Profile).
  if (listGate === "loading" || listGate === "no-auth") {
    if (!authLoading && listGate === "no-auth") {
      router.replace("/login");
      return null;
    }
    return (
      <div className="mx-auto max-w-lg px-4 pt-4 pb-10">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }
  if (listGate === "no-username") {
    return (
      <div className="mx-auto max-w-lg px-4 pt-4 pb-10">
        <h1 className="text-2xl font-semibold text-white">Add a track</h1>
        <p className="mt-4 text-gray-400">
          Set your Dropflow username in <Link href="/dropflow/settings" className="text-dropflow hover:underline">Settings</Link> first, then you can list tracks.
        </p>
        <Link href="/dropflow/settings" className="mt-4 inline-block rounded-lg bg-dropflow px-4 py-2.5 text-sm font-medium text-white hover:bg-dropflow-hover">
          Go to Settings
        </Link>
      </div>
    );
  }
  if (listGate === "no-stripe") {
    return (
      <div className="mx-auto max-w-lg px-4 pt-4 pb-10">
        <h1 className="text-2xl font-semibold text-white">Add a track</h1>
        <p className="mt-4 text-gray-400">
          Set up Stripe payouts in your <Link href="/profile" className="text-dropflow hover:underline">Profile</Link> to list tracks. You can browse without it.
        </p>
        <Link href="/profile" className="mt-4 inline-block rounded-lg bg-dropflow px-4 py-2.5 text-sm font-medium text-white hover:bg-dropflow-hover">
          Set up payouts in Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-10 md:max-w-2xl lg:max-w-2xl">
      <h1 className="text-2xl font-semibold text-white">Add a track</h1>
      <p className="mt-1 text-sm text-gray-400">
        Upload your track, optional thumbnail, then set price and details. Username lives in{" "}
        <Link href="/dropflow/settings" className="text-dropflow hover:underline">
          Settings
        </Link>
        .
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400">Creator username *</label>
          <input
            type="text"
            value={creatorUsername}
            onChange={(e) => setCreatorUsername(e.target.value)}
            placeholder="myartist"
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Track (full file) *</label>
          <p className="mt-0.5 text-xs text-gray-500">
            Upload a file, or paste a YouTube link to import the audio.
          </p>
          <div className="mt-3">
            <YoutubeImportBlock
              target="dropflow_track"
              token={getStoredToken()}
              disabled={filesLocked || !!trackFile}
              variant="dropflow"
              imported={youtubeTrack}
              onImported={(r) => {
                setYoutubeTrack(r);
                setTrackFile(null);
                if (trackPreviewUrl) URL.revokeObjectURL(trackPreviewUrl);
                setTrackPreviewUrl(null);
                if (trackInputRef.current) trackInputRef.current.value = "";
                if (r.title?.trim() && !title.trim()) setTitle(r.title.trim());
              }}
              onClear={() => setYoutubeTrack(null)}
            />
          </div>
          <p className="mt-4 text-xs font-medium text-gray-500">Or upload audio from your device</p>
          <input
            ref={trackInputRef}
            type="file"
            accept=".m4a,.mp3,.wav,.ogg,.aac,.flac,.webm,.opus,.wma,audio/*"
            disabled={filesLocked || !!youtubeTrack}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setTrackFile(file);
              setYoutubeTrack(null);
              if (trackPreviewUrl) URL.revokeObjectURL(trackPreviewUrl);
              setTrackPreviewUrl(file ? URL.createObjectURL(file) : null);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-gray-300 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-100 file:hover:bg-zinc-600 disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-gray-500">
            m4a, mp3, wav, ogg, aac, flac, webm, opus, wma. A 15-second preview is generated in the cloud after you create the
            listing.
          </p>
          {youtubeTrack && !trackFile ? (
            <div className="mt-2">
              <p className="mb-1 text-xs text-gray-500">Imported audio (from S3):</p>
              <audio
                src={youtubeTrack.fileUrl}
                controls
                className="w-full max-w-md"
                preload="metadata"
              />
            </div>
          ) : null}
          {trackPreviewUrl && trackFile && (
            <div className="mt-2">
              <p className="mb-1 text-xs text-gray-500">Audio preview:</p>
              <audio
                src={trackPreviewUrl}
                controls
                className="w-full max-w-md"
                preload="metadata"
              />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Track title"
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Tags (comma or space separated, for search)</label>
          <input
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="drill, chill, futuristic"
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Thumbnail</label>
          <input
            ref={thumbnailInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            disabled={filesLocked}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setThumbnailFile(file);
              if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
              setThumbnailPreviewUrl(file ? URL.createObjectURL(file) : null);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-gray-300 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-100 file:hover:bg-zinc-600 disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-gray-500">Optional. JPEG, PNG, GIF, or WebP.</p>
          {thumbnailPreviewUrl && (
            <div className="mt-2">
              <p className="mb-1 text-xs text-gray-500">Preview:</p>
              <img
                src={thumbnailPreviewUrl}
                alt="Thumbnail preview"
                className="h-24 w-24 rounded-lg border border-white/10 object-cover"
              />
            </div>
          )}
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-surface-elevated/60 p-3">
          <input
            type="checkbox"
            checked={isFreeTrack}
            onChange={(e) => setIsFreeTrack(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-surface text-dropflow focus:ring-dropflow/40"
          />
          <span>
            <span className="block text-sm font-medium text-gray-300">Free track</span>
            <span className="mt-1 block text-xs text-gray-500">
              Anyone with the buy link can play the full track — no payment or sign-in. Great for promos and sharing.
            </span>
          </span>
        </label>
        <div>
          <label className="block text-sm font-medium text-gray-400">Listing price (USD) *</label>
          <div className="mt-1 flex items-center rounded-lg border border-white/10 bg-surface-elevated focus-within:ring-1 focus-within:ring-zinc-500/50 focus-within:border-zinc-500">
            <span className="pl-3 text-gray-400">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              disabled={isFreeTrack}
              aria-label="Listing price in dollars"
              className="w-full bg-transparent px-2 py-2 pr-3 text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {isFreeTrack
              ? "Uncheck “Free track” if you want to sell at $1.00 or more."
              : "Minimum $1.00. Fans pay this amount at checkout."}
          </p>
        </div>
        {message && (
          <p className={message.type === "success" ? "text-green-400 text-sm" : "text-red-400 text-sm"}>
            {message.text}
          </p>
        )}
        {createdBeatId && !previewReady && (
          <div className="space-y-2 text-sm text-gray-400">
            <p className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" aria-hidden />
              Track is being processed. It can take up to 2 minutes. Your uploaded files stay selected above.
            </p>
            <p className="text-gray-500">
              View track will appear only when your 15s preview is ready — same as on the public track page.
            </p>
            {previewLongWait && (
              <p className="text-amber-400/90">
                Still working… You can leave this tab open or check the track later from Dropflow → Creator.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {createdBeatId && previewReady ? (
            <>
              <button
                type="button"
                onClick={handleAddAnotherTrack}
                className="rounded-lg bg-dropflow px-4 py-2.5 font-medium text-white hover:bg-dropflow-hover"
              >
                Add another track
              </button>
              <button
                type="button"
                onClick={() => router.push(`/dropflow/b/${createdBeatId}`)}
                className="rounded-lg border border-dropflow bg-dropflow/10 px-4 py-2.5 font-medium text-dropflow hover:bg-dropflow/20 transition-colors"
              >
                View track
              </button>
            </>
          ) : (
            (!createdBeatId || previewReady) && (
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-dropflow px-4 py-2.5 font-medium text-white hover:bg-dropflow-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Uploading & creating…" : "Create"}
              </button>
            )
          )}
        </div>
      </form>

      <p className="mt-8 text-sm text-gray-500">
        <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link href="/dropflow?mode=creator" className="text-dropflow hover:underline">
            ← Dropflow
          </Link>
          <span className="text-gray-600">·</span>
          <Link href="/dropflow/my-listings" className="text-dropflow hover:underline">
            My tracks
          </Link>
        </span>
      </p>
    </div>
  );
}
