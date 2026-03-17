"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getStoredToken } from "@/components/AuthProvider";
import { AppCard } from "@/components/AppCard";
import type { App } from "@/lib/domain";

export default function DashboardPage() {
  const { session, loading, signOut } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<App[]>([]);
  const [subIds, setSubIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [persistence, setPersistence] = useState<"mock" | "dynamodb" | null>(null);
  const [mockBannerDismissed, setMockBannerDismissed] = useState(false);
  const [canSubscribe, setCanSubscribe] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState<{ phoneNumber?: string; phoneVerified?: boolean } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    setDataLoading(true);
    setHasFetched(false);
    const token = getStoredToken();
    Promise.all([
      fetch("/api/apps").then((r) => r.json()),
      fetch("/api/user/subscriptions", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => r.json()),
      fetch("/api/user/profile", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/health").then((r) => r.json()).catch(() => ({ persistence: null })),
    ]).then(([appsRes, subsRes, profile, health]) => {
      setApps(appsRes.apps || []);
      const ids = new Set<string>(
        (subsRes.subscriptions || []).filter((s: { status: string }) => s.status === "active").map((s: { appId: string }) => s.appId)
      );
      setSubIds(ids);
      const verified = !!(profile?.phoneNumber?.trim() && profile?.phoneVerified);
      setCanSubscribe(verified);
      setProfileLoaded(profile ?? null);
      setPersistence(health.persistence ?? null);
      setDataLoading(false);
      setHasFetched(true);
    }).catch(() => {
      setDataLoading(false);
      setHasFetched(true);
    });
  }, [session, loading, router]);

  const refetchSubs = () => {
    const token = getStoredToken();
    if (!token || !session) return;
    fetch("/api/user/subscriptions", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const ids = new Set<string>(
          (data.subscriptions || []).filter((s: { status: string }) => s.status === "active").map((s: { appId: string }) => s.appId)
        );
        setSubIds(ids);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!session) return;
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") refetchSubs();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session]);

  async function subscribe(appId: string) {
    setMessage(null);
    const token = getStoredToken();
    if (!token) {
      setMessage({ type: "error", text: "Not signed in. Please log in again." });
      return;
    }
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSubIds((prev) => new Set(prev).add(appId));
        setMessage({ type: "success", text: "Subscribed!" });
      } else if (res.status === 401) {
        signOut();
        setMessage({ type: "error", text: "Session expired. Please sign in again." });
      } else if (res.status === 403) {
        setMessage({ type: "error", text: data.error || "Add and verify your phone in Profile to subscribe." });
      } else {
        setMessage({ type: "error", text: data.error || "Subscription failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Request failed" });
    }
  }

  async function unsubscribe(appId: string) {
    const token = getStoredToken();
    if (!token) return;
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appId }),
      });
      if (res.ok) {
        setSubIds((prev) => {
          const next = new Set(prev);
          next.delete(appId);
          return next;
        });
      } else if (res.status === 401) {
        signOut();
        setMessage({ type: "error", text: "Session expired. Please sign in again." });
      } else {
        setMessage({ type: "error", text: "Could not unsubscribe. Try again." });
      }
    } catch {
      setMessage({ type: "error", text: "Request failed. Try again." });
    }
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
      <p className="mt-1 text-gray-400">
        Browse and subscribe to curated apps. Messages are sent to your verified phone number.
      </p>
      {hasFetched && profileLoaded && !(profileLoaded.phoneNumber?.trim() && profileLoaded.phoneVerified) && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          Add and verify your phone number in <a href="/profile" className="underline hover:text-white">Profile</a> before you can subscribe.
        </p>
      )}
      {message && (
        <p className={`mt-4 rounded-lg px-4 py-2 text-sm ${message.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
          {message.text}
        </p>
      )}
      {persistence === "mock" && !mockBannerDismissed && (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p>
            <strong>Local / in-memory mode.</strong> Subscriptions and data are not persisted and will be lost on restart.
          </p>
          <button
            type="button"
            onClick={() => setMockBannerDismissed(true)}
            className="shrink-0 text-amber-300 hover:text-white"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <div className="mt-8">
        {!hasFetched || dataLoading ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-white/10 bg-surface-elevated py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden />
            <p className="text-sm text-gray-400">Loading dashboard…</p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {apps.map((app) => (
                <AppCard
                  key={app.appId}
                  app={app}
                  isSubscribed={canSubscribe && subIds.has(app.appId)}
                  canSubscribe={canSubscribe}
                  onSubscribe={() => subscribe(app.appId)}
                  onUnsubscribe={() => unsubscribe(app.appId)}
                />
              ))}
            </div>
            {apps.length === 0 && (
              <p className="rounded-lg border border-white/10 bg-surface-elevated p-8 text-center text-gray-400">
                No apps yet. Check back soon or visit a shared app link.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
