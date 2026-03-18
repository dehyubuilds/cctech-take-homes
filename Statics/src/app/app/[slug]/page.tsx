"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getStoredToken } from "@/components/AuthProvider";

export default function ProtectedAppPage() {
  const params = useParams();
  const slug = (params?.slug ?? "") as string;
  const { session, loading } = useAuth();
  const router = useRouter();
  const [app, setApp] = useState<{
    appId: string;
    name: string;
    description: string;
    slug: string;
    status: string;
  } | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState(false);
  const [appFetched, setAppFetched] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace(`/login?redirect=/app/${slug}`);
      return;
    }
    setAppFetched(false);
    const token = getStoredToken();
    setSubscriptionError(false);
    Promise.all([
      fetch(`/api/apps/${slug}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/user/subscriptions", { headers: { Authorization: `Bearer ${token}` } }).then(async (r) => {
        if (r.status === 401) {
          router.replace(`/login?redirect=/app/${slug}`);
          return { subscriptions: [] };
        }
        if (!r.ok) {
          setSubscriptionError(true);
          return { subscriptions: [] };
        }
        return r.json();
      }),
    ]).then(([appData, subsRes]) => {
      setApp(appData);
      const subs = subsRes?.subscriptions ?? [];
      const appId = appData?.appId;
      const sub = appId ? subs.find((s: { appId: string; status: string }) => s.appId === appId && s.status === "active") : undefined;
      const isSub = !!sub;
      setSubscribed(isSub);
      setAppFetched(true);
      if (slug === "dropflow" && isSub && appData?.status === "active") {
        router.replace("/dropflow");
      }
    }).catch(() => {
      setApp(null);
      setAppFetched(true);
    });
  }, [session, loading, router, slug]);

  if (loading || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!appFetched) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden />
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center md:max-w-2xl lg:max-w-3xl">
        <p className="text-gray-400">App not found.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-brand hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (app.status !== "active") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center md:max-w-2xl lg:max-w-3xl">
        <h1 className="text-xl font-semibold text-white">{app.name}</h1>
        <p className="mt-4 text-gray-400">This app is currently unavailable.</p>
        <Link href="/dashboard" className="mt-6 inline-block text-brand hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!subscribed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 md:max-w-2xl lg:max-w-4xl">
        <h1 className="text-2xl font-semibold text-white">{app.name}</h1>
        <p className="mt-2 text-gray-400">{app.description}</p>
        <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
          {subscriptionError ? (
            <>
              <p className="font-medium text-amber-200">Could not verify subscription</p>
              <p className="mt-1 text-sm text-gray-400">
                Refresh the page to try again, or go to the dashboard to confirm you’re subscribed.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
                >
                  Refresh
                </button>
                <Link
                  href="/dashboard"
                  className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
                >
                  Dashboard
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="font-medium text-amber-200">Subscribe required</p>
              <p className="mt-1 text-sm text-gray-400">
                You need an active subscription to access this app. Subscribe from the dashboard or below.
              </p>
              <Link
                href="/dashboard"
                className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
              >
                Subscribe to {app.name}
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 lg:max-w-4xl">
      <h1 className="text-2xl font-semibold text-white">{app.name}</h1>
      <p className="mt-2 text-gray-400">{app.description}</p>
      <div className="mt-8 rounded-xl border border-white/10 bg-surface-elevated p-6">
        <p className="text-sm text-gray-400">You’re subscribed. Content for this product is driven by the name and description you set in admin.</p>
      </div>
      <Link href="/dashboard" className="mt-8 inline-block text-brand hover:underline">
        ← Dashboard
      </Link>
    </div>
  );
}
