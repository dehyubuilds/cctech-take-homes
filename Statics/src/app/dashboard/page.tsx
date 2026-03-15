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

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    const token = getStoredToken();
    Promise.all([
      fetch("/api/apps").then((r) => r.json()),
      fetch("/api/user/subscriptions", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/user/profile", { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/health").then((r) => r.json()).catch(() => ({ persistence: null })),
    ]).then(([appsRes, subsRes, profile, health]) => {
      setApps(appsRes.apps || []);
      const ids = new Set<string>(
        (subsRes.subscriptions || []).filter((s: { status: string }) => s.status === "active").map((s: { appId: string }) => s.appId)
      );
      setSubIds(ids);
      setCanSubscribe(!!(profile?.phoneNumber?.trim() && profile?.phoneVerified));
      setPersistence(health.persistence ?? null);
    }).catch(() => {});
  }, [session, loading, router]);

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
    await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ appId }),
    });
    setSubIds((prev) => {
      const next = new Set(prev);
      next.delete(appId);
      return next;
    });
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
      {!canSubscribe && (
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
            <strong>Local / in-memory mode.</strong> Subscriptions and data are not saved to a database and will be lost when the server restarts. For persistent subscriptions, set up DynamoDB (see <code className="rounded bg-white/10 px-1">.env.example</code> and <code className="rounded bg-white/10 px-1">DEPLOY-E2E.md</code>).
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
      </div>
    </div>
  );
}
