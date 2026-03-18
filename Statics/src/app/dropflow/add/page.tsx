"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useLayoutEffect, useRef } from "react";

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

export default function AddBeatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creatorUsername, setCreatorUsername] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [trackFile, setTrackFile] = useState<File | null>(null);
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

  // Restore form from sessionStorage and optional ?username= from Creator link so details show instantly.
  useLayoutEffect(() => {
    const fromUrl = searchParams?.get("username")?.trim();
    setCreatorUsername(fromUrl || getStored("username"));
    setTitle(getStored("title"));
    setDescription(getStored("description"));
    setTagsStr(getStored("tags"));
  }, [searchParams]);

  // Fetch profile and set username (API overrides stored value so checkmark state is correct).
  useEffect(() => {
    const uid = typeof window !== "undefined" ? localStorage.getItem("dropflow_userId") ?? "" : "";
    if (!uid) return;
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
  }, []);

  // Persist form fields so they survive navigation (e.g. "← Dropflow" then "Add a song or beat" again).
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
    if (
      !creatorUsername.trim() ||
      creatorUsername.trim().length < 2 ||
      !title.trim() ||
      !trackFile
    ) {
      setMessage({
        type: "error",
        text: "Fill in creator username, title, and select a track file before creating.",
      });
      return;
    }
    setSaving(true);
    const userId = typeof window !== "undefined" ? localStorage.getItem("dropflow_userId") ?? "" : "";
    try {
      let thumbnailUrl = "";
      if (thumbnailFile) {
        const th = await uploadFile("thumbnail", thumbnailFile);
        thumbnailUrl = th.fileUrl;
      }
      const trackUp = await uploadFile("track", trackFile);
      const originalFileUrl = trackUp.fileUrl;
      const originalS3Key = trackUp.key;

      const tags = tagsStr.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
      const res = await fetch("/api/dropflow/beats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || undefined,
          creatorUsername: creatorUsername.trim() || undefined,
          title: title.trim() || "Untitled",
          description: description.trim(),
          tags,
          thumbnailUrl: thumbnailUrl || undefined,
          originalFileUrl,
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

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:max-w-2xl lg:max-w-2xl">
      <h1 className="text-2xl font-semibold text-white">Add a song or beat</h1>
      <p className="mt-1 text-sm text-gray-400">
        Set your username in <Link href="/dropflow/settings" className="text-brand hover:underline">Settings</Link> first when adding songs or beats.
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
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Summer vibes"
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Tags (comma or space separated, for search)</label>
          <input
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="drill, chill, 2024"
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
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
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1 file:text-white file:text-sm disabled:opacity-60"
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
        <div>
          <label className="block text-sm font-medium text-gray-400">Track (full file) *</label>
          <input
            ref={trackInputRef}
            type="file"
            accept=".m4a,.mp3,.wav,.ogg,.aac,.flac,.webm,.opus,.wma,audio/*"
            disabled={filesLocked}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setTrackFile(file);
              if (trackPreviewUrl) URL.revokeObjectURL(trackPreviewUrl);
              setTrackPreviewUrl(file ? URL.createObjectURL(file) : null);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1 file:text-white file:text-sm disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-gray-500">m4a, mp3, wav, ogg, aac, flac, webm, opus, wma. A 15-second preview is generated in the cloud after upload.</p>
          {trackPreviewUrl && trackFile && (
            <div className="mt-2">
              <p className="mb-1 text-xs text-gray-500">Preview:</p>
              <audio
                src={trackPreviewUrl}
                controls
                className="w-full max-w-md"
                preload="metadata"
              />
            </div>
          )}
        </div>
        {message && (
          <p className={message.type === "success" ? "text-green-400 text-sm" : "text-red-400 text-sm"}>
            {message.text}
          </p>
        )}
        {createdBeatId && !previewReady && (
          <div className="space-y-2 text-sm text-gray-400">
            <p className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden />
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
                className="rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-hover"
              >
                Add another track
              </button>
              <button
                type="button"
                onClick={() => router.push(`/dropflow/b/${createdBeatId}`)}
                className="rounded-lg border border-brand bg-brand/10 px-4 py-2.5 font-medium text-brand hover:bg-brand/20 transition-colors"
              >
                View track
              </button>
            </>
          ) : (
            (!createdBeatId || previewReady) && (
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Uploading & creating…" : "Create"}
              </button>
            )
          )}
        </div>
      </form>

      <p className="mt-8 text-sm text-gray-500">
        <Link href="/dropflow?mode=creator" className="text-brand hover:underline">← Dropflow</Link>
      </p>
    </div>
  );
}
