"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const MODE_KEY = "dropflow_experience_mode";
const PAGE_SIZE = 12;

type ExperienceMode = "browse" | "creator";

interface Beat {
  beatId: string;
  creatorUsername: string;
  title: string;
  tags?: string[];
  thumbnailUrl?: string;
  minimumPriceCents: number;
  createdAt?: string;
}

function buildBrowseQuery(params: {
  usernameContains: string;
  tag: string;
  page: number;
  sort: "asc" | "desc";
}) {
  const sp = new URLSearchParams();
  if (params.usernameContains.trim()) sp.set("usernameContains", params.usernameContains.trim());
  if (params.tag.trim()) sp.set("tag", params.tag.trim());
  if (params.page > 1) sp.set("page", String(params.page));
  if (params.sort === "desc") sp.set("sort", "desc");
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export default function DropflowLandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<ExperienceMode>("browse");

  const [filterUsername, setFilterUsername] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const [beats, setBeats] = useState<Beat[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [usernameSet, setUsernameSet] = useState(false);
  const [hasAddedBeat, setHasAddedBeat] = useState(false);
  const [creatorUsername, setCreatorUsername] = useState<string>("");
  const [creatorBeats, setCreatorBeats] = useState<Beat[]>([]);
  const [creatorLoading, setCreatorLoading] = useState(true);
  const [removingBeatId, setRemovingBeatId] = useState<string | null>(null);

  const refetchCreatorBeats = () => {
    if (!creatorUsername) return;
    fetch(
      `/api/dropflow/beats?username=${encodeURIComponent(creatorUsername)}&pageSize=200&sort=desc`
    )
      .then((r) => r.json())
      .then((d) => {
        const list = d.beats ?? [];
        setCreatorBeats(list);
        setHasAddedBeat(list.length > 0);
      })
      .catch(() => {});
  };

  async function handleRemoveTrack(beatId: string) {
    if (!confirm("Remove this track from your catalog? This cannot be undone.")) return;
    const uid = typeof window !== "undefined" ? localStorage.getItem("dropflow_userId") ?? "" : "";
    setRemovingBeatId(beatId);
    try {
      const res = await fetch(`/api/dropflow/beats/${beatId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to remove track");
        return;
      }
      refetchCreatorBeats();
    } catch {
      alert("Failed to remove track");
    } finally {
      setRemovingBeatId(null);
    }
  }

  useEffect(() => {
    const m = searchParams?.get("mode");
    if (m === "creator") setMode("creator");
  }, [searchParams]);

  useEffect(() => {
    const uid = typeof window !== "undefined" ? localStorage.getItem("dropflow_userId") ?? "" : "";
    if (!uid) {
      setCreatorLoading(false);
      return;
    }
    setCreatorLoading(true);
    fetch(`/api/dropflow/me?userId=${encodeURIComponent(uid)}`)
      .then((r) => r.json())
      .then((data) => {
        const un = data.profile?.username?.trim() ?? "";
        setCreatorUsername(un);
        setUsernameSet(un.length >= 2);
        if (un) {
          return fetch(
            `/api/dropflow/beats?username=${encodeURIComponent(un)}&pageSize=200&sort=desc`
          )
            .then((r2) => r2.json())
            .then((d2) => {
              const list = d2.beats ?? [];
              setCreatorBeats(list);
              setHasAddedBeat(list.length > 0);
            });
        }
      })
      .catch(() => {})
      .finally(() => setCreatorLoading(false));
  }, []);

  useEffect(() => {
    if (mode !== "browse") return;
    const legacyQ = searchParams?.get("q")?.trim() ?? "";
    const tagParam = searchParams?.get("tag")?.trim() ?? "";
    const userParam = searchParams?.get("usernameContains")?.trim() ?? "";
    const pageParam = Math.max(1, parseInt(searchParams?.get("page") ?? "1", 10) || 1);
    const sortParam = searchParams?.get("sort") === "desc" ? "desc" : "asc";

    setFilterUsername(userParam || legacyQ);
    setFilterTag(tagParam);
    setPage(pageParam);
    setSortOrder(sortParam);
  }, [mode, searchParams]);

  const loadBrowse = useCallback(() => {
    if (mode !== "browse") return;
    setLoading(true);
    const u = filterUsername.trim();
    const t = filterTag.trim();
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", String(PAGE_SIZE));
    sp.set("sort", sortOrder);
    if (u) sp.set("usernameContains", u);
    if (t) sp.set("tag", t);
    fetch(`/api/dropflow/beats?${sp.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setBeats(data.beats ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch(() => {
        setBeats([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [mode, page, sortOrder, filterUsername, filterTag]);

  useEffect(() => {
    loadBrowse();
  }, [loadBrowse]);

  const setModeAndStore = (m: ExperienceMode) => {
    setMode(m);
    if (typeof window !== "undefined") sessionStorage.setItem(MODE_KEY, m);
  };

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const path =
      "/dropflow" +
      buildBrowseQuery({
        usernameContains: filterUsername,
        tag: filterTag,
        page: 1,
        sort: sortOrder,
      });
    router.push(path);
    setPage(1);
  }

  function clearFilters() {
    setFilterUsername("");
    setFilterTag("");
    setSortOrder("asc");
    setPage(1);
    router.push("/dropflow");
  }

  function goToPage(p: number) {
    const path =
      "/dropflow" +
      buildBrowseQuery({
        usernameContains: filterUsername,
        tag: filterTag,
        page: p,
        sort: sortOrder,
      });
    router.push(path);
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:max-w-2xl lg:max-w-4xl">
      <h1 className="text-2xl font-semibold text-white">Dropflow</h1>

      <div className="mt-4 flex rounded-lg border border-white/10 bg-surface-elevated p-1">
        <button
          type="button"
          onClick={() => setModeAndStore("browse")}
          className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition ${
            mode === "browse" ? "bg-brand text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Browse
        </button>
        <button
          type="button"
          onClick={() => setModeAndStore("creator")}
          className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition ${
            mode === "creator" ? "bg-brand text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Creator
        </button>
      </div>

      {mode === "browse" ? (
        <>
          <p className="mt-4 text-gray-400">
            Discover songs and beats. Pay what you want (min $1), instant receipt and license.
          </p>

          <form onSubmit={applyFilters} className="mt-6 space-y-4 rounded-xl border border-white/10 bg-surface-elevated p-4">
            <p className="text-sm font-medium text-white">Filters</p>
            <p className="text-xs text-gray-500">
              Narrow the catalog by creator name (partial match) and/or tag. Uploads are listed oldest → newest by default.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="df-filter-user" className="block text-xs text-gray-500 mb-1">
                  Creator (contains)
                </label>
                <input
                  id="df-filter-user"
                  type="text"
                  placeholder="e.g. dehsin"
                  value={filterUsername}
                  onChange={(e) => setFilterUsername(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label htmlFor="df-filter-tag" className="block text-xs text-gray-500 mb-1">
                  Tag (contains)
                </label>
                <input
                  id="df-filter-tag"
                  type="text"
                  placeholder="e.g. church"
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <span>Order:</span>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                  className="rounded-lg border border-white/10 bg-surface px-2 py-1.5 text-white"
                >
                  <option value="asc">Upload date · oldest first</option>
                  <option value="desc">Upload date · newest first</option>
                </select>
              </label>
              <button
                type="submit"
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
              >
                Apply filters
              </button>
              {(filterUsername.trim() || filterTag.trim() || page > 1 || sortOrder === "desc") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </form>

          {loading && <p className="mt-6 text-sm text-gray-400">Loading…</p>}

          {!loading && (
            <div className="mt-6">
              <p className="text-sm text-gray-400">
                {total === 0
                  ? "No tracks match these filters."
                  : `${total} track${total !== 1 ? "s" : ""} · page ${page} of ${totalPages}`}
              </p>
              {beats.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {beats.map((beat) => (
                    <li key={beat.beatId}>
                      <Link
                        href={`/dropflow/b/${beat.beatId}`}
                        className="flex gap-4 rounded-xl border border-white/10 bg-surface-elevated p-4 transition hover:border-white/20"
                      >
                        {beat.thumbnailUrl ? (
                          <img
                            src={beat.thumbnailUrl}
                            alt=""
                            className="h-20 w-20 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-20 w-20 shrink-0 rounded-lg bg-surface-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white truncate">{beat.title}</p>
                          <p className="text-sm text-gray-400">
                            <Link
                              href={`/dropflow/u/${encodeURIComponent(beat.creatorUsername)}`}
                              className="text-brand hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {beat.creatorUsername}
                            </Link>
                            {" · "}From ${(beat.minimumPriceCents / 100).toFixed(2)}
                            {beat.createdAt && (
                              <span className="text-gray-500">
                                {" · "}
                                {new Date(beat.createdAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                          </p>
                          {beat.tags?.length ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {beat.tags.map((t) => (
                                <Link
                                  key={t}
                                  href={`/dropflow?tag=${encodeURIComponent(t)}`}
                                  className="text-xs text-gray-500 hover:text-brand"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {t}
                                </Link>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {totalPages > 1 && (
                <nav
                  className="mt-8 flex flex-wrap items-center justify-center gap-2"
                  aria-label="Pagination"
                >
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                    className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let n: number;
                    if (totalPages <= 7) n = i + 1;
                    else if (page <= 4) n = i + 1;
                    else if (page >= totalPages - 3) n = totalPages - 6 + i;
                    else n = page - 3 + i;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => goToPage(n)}
                        className={`min-w-[2.5rem] rounded-lg px-3 py-2 text-sm ${
                          page === n
                            ? "bg-brand text-white"
                            : "border border-white/10 text-gray-300 hover:bg-white/5"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => goToPage(page + 1)}
                    className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Next
                  </button>
                </nav>
              )}
            </div>
          )}

          <p className="mt-8 text-center text-sm text-gray-500">
            Selling your own?{" "}
            <button
              type="button"
              onClick={() => setModeAndStore("creator")}
              className="text-brand hover:underline"
            >
              Switch to Creator
            </button>
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 text-gray-400">
            Sell your songs and beats. Pay what you want (min $1), receipt and license, Stripe payouts.
          </p>
          {creatorLoading ? (
            <p className="mt-6 text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              {creatorUsername && (
                <p className="mt-4 text-sm text-gray-400">
                  Username: <span className="text-white font-medium">{creatorUsername}</span>
                </p>
              )}
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/dropflow/settings"
                  className={`block rounded-lg border px-4 py-3 text-center ${
                    usernameSet
                      ? "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/15"
                      : "border-white/10 bg-surface-elevated text-gray-300 hover:bg-white/5"
                  }`}
                >
                  {usernameSet ? "✓ Set your username" : "Set your username"}
                </Link>
                <Link
                  href={
                    creatorUsername
                      ? `/dropflow/add?username=${encodeURIComponent(creatorUsername)}`
                      : "/dropflow/add"
                  }
                  className="block rounded-lg border border-brand/50 bg-brand/10 px-4 py-3 text-center text-brand font-medium hover:bg-brand/20 hover:border-brand transition-colors"
                >
                  + Add a song or beat
                </Link>
              </div>
              {creatorBeats.length > 0 && (
                <div className="mt-4 rounded-lg border border-white/10 bg-surface-elevated p-4">
                  <p className="text-sm font-medium text-white">Your tracks ({creatorBeats.length})</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Each track is added separately. Remove any you no longer want listed.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {creatorBeats.map((b) => (
                      <li key={b.beatId} className="flex items-center justify-between gap-2 group">
                        <Link
                          href={`/dropflow/b/${b.beatId}`}
                          className="text-sm text-brand hover:underline truncate min-w-0 flex-1"
                        >
                          {b.title}
                        </Link>
                        <span className="text-xs text-gray-500 shrink-0">
                          {b.createdAt
                            ? new Date(b.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })
                            : b.beatId.replace(/^beat-\d+-/, "")}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTrack(b.beatId)}
                          disabled={removingBeatId === b.beatId}
                          className="shrink-0 rounded p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          title="Remove track"
                          aria-label={`Remove ${b.title}`}
                        >
                          {removingBeatId === b.beatId ? (
                            <span
                              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
                              aria-hidden
                            />
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          <p className="mt-8 text-center text-sm text-gray-500">
            Here to browse?{" "}
            <button
              type="button"
              onClick={() => setModeAndStore("browse")}
              className="text-brand hover:underline"
            >
              Switch to Browse
            </button>
          </p>
        </>
      )}
    </div>
  );
}
