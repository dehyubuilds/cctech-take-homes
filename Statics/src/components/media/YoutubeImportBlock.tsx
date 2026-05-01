"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type YoutubeImportResult = {
  fileUrl: string;
  s3Key: string;
  title?: string;
  thumbnailUrl?: string | null;
};

type Target = "dropflow_track" | "pc_video";

export function YoutubeImportBlock(props: {
  target: Target;
  token: string | null;
  disabled?: boolean;
  variant: "dropflow" | "pc";
  onImported: (r: YoutubeImportResult) => void;
  onClear: () => void;
  imported: YoutubeImportResult | null;
  /** Input placeholder (default depends on target). */
  urlPlaceholder?: string;
}) {
  const { target, token, disabled, variant, onImported, onClear, imported, urlPlaceholder } = props;
  const [capable, setCapable] = useState<boolean | null>(null);
  /** From GET ?capability=1 — max POST starts per user per UTC day. */
  const [dailyLimit, setDailyLimit] = useState(3);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [progressSnap, setProgressSnap] = useState<{
    phase?: string;
    progressPercent?: number;
    durationSeconds?: number;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const doneRef = useRef(false);
  const busyStartedAtRef = useRef<number>(0);

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
  }, []);

  function formatClock(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  const border =
    variant === "dropflow" ? "border-dropflow/30 bg-dropflow/5" : "border-pc/30 bg-pc/5";
  const label = variant === "dropflow" ? "text-dropflow" : "text-pc";
  const btn =
    variant === "dropflow"
      ? "bg-dropflow hover:bg-dropflow-hover text-white"
      : "bg-pc text-black hover:opacity-90";

  const clearPoll = useCallback(() => {
    closeWs();
    if (pollRef.current != null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [closeWs]);

  useEffect(() => {
    fetch("/api/youtube-import?capability=1")
      .then((r) => r.json())
      .then(
        (d: {
          youtubeImportEnabled?: boolean;
          youtubeImportDropflowEnabled?: boolean;
          youtubeImportPcVideoEnabled?: boolean;
          youtubeImportDailyLimit?: number;
        }) => {
          const pcOk =
            typeof d.youtubeImportPcVideoEnabled === "boolean"
              ? d.youtubeImportPcVideoEnabled
              : !!d.youtubeImportEnabled;
          const dropOk =
            typeof d.youtubeImportDropflowEnabled === "boolean"
              ? d.youtubeImportDropflowEnabled
              : !!d.youtubeImportEnabled;
          setCapable(target === "pc_video" ? pcOk : dropOk);
          if (typeof d.youtubeImportDailyLimit === "number" && Number.isFinite(d.youtubeImportDailyLimit)) {
            setDailyLimit(Math.max(1, Math.min(100, Math.floor(d.youtubeImportDailyLimit))));
          }
        }
      )
      .catch(() => setCapable(false));
  }, [target]);

  useEffect(() => {
    if (!imported) doneRef.current = false;
  }, [imported]);

  useEffect(() => () => clearPoll(), [clearPoll]);

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const pollJob = useCallback(
    async (jobId: string, auth: string) => {
      if (doneRef.current) return;
      const r = await fetch(`/api/youtube-import?jobId=${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${auth}` },
        cache: "no-store",
      });
      const st = (await r.json().catch(() => ({}))) as {
        status?: string;
        phase?: string;
        progressPercent?: number;
        durationSeconds?: number;
        fileUrl?: string;
        s3Key?: string;
        title?: string;
        thumbnailUrl?: string;
        error?: string;
      };
      if (!r.ok) {
        doneRef.current = true;
        clearPoll();
        setBusy(false);
        setProgressSnap(null);
        setErr(
          typeof st.error === "string" && st.error
            ? st.error
            : `Could not read import status (${r.status}). Try signing in again.`
        );
        return;
      }
      if (st.status === "completed" && st.fileUrl && st.s3Key) {
        doneRef.current = true;
        clearPoll();
        setBusy(false);
        setProgressSnap(null);
        setUrl("");
        setErr(null);
        onImported({
          fileUrl: st.fileUrl,
          s3Key: st.s3Key,
          title: st.title,
          thumbnailUrl: st.thumbnailUrl ?? null,
        });
        return;
      }
      if (st.status === "failed") {
        doneRef.current = true;
        clearPoll();
        setBusy(false);
        setProgressSnap(null);
        setErr(st.error || "Import failed.");
        return;
      }
      if (st.status === "processing" || st.status === "pending") {
        setProgressSnap({
          phase: st.phase,
          progressPercent: st.progressPercent,
          durationSeconds: st.durationSeconds,
        });
      }
    },
    [clearPoll, onImported]
  );

  const startImport = useCallback(async () => {
    if (!token || disabled || imported || capable === false) return;
    closeWs();
    const trimmed = url.trim();
    if (!trimmed) {
      setErr("Paste a YouTube link first.");
      return;
    }
    doneRef.current = false;
    busyStartedAtRef.current = Date.now();
    setProgressSnap(null);
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/youtube-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ youtubeUrl: trimmed, target }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        jobId?: string;
        error?: string;
        detail?: string;
        limit?: number;
        used?: number;
        youtubeImportBackend?: string;
        wsUrl?: string;
        registerToken?: string;
      };
      if (!res.ok) {
        const parts = [data.error || "Could not start import.", data.detail].filter(Boolean);
        if (res.status === 429 && typeof data.limit === "number") {
          parts.push(`Limit: ${data.limit}/UTC day${typeof data.used === "number" ? ` (used ${data.used})` : ""}.`);
        }
        setErr(parts.join(" "));
        setBusy(false);
        setProgressSnap(null);
        return;
      }
      const jobId = data.jobId;
      if (!jobId) {
        setErr("No job id returned.");
        setBusy(false);
        setProgressSnap(null);
        return;
      }
      if (
        data.youtubeImportBackend === "local_websocket" &&
        typeof data.wsUrl === "string" &&
        data.wsUrl &&
        typeof data.registerToken === "string" &&
        data.registerToken
      ) {
        try {
          const ws = new WebSocket(data.wsUrl);
          wsRef.current = ws;
          ws.onopen = () => {
            ws.send(
              JSON.stringify({
                action: "register",
                jobId,
                registerToken: data.registerToken,
              })
            );
          };
          ws.onmessage = (ev) => {
            let o: { type?: string; jobId?: string; percent?: number; phase?: string; message?: string };
            try {
              o = JSON.parse(String(ev.data)) as typeof o;
            } catch {
              return;
            }
            if (o.jobId && o.jobId !== jobId) return;
            if (o.type === "progress" && typeof o.percent === "number") {
              setProgressSnap((prev) => ({
                ...prev,
                phase: "download",
                progressPercent: Math.max(0, Math.min(99, Math.round(o.percent!))),
              }));
            }
            if (o.type === "phase" && typeof o.phase === "string") {
              setProgressSnap((prev) => ({ ...prev, phase: o.phase }));
            }
            if (o.type === "error" && o.message) {
              setErr(String(o.message));
            }
          };
        } catch {
          setErr("Could not connect for this import. Try again.");
        }
      }
      await pollJob(jobId, token);
      pollRef.current = setInterval(() => {
        void pollJob(jobId, token);
      }, 2500);
    } catch {
      closeWs();
      setErr("Network error.");
      setBusy(false);
      setProgressSnap(null);
    }
  }, [token, disabled, imported, url, target, pollJob, capable, closeWs]);

  if (capable === null) {
    return <p className="text-xs text-gray-500">Checking YouTube import…</p>;
  }

  const importDisabledByConfig = capable === false;

  const defaultPlaceholder =
    target === "dropflow_track"
      ? "https://youtu.be/… or https://www.youtube.com/watch?v=…"
      : "https://www.youtube.com/watch?v=…";
  const inputPlaceholder = urlPlaceholder ?? defaultPlaceholder;

  const headline =
    target === "dropflow_track"
      ? "Import audio from YouTube"
      : "Import video from YouTube (MP4, up to 1080p when available)";

  return (
    <div className={`rounded-lg border p-4 ${border}`}>
      <p className={`text-sm font-medium ${label}`}>{headline}</p>
      <p className="mt-1 text-xs text-gray-500">
        Only use content you own or have rights to sell or distribute. Some links may not work. Imports can take a
        minute or longer. Each account can start up to <span className="text-gray-400">{dailyLimit}</span> import
        {dailyLimit === 1 ? "" : "s"} per calendar day (UTC); each attempt counts toward that limit, even if the import
        does not finish.
      </p>
      {importDisabledByConfig ? (
        <p className="mt-2 text-xs leading-relaxed text-amber-200/90">
          {target === "dropflow_track"
            ? "YouTube import isn’t available here right now. Upload an audio file instead, or try again later."
            : "YouTube video import isn’t available here right now. Try again later or use another upload option."}
        </p>
      ) : null}
      {imported ? (
        <div className="mt-3 space-y-2 text-sm text-gray-300">
          <p>
            <span className="text-green-400/95">Ready:</span>{" "}
            {imported.title ? <span className="font-medium text-white">{imported.title}</span> : "File imported."}
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onClear();
              setErr(null);
            }}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-50"
          >
            Remove import (use file upload instead)
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor={`yt-url-${target}`}>
              YouTube URL
            </label>
            <input
              id={`yt-url-${target}`}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={disabled || busy || importDisabledByConfig}
              placeholder={inputPlaceholder}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            disabled={disabled || busy || !token || importDisabledByConfig}
            onClick={() => void startImport()}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${btn}`}
          >
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      )}
      {err ? <p className="mt-2 text-xs text-red-400/95">{err}</p> : null}
      {busy ? (
        <div className="mt-2 space-y-2 text-xs text-gray-400">
          <p className="flex items-center gap-2">
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent"
              aria-hidden
            />
            <span>
              {progressSnap?.phase === "upload"
                ? "Finishing up…"
                : progressSnap?.phase === "download"
                  ? "Downloading…"
                  : progressSnap?.phase === "starting" || !progressSnap?.phase
                    ? "Preparing…"
                    : "Working…"}{" "}
              Keep this page open.
            </span>
          </p>
          {(() => {
            const elapsedSec = Math.max(0, Math.floor((Date.now() - busyStartedAtRef.current) / 1000));
            const pct = progressSnap?.progressPercent;
            const dur = progressSnap?.durationSeconds;
            let etaLine: string | null = null;
            if (progressSnap?.phase === "upload") {
              etaLine = "Almost done — usually under a minute.";
            } else if (pct != null && pct >= 2 && pct < 99) {
              const totalEst = (elapsedSec / pct) * 100;
              const rem = Math.max(0, Math.round(totalEst - elapsedSec));
              if (rem > 0 && Number.isFinite(rem)) {
                etaLine = `About ${formatClock(rem)} left (estimate).`;
              }
            } else if (elapsedSec >= 8 && (pct == null || pct < 2)) {
              etaLine = "Still starting — time left is unclear until progress appears.";
            }
            const lenLine = dur != null && dur > 0 ? `Length ~${formatClock(dur)}.` : null;
            return (
              <>
                <p className="pl-6 text-gray-500">
                  Elapsed {formatClock(elapsedSec)}
                  {etaLine ? ` · ${etaLine}` : ""}
                  {lenLine ? ` ${lenLine}` : ""}
                </p>
                {pct != null && progressSnap?.phase === "download" ? (
                  <div className="pl-6">
                    <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-zinc-400/90 transition-[width] duration-500 ease-out"
                        style={{ width: `${Math.min(99, Math.max(0, pct))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">About {pct}%</p>
                  </div>
                ) : null}
                {(() => {
                  const elapsedSec = Math.max(0, Math.floor((Date.now() - busyStartedAtRef.current) / 1000));
                  const ph = progressSnap?.phase;
                  const stuckPreparing =
                    elapsedSec >= 180 &&
                    ph !== "download" &&
                    ph !== "upload";
                  if (!stuckPreparing) return null;
                  return (
                    <p className="pl-6 text-[11px] leading-relaxed text-amber-200/90">
                      This is taking longer than usual. You can keep waiting, or cancel by leaving this page and trying
                      again later.
                    </p>
                  );
                })()}
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
