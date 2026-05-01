"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getStoredToken, useAuth } from "@/components/AuthProvider";
import type { VideoProject } from "@/lib/art-of-the-question/video-project-types";

function authHeaders(): HeadersInit {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function AotqVideoProjectsPage() {
  const { isAdmin } = useAuth();
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      setErr(null);
      setProjects([]);
      return;
    }
    setErr(null);
    const res = await fetch("/api/art-of-the-question/projects", { headers: authHeaders() });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || "Could not load projects.");
      setProjects([]);
    } else {
      setProjects(j.projects ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const token = getStoredToken();
    if (!token) {
      window.location.href = `/login?redirect=${encodeURIComponent("/art-of-the-question/projects")}`;
      return;
    }
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch("/api/art-of-the-question/projects", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Untitled project" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error || "Create failed.");
        return;
      }
      if (j.project?.projectId) {
        setName("");
        window.location.href = `/art-of-the-question/projects/${encodeURIComponent(j.project.projectId)}`;
      }
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (projectId: string, displayName: string) => {
    if (
      !confirm(
        `Delete project "${displayName}"?\n\nAll sources, transcripts, and Q&A for this project will be removed. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(projectId);
    setErr(null);
    try {
      const res = await fetch(`/api/art-of-the-question/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const text = await res.text();
      let j: { error?: string } = {};
      try {
        j = text ? (JSON.parse(text) as { error?: string }) : {};
      } catch {
        /* non-JSON body */
      }
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : `Delete failed (${res.status}).`);
        return;
      }
      setProjects((prev) => prev.filter((x) => x.projectId !== projectId));
    } catch {
      setErr("Delete failed.");
    } finally {
      setDeletingId(null);
    }
  };

  const token = typeof window !== "undefined" ? getStoredToken() : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link href="/art-of-the-question" className="text-zinc-400 hover:text-aotq">
          ← Art of the Question
        </Link>
        {isAdmin() ? (
          <Link
            href="/art-of-the-question/playlist-triage"
            className="text-zinc-500 hover:text-aotq"
          >
            Playlist triage (internal)
          </Link>
        ) : null}
      </nav>

      <header className="mt-8 border-b border-white/[0.08] pb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Video studio</p>
        <h1 className="mt-3 font-serif text-3xl font-medium tracking-tight text-white sm:text-4xl">
          Named projects over your transcripts
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">
          Drop one or more YouTube links. We pull captions (or your Lambda worker), store them in DynamoDB, and answer
          questions scoped to everything in the project.
        </p>
      </header>

      {!token && !loading && (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm text-zinc-300">Sign in to create and open your video projects.</p>
          <Link
            href={`/login?redirect=${encodeURIComponent("/art-of-the-question/projects")}`}
            className="mt-4 inline-flex rounded-xl bg-aotq px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-aotq-hover"
          >
            Sign in
          </Link>
        </div>
      )}

      {token && (
        <section className="mt-10 rounded-2xl border border-white/10 bg-zinc-950/40 p-6 ring-1 ring-white/[0.04]">
          <h2 className="text-sm font-semibold text-white">New project</h2>
          <p className="mt-1 text-xs text-zinc-500">Give it a name you will recognize in six months.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Founder interviews — Q1"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-aotq/40 focus:outline-none"
            />
            <button
              type="button"
              disabled={creating}
              onClick={() => void create()}
              className="shrink-0 rounded-xl bg-aotq px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-aotq-hover disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create & open"}
            </button>
          </div>
        </section>
      )}

      {err && (
        <p className="mt-8 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {err}
        </p>
      )}

      {token && (
        <ul className="mt-12 space-y-3">
          {loading ? (
            <li className="py-12 text-center text-sm text-zinc-500">Loading projects…</li>
          ) : projects.length === 0 ? (
            <li className="py-12 text-center text-sm text-zinc-500">No projects yet. Create one above.</li>
          ) : (
            projects.map((p) => (
              <li
                key={p.projectId}
                className="flex flex-col gap-2 rounded-2xl border border-white/[0.07] bg-zinc-900/40 p-4 transition-all hover:border-aotq/25 hover:bg-zinc-900/70 sm:flex-row sm:items-stretch sm:gap-0 sm:p-0"
              >
                <Link
                  href={`/art-of-the-question/projects/${encodeURIComponent(p.projectId)}`}
                  className="group min-w-0 flex-1 rounded-xl px-4 py-4 sm:rounded-l-2xl sm:rounded-r-none"
                >
                  <h2 className="text-lg font-medium text-zinc-100 group-hover:text-white">{p.name}</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {(p.sourceCount ?? 0) === 1 ? "1 source" : `${p.sourceCount ?? 0} sources`} · Updated{" "}
                    {new Date(p.updatedAt).toLocaleString()} ·{" "}
                    <span className="font-mono text-zinc-600">{p.projectId}</span>
                  </p>
                </Link>
                <div className="flex shrink-0 items-center border-t border-white/[0.06] px-3 pb-3 pt-2 sm:border-l sm:border-t-0 sm:px-4 sm:py-4">
                  <button
                    type="button"
                    disabled={deletingId === p.projectId}
                    onClick={() => void deleteProject(p.projectId, p.name || "Untitled")}
                    className="w-full rounded-lg border border-rose-500/35 bg-rose-950/20 px-3 py-2 text-xs font-medium text-rose-200/95 hover:bg-rose-950/40 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    aria-label={`Delete project ${p.name}`}
                  >
                    {deletingId === p.projectId ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
