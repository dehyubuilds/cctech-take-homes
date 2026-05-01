"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getStoredToken } from "@/components/AuthProvider";
import { MarkdownContent } from "@/components/MarkdownContent";
import {
  aotqWorkerInstanceStatusDescription,
  aotqWorkerInstanceTransitioning,
} from "@/lib/art-of-the-question/aotq-ec2-instance-ui";
import { AOTQ_MAX_SOURCES_PER_PROJECT } from "@/lib/art-of-the-question/aotq-video-project-limits";
import type { VideoProject, VideoProjectAskTurn, VideoProjectSource } from "@/lib/art-of-the-question/video-project-types";

function authHeaders(): HeadersInit {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function statusStyle(s: VideoProjectSource["status"]): string {
  switch (s) {
    case "ready":
      return "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/35";
    case "processing":
    case "pending":
      return "bg-aotq-muted text-aotq ring-1 ring-aotq/35";
    case "error":
      return "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-300";
  }
}

function transcriptSnippet(src: VideoProjectSource): string {
  if (src.transcriptPreview) return src.transcriptPreview;
  if (src.transcriptText) return `${src.transcriptText.slice(0, 420)}${src.transcriptText.length > 420 ? "…" : ""}`;
  if (src.transcriptS3Key) return "Full transcript stored in S3.";
  return "—";
}

/** Omit the preview block while pending/processing and there is nothing to read yet. */
function hasTranscriptPreviewContent(src: VideoProjectSource): boolean {
  if (Boolean(src.transcriptPreview?.trim())) return true;
  if (Boolean(src.transcriptText?.trim())) return true;
  if (Boolean(src.transcriptS3Key?.trim())) return true;
  return false;
}

function transcriptLineCount(src: VideoProjectSource): number {
  const t = src.transcriptPreview ?? src.transcriptText ?? "";
  if (!t.trim()) return 0;
  return t.split("\n").filter((line) => line.trim().length > 0).length;
}

function DetailsChevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function AotqVideoProjectDetailPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<VideoProject | null>(null);
  const [sources, setSources] = useState<VideoProjectSource[]>([]);
  const [asks, setAsks] = useState<VideoProjectAskTurn[]>([]);
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingSourceId, setRemovingSourceId] = useState<string | null>(null);
  const [removingAllSources, setRemovingAllSources] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastAddNote, setLastAddNote] = useState<string | null>(null);
  const [workerConfigured, setWorkerConfigured] = useState(false);
  const [workerLocalWorker, setWorkerLocalWorker] = useState(false);
  /** True when worker/instance reports local bridge mode (transcription on this computer). */
  const [aotqWebSocketBridge, setAotqWebSocketBridge] = useState(false);
  const [workerLocalWorkerMode, setWorkerLocalWorkerMode] = useState<"worker_url" | "dev_host" | null>(null);
  const [workerState, setWorkerState] = useState<string | null>(null);
  const [workerStartAllowed, setWorkerStartAllowed] = useState(false);
  const [workerStopAllowed, setWorkerStopAllowed] = useState(false);
  const [workerBusy, setWorkerBusy] = useState(false);
  const [workerErr, setWorkerErr] = useState<string | null>(null);
  /** Remote EC2 Whisper pipeline (not localhost worker). */
  const [ec2WhisperRemote, setEc2WhisperRemote] = useState(false);
  /** Instance stopped/stopping/etc. — add + ask are blocked in the UI. */
  const [instanceInhibitsIngest, setInstanceInhibitsIngest] = useState(false);
  const [requeueStuckCount, setRequeueStuckCount] = useState(0);
  const [requeueToWorkerAvailable, setRequeueToWorkerAvailable] = useState(false);
  const [requeueWorkerUrlIsLocalhost, setRequeueWorkerUrlIsLocalhost] = useState(false);
  const [requeueBusy, setRequeueBusy] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const skipTitleBlurSave = useRef(false);
  const aotqWsRef = useRef<WebSocket | null>(null);

  const closeAotqWs = useCallback(() => {
    if (aotqWsRef.current) {
      try {
        aotqWsRef.current.close();
      } catch {
        /* ignore */
      }
      aotqWsRef.current = null;
    }
  }, []);

  const needsPoll = useMemo(
    () => sources.some((s) => s.status === "pending" || s.status === "processing"),
    [sources]
  );

  const workerGateBlocks = ec2WhisperRemote && instanceInhibitsIngest;

  const workerEc2Transitioning = useMemo(
    () => aotqWorkerInstanceTransitioning(workerState),
    [workerState]
  );

  const transcribeBatchProgress = useMemo(() => {
    const inflight = sources.filter((s) => s.status === "pending" || s.status === "processing").length;
    if (inflight === 0) return null;
    const ready = sources.filter((s) => s.status === "ready").length;
    const err = sources.filter((s) => s.status === "error").length;
    const total = sources.length;
    return { total, ready, inflight, err };
  }, [sources]);

  const hasDuplicateYoutubeIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sources) {
      counts.set(s.videoId, (counts.get(s.videoId) ?? 0) + 1);
    }
    for (const n of Array.from(counts.values())) {
      if (n > 1) return true;
    }
    return false;
  }, [sources]);

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      setProject(null);
      return;
    }
    setErr(null);
    const res = await fetch(`/api/art-of-the-question/projects/${encodeURIComponent(projectId)}`, {
      headers: authHeaders(),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || "Could not load project.");
      setProject(null);
      setRequeueStuckCount(0);
      setRequeueToWorkerAvailable(false);
      setRequeueWorkerUrlIsLocalhost(false);
    } else {
      setProject(j.project ?? null);
      setSources(j.sources ?? []);
      setAsks(j.asks ?? []);
      setRequeueStuckCount(typeof j.requeueStuckCount === "number" ? j.requeueStuckCount : 0);
      setRequeueToWorkerAvailable(j.requeueToWorkerAvailable === true);
      setRequeueWorkerUrlIsLocalhost(j.requeueWorkerUrlIsLocalhost === true);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadWorker = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setWorkerErr(null);
    const res = await fetch("/api/art-of-the-question/worker/instance", { headers: authHeaders() });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setWorkerErr(typeof j.error === "string" ? j.error : "Worker status unavailable.");
      setWorkerConfigured(false);
      setWorkerLocalWorker(false);
      setAotqWebSocketBridge(false);
      setWorkerLocalWorkerMode(null);
      setWorkerState(null);
      setWorkerStartAllowed(false);
      setWorkerStopAllowed(false);
      setEc2WhisperRemote(false);
      setInstanceInhibitsIngest(false);
      return;
    }
    if (j.localWorker === true) {
      setWorkerConfigured(true);
      setWorkerLocalWorker(true);
      setAotqWebSocketBridge(j.aotqWebSocketBridge === true);
      setWorkerLocalWorkerMode(j.localWorkerMode === "dev_host" ? "dev_host" : "worker_url");
      setWorkerState(null);
      setWorkerStartAllowed(false);
      setWorkerStopAllowed(false);
      setEc2WhisperRemote(false);
      setInstanceInhibitsIngest(false);
      return;
    }
    setWorkerLocalWorker(false);
    setAotqWebSocketBridge(false);
    setWorkerLocalWorkerMode(null);
    if (typeof j.describeError === "string") setWorkerErr(j.describeError);
    if (j.configured) {
      setWorkerConfigured(true);
      const st = typeof j.state === "string" ? j.state : null;
      setWorkerState(st);
      setEc2WhisperRemote(j.ec2WhisperRemote === true);
      setInstanceInhibitsIngest(j.instanceInhibitsIngest === true);
      if (j.actions && typeof j.actions.startAllowed === "boolean") {
        setWorkerStartAllowed(j.actions.startAllowed);
        setWorkerStopAllowed(Boolean(j.actions.stopAllowed));
      } else {
        setWorkerStartAllowed(st === "stopped");
        setWorkerStopAllowed(st === "running");
      }
    } else {
      setWorkerConfigured(false);
      setWorkerState(null);
      setWorkerStartAllowed(false);
      setWorkerStopAllowed(false);
      setEc2WhisperRemote(j.ec2WhisperRemote === true);
      setInstanceInhibitsIngest(false);
    }
  }, []);

  useEffect(() => {
    void loadWorker();
  }, [loadWorker]);

  useEffect(() => () => closeAotqWs(), [closeAotqWs]);

  useEffect(() => {
    if (!workerConfigured || workerLocalWorker) return;
    if (!needsPoll && !workerGateBlocks && !workerEc2Transitioning) return;
    const ms = workerEc2Transitioning ? 5000 : 8000;
    const id = window.setInterval(() => void loadWorker(), ms);
    return () => window.clearInterval(id);
  }, [workerConfigured, needsPoll, workerLocalWorker, workerGateBlocks, workerEc2Transitioning, loadWorker]);

  useEffect(() => {
    if (!needsPoll) return;
    const id = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(id);
  }, [needsPoll, load]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  const startEditTitle = () => {
    if (!project) return;
    setTitleDraft(project.name);
    setEditingTitle(true);
  };

  const saveTitle = async () => {
    if (!project) return;
    const next = titleDraft.trim() || "Untitled project";
    if (next === project.name) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    setErr(null);
    try {
      const res = await fetch(`/api/art-of-the-question/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error || "Could not update title.");
        return;
      }
      if (j.project) setProject(j.project as VideoProject);
      setEditingTitle(false);
    } finally {
      setSavingTitle(false);
    }
  };

  const cancelEditTitle = () => {
    skipTitleBlurSave.current = true;
    setEditingTitle(false);
    if (project) setTitleDraft(project.name);
  };

  const removeSource = async (sourceId: string) => {
    if (!window.confirm("Remove this source from the project?")) return;
    setRemovingSourceId(sourceId);
    setErr(null);
    try {
      const res = await fetch(
        `/api/art-of-the-question/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(sourceId)}`,
        { method: "DELETE", headers: authHeaders() }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error || "Could not remove source.");
        return;
      }
      await load();
    } finally {
      setRemovingSourceId(null);
    }
  };

  const removeAllSources = async () => {
    const token = getStoredToken();
    if (!token || sources.length === 0) return;
    if (
      !window.confirm(
        `Remove all ${sources.length} video source(s)? This also clears Ask history for this project.`
      )
    ) {
      return;
    }
    setRemovingAllSources(true);
    setErr(null);
    try {
      const res = await fetch(`/api/art-of-the-question/projects/${encodeURIComponent(projectId)}/sources`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error || "Could not remove all sources.");
        return;
      }
      setLastAddNote(
        typeof j.removed === "number" && j.removed > 0
          ? `Removed ${j.removed} source(s). You can add videos or a playlist again.`
          : "No sources to remove."
      );
      await load();
    } finally {
      setRemovingAllSources(false);
    }
  };

  const addSource = async () => {
    const token = getStoredToken();
    if (!token) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (!url.trim()) return;
    closeAotqWs();
    setAdding(true);
    setLastAddNote(null);
    setErr(null);
    try {
      const res = await fetch(`/api/art-of-the-question/projects/${encodeURIComponent(projectId)}/sources`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: url.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error || "Add failed.");
        return;
      }
      setUrl("");
      type WsReg = { jobId: string; registerToken: string };
      const wsRegs: WsReg[] = [];
      const wsUrlRaw = typeof j.wsUrl === "string" ? j.wsUrl : "";
      if (j.batch === true && Array.isArray(j.localWebSocketRegistrations) && wsUrlRaw) {
        for (const r of j.localWebSocketRegistrations as { localWsJobId?: string; registerToken?: string }[]) {
          if (r.localWsJobId && r.registerToken) {
            wsRegs.push({ jobId: r.localWsJobId, registerToken: r.registerToken });
          }
        }
      } else if (typeof j.localWsJobId === "string" && j.registerToken && wsUrlRaw) {
        wsRegs.push({ jobId: j.localWsJobId, registerToken: String(j.registerToken) });
      }
      if (wsRegs.length > 0 && wsUrlRaw) {
        try {
          const ws = new WebSocket(wsUrlRaw);
          aotqWsRef.current = ws;
          ws.onopen = () => {
            for (const r of wsRegs) {
              ws.send(JSON.stringify({ action: "register", jobId: r.jobId, registerToken: r.registerToken }));
            }
          };
          ws.onmessage = (ev) => {
            let o: { type?: string; message?: string };
            try {
              o = JSON.parse(String(ev.data)) as typeof o;
            } catch {
              return;
            }
            if (o.type === "error" && o.message) {
              setErr(String(o.message));
            }
          };
        } catch {
          setErr("Could not connect for transcription updates. Try again in a moment.");
        }
      }
      if (j.batch === true && j.summary) {
        const sum = j.summary as {
          added: number;
          skippedDuplicate: number;
          skippedPrivate?: number;
          skippedDeleted?: number;
          skippedLimit: boolean;
        };
        const tail = sum.skippedLimit
          ? ` Stopped at ${AOTQ_MAX_SOURCES_PER_PROJECT} sources per project.`
          : "";
        const priv = sum.skippedPrivate ?? 0;
        const del = sum.skippedDeleted ?? 0;
        const vis =
          priv + del > 0
            ? ` ${priv} private and ${del} unavailable entries were skipped before queueing.`
            : "";
        setLastAddNote(
          `Playlist: added ${sum.added} video(s); ${sum.skippedDuplicate} skipped (already in project).${vis}${tail}`
        );
        if (j.ingestMode === "local_websocket_async") {
          setLastAddNote(
            (prev) => `${prev} Transcription will run on this computer when your local setup is running.`
          );
        } else if (j.ingestMode === "ec2_whisper_async" || j.queuedEc2Worker) {
          setLastAddNote(
            (prev) => `${prev} Queued for Whisper in the cloud — status updates when each job finishes.`
          );
        } else if (j.ingestMode === "lambda_async" || j.queuedLambda) {
          setLastAddNote((prev) => `${prev} Transcription queued for new sources.`);
        } else {
          setLastAddNote((prev) => `${prev} YouTube captions used where available.`);
        }
      } else if (j.ingestMode === "local_websocket_async") {
        setLastAddNote("Added. Transcription runs on this computer (not YouTube captions).");
      } else if (j.ingestMode === "ec2_whisper_async" || j.queuedEc2Worker) {
        setLastAddNote(
          "Queued for Whisper in the cloud. If the transcription machine is off, start it from this page; status updates when the job finishes."
        );
      } else if (j.ingestMode === "lambda_async" || j.queuedLambda) {
        setLastAddNote("Transcription is queued — status will update shortly.");
      } else {
        setLastAddNote("Transcript came from YouTube captions (quick preview, not Whisper).");
      }
      await load();
    } finally {
      setAdding(false);
    }
  };

  const ask = async () => {
    const token = getStoredToken();
    if (!token) return;
    if (!prompt.trim()) return;
    setAsking(true);
    setErr(null);
    try {
      const res = await fetch(`/api/art-of-the-question/projects/${encodeURIComponent(projectId)}/ask`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof j.detail === "string" && j.detail.trim() ? `${j.error || "Ask failed."} — ${j.detail}` : j.error || "Ask failed.";
        setErr(msg);
        return;
      }
      if (j.turn) {
        setAsks((prev) => [j.turn as VideoProjectAskTurn, ...prev]);
        setPrompt("");
      }
      await load();
    } finally {
      setAsking(false);
    }
  };

  const removeProject = async () => {
    if (!window.confirm("Delete this project and all sources / Q&A stored under it?")) return;
    const token = getStoredToken();
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/art-of-the-question/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) {
        window.location.href = "/art-of-the-question/projects";
      } else {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "Delete failed.");
      }
    } finally {
      setDeleting(false);
    }
  };

  const token = typeof window !== "undefined" ? getStoredToken() : null;

  if (!token && !loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Link href="/art-of-the-question/projects" className="text-sm text-aotq hover:text-aotq-hover">
          ← Projects
        </Link>
        <p className="mt-8 text-sm text-zinc-400">Sign in to view this project.</p>
        <Link
          href={`/login?redirect=${encodeURIComponent(window.location.pathname)}`}
          className="mt-4 inline-flex rounded-xl bg-aotq px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-aotq-hover"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-sm text-zinc-500 sm:px-6">Loading…</div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-sm text-zinc-400 sm:px-6">
        <p>{err || "Project not found."}</p>
        <Link href="/art-of-the-question/projects" className="mt-6 inline-block text-aotq hover:underline">
          ← Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href="/art-of-the-question/projects" className="text-aotq hover:text-aotq-hover">
          ← All projects
        </Link>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void removeProject()}
          className="text-xs text-zinc-500 underline-offset-2 hover:text-rose-300 hover:underline disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete project"}
        </button>
      </nav>

      <header className="mt-10 border-b border-white/[0.08] pb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Project</p>
        {editingTitle ? (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              maxLength={200}
              disabled={savingTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveTitle();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEditTitle();
                }
              }}
              onBlur={() => {
                if (skipTitleBlurSave.current) {
                  skipTitleBlurSave.current = false;
                  return;
                }
                void saveTitle();
              }}
              className="min-w-0 flex-1 rounded-xl border border-aotq/35 bg-black/50 px-4 py-2.5 font-serif text-2xl font-medium tracking-tight text-aotq focus:border-aotq/60 focus:outline-none disabled:opacity-60 sm:text-3xl"
              aria-label="Project title"
            />
            <span className="text-xs text-zinc-500">Enter to save · Esc to cancel</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => startEditTitle()}
            className="group mt-2 block w-full text-left"
            title="Edit project title"
          >
            <span className="font-serif text-3xl font-semibold tracking-tight text-aotq/90 group-hover:text-aotq sm:text-4xl">
              {project.name}
            </span>
            <span className="ml-2 inline text-sm font-normal text-zinc-500 opacity-0 transition group-hover:opacity-100">
              Edit
            </span>
          </button>
        )}
        <p className="mt-2 font-mono text-[11px] text-zinc-600">{project.projectId}</p>
      </header>

      {err && (
        <p className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {err}
        </p>
      )}
      {lastAddNote && !err && (
        <p className="mt-5 text-xs font-medium text-aotq/90">{lastAddNote}</p>
      )}

      {workerGateBlocks && (
        <div className="mt-6 rounded-2xl border border-amber-500/35 bg-amber-950/25 px-4 py-4 text-sm text-amber-50/95">
          <p className="font-semibold text-amber-100">Transcription worker is off</p>
          <p className="mt-2 text-xs leading-relaxed text-amber-100/85">
            This deployment uses Whisper on EC2. While the instance is stopped, you cannot add videos, import playlists, or use Ask.
            Use <span className="font-medium">Start instance</span> below, wait until the state shows <span className="font-mono">running</span>, then continue.
          </p>
        </div>
      )}

      <section className="mt-8 rounded-2xl border border-aotq/25 bg-[#140a10] p-5 ring-1 ring-aotq/10 sm:p-6">
        <h2 className="text-sm font-semibold text-white">
          Transcription
          {workerLocalWorker ? (aotqWebSocketBridge ? " (this computer)" : " (local)") : " (cloud)"}
        </h2>
        {workerConfigured ? (
          workerLocalWorker ? (
            <>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {aotqWebSocketBridge ? (
                  <>
                    Whisper runs on this computer. Keep whatever local transcription helper your team uses running in the
                    background while you add videos or playlists.
                  </>
                ) : workerLocalWorkerMode === "dev_host" ? (
                  <>
                    You are in local development, so cloud start/stop is hidden. If this project uses Whisper, run your
                    local transcription setup and point the app at it in your developer environment settings.
                  </>
                ) : (
                  <>Transcription is pointed at this machine. Start or stop your worker from the terminal when needed.</>
                )}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-zinc-500">
                Start before enqueueing Whisper jobs; stop when idle to save cost. Instance ID comes from server configuration.
              </p>
              {workerErr ? (
                <p className="mt-3 text-xs text-amber-200/90">{workerErr}</p>
              ) : (
                <div className="mt-3 space-y-2 text-xs text-zinc-400">
                  <p>
                    <span className="text-zinc-500">AWS state:</span>{" "}
                    <span className="font-mono text-aotq/85">{workerState ?? "—"}</span>
                  </p>
                  {workerState ? (
                    <p className="leading-relaxed text-zinc-400/95">{aotqWorkerInstanceStatusDescription(workerState)}</p>
                  ) : null}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={workerBusy || !workerStartAllowed}
                  title={
                    workerStartAllowed
                      ? "Start the transcription worker EC2 instance"
                      : workerState === "pending"
                        ? "Instance is already starting — wait until Running"
                        : workerState === "stopping" || workerState === "shutting-down"
                          ? "Wait until the instance is fully stopped before starting again"
                          : workerState === "running"
                            ? "Instance is already running — use Stop when idle"
                            : "Start is only available when the instance is stopped"
                  }
                  onClick={() => {
                    setWorkerBusy(true);
                    setWorkerErr(null);
                    void (async () => {
                      try {
                        const res = await fetch("/api/art-of-the-question/worker/instance", {
                          method: "POST",
                          headers: { ...authHeaders(), "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "start" }),
                        });
                        const j = await res.json().catch(() => ({}));
                        if (!res.ok) setWorkerErr(j.error || "Start failed.");
                        else if (typeof j.state === "string") setWorkerState(j.state);
                        await loadWorker();
                      } finally {
                        setWorkerBusy(false);
                      }
                    })();
                  }}
                  className="rounded-xl bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {workerBusy ? "…" : "Start instance"}
                </button>
                <button
                  type="button"
                  disabled={workerBusy || !workerStopAllowed}
                  title={
                    workerStopAllowed
                      ? "Stop the instance to save cost (ingest will be blocked until you start again)"
                      : workerState === "pending"
                        ? "Stop is disabled while the instance is still starting — wait for Running"
                        : workerState === "stopping" || workerState === "shutting-down"
                          ? "Instance is already stopping"
                          : workerState === "stopped"
                            ? "Instance is already stopped"
                            : "Stop is only available when the instance is running"
                  }
                  onClick={() => {
                    setWorkerBusy(true);
                    setWorkerErr(null);
                    void (async () => {
                      try {
                        const res = await fetch("/api/art-of-the-question/worker/instance", {
                          method: "POST",
                          headers: { ...authHeaders(), "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "stop" }),
                        });
                        const j = await res.json().catch(() => ({}));
                        if (!res.ok) setWorkerErr(j.error || "Stop failed.");
                        else if (typeof j.state === "string") setWorkerState(j.state);
                        await loadWorker();
                      } finally {
                        setWorkerBusy(false);
                      }
                    })();
                  }}
                  className="rounded-xl bg-white/[0.08] px-4 py-2 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/12 disabled:opacity-50"
                >
                  {workerBusy ? "…" : "Stop instance"}
                </button>
                <button
                  type="button"
                  disabled={workerBusy}
                  onClick={() => void loadWorker()}
                  className="rounded-xl px-3 py-2 text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline disabled:opacity-50"
                >
                  Refresh state
                </button>
              </div>
            </>
          )
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            <span className="font-medium text-zinc-300">Cloud start / stop is not set up</span> for this deployment. New
            videos use <span className="text-zinc-200">YouTube captions</span> until your team enables Whisper on a worker
            and wires instance controls in configuration.
          </p>
        )}
        {requeueToWorkerAvailable ? (
          <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-950/15 px-4 py-3">
            <p className="text-xs font-medium text-amber-100/95">Re-send jobs to current worker</p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-100/75">
              {requeueStuckCount} source{requeueStuckCount === 1 ? "" : "s"} still pending or processing will be sent again
              to the configured transcription worker. If you switched from a computer worker to cloud, stop the local one
              first so the same job is not running twice.
              {requeueWorkerUrlIsLocalhost ? (
                <> The app is still pointed at this computer for transcription — switch to cloud in settings before
                re-sending if you intend to use the cloud worker.</>
              ) : null}
            </p>
            <button
              type="button"
              disabled={requeueBusy || workerGateBlocks}
              title={
                workerGateBlocks
                  ? "Start the EC2 instance before requeueing when using remote Whisper."
                  : undefined
              }
              onClick={() => {
                if (
                  !window.confirm(
                    `Re-send ${requeueStuckCount} job(s) to the transcription worker?\n\nIf you moved from a computer worker to the cloud, stop the local one first so work is not duplicated. Continue?`
                  )
                ) {
                  return;
                }
                setRequeueBusy(true);
                setErr(null);
                void (async () => {
                  try {
                    const res = await fetch(
                      `/api/art-of-the-question/projects/${encodeURIComponent(projectId)}/requeue-worker`,
                      { method: "POST", headers: authHeaders() }
                    );
                    const j = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      setErr(j.error || "Requeue failed.");
                      return;
                    }
                    const rq = typeof j.requeued === "number" ? j.requeued : 0;
                    const fl = Array.isArray(j.failed) ? j.failed.length : 0;
                    setLastAddNote(
                      fl > 0
                        ? `Requeue: ${rq} ok, ${fl} failed (see source errors).`
                        : `Requeue: sent ${rq} job(s) to the worker.`
                    );
                    await load();
                    await loadWorker();
                  } finally {
                    setRequeueBusy(false);
                  }
                })();
              }}
              className="mt-3 rounded-lg bg-amber-500/25 px-3 py-2 text-xs font-semibold text-amber-50 ring-1 ring-amber-400/35 hover:bg-amber-500/35 disabled:opacity-50"
            >
              {requeueBusy ? "Requeueing…" : `Re-send ${requeueStuckCount} job(s) to worker`}
            </button>
          </div>
        ) : null}
      </section>

      <section className="mt-12 rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6 sm:p-7">
        <h2 className="text-sm font-semibold text-white">Add YouTube</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Paste one video link or a whole playlist (watch, youtu.be, or playlist links). Imports stop at your project limit.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={workerGateBlocks}
            placeholder="Video or playlist URL…"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-aotq/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="button"
            disabled={adding || workerGateBlocks}
            onClick={() => void addSource()}
            className="shrink-0 rounded-xl bg-white/[0.08] px-5 py-2.5 text-sm font-medium text-white ring-1 ring-white/10 hover:bg-white/12 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add source"}
          </button>
        </div>
        {workerGateBlocks ? (
          <p className="mt-3 text-xs text-amber-200/80">Add source is disabled until the EC2 worker instance is running.</p>
        ) : null}
      </section>

      <section className="mt-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Sources</h2>
          {sources.length > 0 ? (
            <button
              type="button"
              disabled={removingAllSources}
              onClick={() => void removeAllSources()}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-rose-300/95 ring-1 ring-rose-500/25 hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
            >
              {removingAllSources ? "Removing…" : "Remove all sources"}
            </button>
          ) : null}
        </div>
        {transcribeBatchProgress && (
          <p className="mt-4 rounded-xl border border-aotq/25 bg-[#140a10] px-4 py-3 text-xs leading-relaxed text-aotq/90 ring-1 ring-aotq/10">
            <span className="font-semibold text-aotq">Transcription progress</span>
            {": "}
            {transcribeBatchProgress.ready} ready, {transcribeBatchProgress.inflight} still processing
            {transcribeBatchProgress.err > 0 ? `, ${transcribeBatchProgress.err} failed` : ""}
            {" — "}
            {transcribeBatchProgress.total} source{transcribeBatchProgress.total === 1 ? "" : "s"} in this project. Jobs run one at a time on the worker so long videos finish reliably.
          </p>
        )}
        {hasDuplicateYoutubeIds && (
          <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100/95">
            The same YouTube video appears more than once (for example the URL was added twice).{" "}
            <span className="font-medium text-amber-50">Ask</span> only sends one transcript per video to the model,
            but you can remove extra cards below to tidy the list.
          </p>
        )}
        <ul className="mt-5 space-y-4">
          {sources.length === 0 ? (
            <li className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
              No videos yet.
            </li>
          ) : (
            sources.map((s) => {
              const transcriptLines = transcriptLineCount(s);
              return (
                <li
                  key={s.sourceId}
                  className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-zinc-900/55 to-zinc-950/30 p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold leading-snug text-white">{s.title || s.videoId}</p>
                      {s.channelTitle ? <p className="mt-0.5 text-xs text-zinc-500">{s.channelTitle}</p> : null}
                      <a
                        href={s.youtubeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block truncate text-xs text-aotq/80 hover:text-aotq"
                      >
                        {s.youtubeUrl}
                      </a>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${statusStyle(s.status)}`}>
                        {s.status}
                      </span>
                      <button
                        type="button"
                        disabled={removingSourceId === s.sourceId || removingAllSources}
                        onClick={() => void removeSource(s.sourceId)}
                        className="text-[11px] text-zinc-500 underline-offset-2 hover:text-rose-300 hover:underline disabled:opacity-50"
                      >
                        {removingSourceId === s.sourceId ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  </div>
                  {s.durationSeconds != null ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      ~{Math.round(s.durationSeconds / 60)} min (approx. span from segment timestamps)
                    </p>
                  ) : null}
                  {s.errorMessage ? (
                    <p className="mt-2 text-xs text-rose-300/90">{s.errorMessage}</p>
                  ) : hasTranscriptPreviewContent(s) ? (
                    <details className="group mt-4 rounded-xl border border-white/[0.08] bg-black/25 open:border-white/[0.12] open:bg-black/40">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-medium text-zinc-400 marker:content-none [&::-webkit-details-marker]:hidden hover:text-zinc-200">
                        <DetailsChevron className="shrink-0 text-zinc-500 transition-transform group-open:rotate-90" />
                        <span>Full transcript preview</span>
                        {transcriptLines > 0 ? (
                          <span className="font-normal text-zinc-600">
                            · {transcriptLines} line{transcriptLines === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </summary>
                      <div className="max-h-52 overflow-y-auto border-t border-white/[0.06] px-4 py-3">
                        <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-400">
                          {transcriptSnippet(s)}
                        </p>
                      </div>
                    </details>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="mt-16 rounded-2xl border border-aotq/25 bg-gradient-to-br from-[#1a0812] via-zinc-950/20 to-transparent p-6 shadow-[0_28px_90px_-28px_rgba(244,114,182,0.18)] ring-1 ring-aotq/10 sm:p-7">
        <h2 className="text-lg font-semibold text-white">Ask across the project</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Each question uses every ready transcript as the source of truth for the videos. Follow-ups work automatically:
          when you send again, the model also receives your recent Q&amp;A from this page (up to several turns), so you can
          say things like &quot;go deeper on that&quot; or &quot;compare that to the AgentCore memory episode&quot; without pasting the
          prior answer. Video facts still must match the transcripts, not an earlier reply if they disagree.
        </p>

        {asks.length > 0 ? (
          <div className="mt-8 border-t border-white/10 pt-8">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Conversation (oldest first)</h3>
            <p className="mt-2 text-[11px] text-zinc-600">
              {asks.length} saved turn{asks.length === 1 ? "" : "s"} — full question and answer for each (nothing collapsed here).
              Transcripts stay under each source in &quot;Full transcript preview&quot; if you want less scroll.
            </p>
            <ul className="mt-4 space-y-6">
              {[...asks].reverse().map((a) => (
                <li key={a.askId} className="text-sm">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {new Date(a.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-2 font-medium text-aotq/90">{a.prompt}</p>
                  <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/30 p-4">
                    <MarkdownContent>{a.answer}</MarkdownContent>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={asks.length > 0 ? "mt-8 border-t border-white/10 pt-8" : "mt-6"}>
          <p className="text-sm font-medium text-zinc-200">
            {asks.length > 0 ? "Follow-up or new question" : "Your question"}
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={workerGateBlocks}
            rows={4}
            placeholder={
              asks.length > 0
                ? "e.g. Expand the last answer, ask for citations, or change topic — prior turns are included automatically."
                : "What themes repeat? Summarize objections. Pull exact quotes about pricing…"
            }
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-aotq/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="button"
            disabled={asking || workerGateBlocks}
            onClick={() => void ask()}
            className="mt-4 rounded-xl bg-aotq px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-aotq-hover disabled:opacity-50"
          >
            {asking ? "Thinking…" : asks.length > 0 ? "Send follow-up" : "Ask"}
          </button>
          {workerGateBlocks ? (
            <p className="mt-3 text-xs text-amber-200/80">Ask is disabled until the EC2 worker instance is running.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
