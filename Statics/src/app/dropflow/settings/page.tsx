"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getStoredToken } from "@/components/AuthProvider";

export default function DropflowSettingsPage() {
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [stripeConnected, setStripeConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const uid = typeof window !== "undefined" ? localStorage.getItem("dropflow_userId") ?? "" : "";
    setUserId(uid);
    if (!uid) return;
    // Load profile immediately (no Stripe call) so form populates right away
    fetch(`/api/dropflow/me?userId=${encodeURIComponent(uid)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) {
          setUsername(data.profile.username ?? "");
          setDisplayName(data.profile.displayName ?? "");
          if (data.profile.stripeAccountId) {
            setStripeConnected(!!data.profile.stripeOnboardingComplete);
            // Fetch Stripe status in background so "Payouts connected" updates when ready
            fetch(`/api/dropflow/me?userId=${encodeURIComponent(uid)}&checkStripe=1`)
              .then((r2) => r2.json())
              .then((d2) => {
                if (d2.profile?.stripeOnboardingComplete !== undefined)
                  setStripeConnected(!!d2.profile.stripeOnboardingComplete);
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const stripe = searchParams?.get("stripe");
    if (stripe === "complete") {
      setStripeConnected(true);
      setMessage({ type: "success", text: "Stripe payouts are set up. You can receive payments when buyers purchase your tracks." });
      window.history.replaceState({}, "", "/dropflow/settings");
    } else if (stripe === "refresh") {
      setMessage({ type: "error", text: "Setup link expired. Click “Set up payouts” again to get a new link." });
      window.history.replaceState({}, "", "/dropflow/settings");
    }
  }, [searchParams]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const uid = userId.trim() || "user-" + Date.now();
    if (!username.trim()) {
      setMessage({ type: "error", text: "Username is required." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dropflow/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: uid,
          username: username.trim(),
          displayName: displayName.trim() || username.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const serverError = typeof data?.error === "string" ? data.error : data?.message || data?.error?.message;
        setMessage({
          type: "error",
          text: serverError || `Failed to save (${res.status}). Check that the dropflow_users table exists in DynamoDB.`,
        });
        setSaving(false);
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("dropflow_userId", uid);
      }
      setMessage({ type: "success", text: "Username saved. When you add songs or beats, they’ll appear under your page and show you as the creator." });
    } catch {
      setMessage({ type: "error", text: "Something went wrong." });
    }
    setSaving(false);
  };

  const handleSetUpPayouts = async () => {
    setMessage(null);
    const token = getStoredToken();
    if (!token) {
      setMessage({ type: "error", text: "Sign in to set up payouts." });
      return;
    }
    setConnectingStripe(true);
    try {
      const res = await fetch("/api/dropflow/connect/onboard", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Could not start payout setup." });
        setConnectingStripe(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setConnectingStripe(false);
    } catch {
      setMessage({ type: "error", text: "Something went wrong." });
      setConnectingStripe(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:max-w-2xl lg:max-w-xl">
      <h1 className="text-2xl font-semibold text-white">Dropflow settings</h1>
      <p className="mt-1 text-gray-400 text-sm">
        Choose a username for your creator page. It appears on your songs and beats and is searchable. Once set, it’s yours—no one else can use it.
      </p>

      <form onSubmit={handleSave} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="myartist"
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <p className="mt-1 text-xs text-gray-500">
            Your page: /dropflow/u/{username || "username"}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Display name (optional)</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="My Artist"
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        {message && (
          <p
            className={
              message.type === "success"
                ? "text-sm text-green-400"
                : "text-sm text-red-400"
            }
          >
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>

      <div className="mt-10 border-t border-white/10 pt-8">
        <h2 className="text-lg font-medium text-white">Stripe payouts</h2>
        <p className="mt-1 text-sm text-gray-400">
          Receive payments when buyers purchase your tracks. Connect your Stripe account to get paid.
        </p>
        {stripeConnected ? (
          <p className="mt-3 text-sm text-green-400">Payouts connected. You can update bank details or complete setup anytime.</p>
        ) : null}
        <button
          type="button"
          onClick={handleSetUpPayouts}
          disabled={connectingStripe}
          className="mt-3 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {connectingStripe ? "Redirecting…" : stripeConnected ? "Update payout details" : "Set up payouts"}
        </button>
      </div>

      <p className="mt-8 text-sm text-gray-500">
        <Link href="/dropflow?mode=creator" className="text-brand hover:underline">
          ← Dropflow
        </Link>
      </p>
    </div>
  );
}
