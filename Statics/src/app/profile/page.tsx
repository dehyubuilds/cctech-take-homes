"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getStoredToken } from "@/components/AuthProvider";
import type { User } from "@/lib/domain";

type SubWithApp = {
  subscriptionId: string;
  appId: string;
  status: string;
  app: { name: string; slug: string } | null;
};

export default function ProfilePage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [subs, setSubs] = useState<SubWithApp[]>([]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [avatarUploadConfigured, setAvatarUploadConfigured] = useState<boolean | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showChangePhone, setShowChangePhone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Never show Netlify/CDN raw 404/502 text; use friendly message. */
  const phoneErrorText = (msg: string | undefined, fallback: string): string => {
    const text = (msg || fallback).trim();
    if (!text) return fallback;
    if (/requested resource not found|resource not found/i.test(text)) return "Service temporarily unavailable. Try again in a moment.";
    return text;
  };

  const load = () => {
    const token = getStoredToken();
    if (!token) return;
    setAvatarError(null);
    Promise.all([
      fetch("/api/user/profile", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/user/subscriptions", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ]).then(([profile, subsRes]) => {
      setUser(profile);
      setSubs(subsRes.subscriptions || []);
      setAvatarUrl(profile?.avatarUrl || "");
      setPhoneNumber(profile?.phoneNumber || "");
      if (profile?.phoneVerified) setShowChangePhone(false);
    }).catch(() => setUser(session?.user ?? null));
    fetch("/api/user/profile/upload-avatar")
      .then((r) => r.json())
      .then((data) => setAvatarUploadConfigured(!!data.configured))
      .catch(() => setAvatarUploadConfigured(false));
  };

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    load();
  }, [session, loading, router]);

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getStoredToken();
    if (!token) return;
    setAvatarError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/user/profile/upload-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAvatarError(data.error || "Upload not available");
        return;
      }
      await fetch(data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      const patchRes = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarUrl: data.avatarUrl }),
      });
      if (patchRes.ok) {
        const updated = await patchRes.json();
        setUser(updated);
        setAvatarUrl(updated.avatarUrl ?? data.avatarUrl);
      } else {
        setAvatarUrl(data.avatarUrl);
      }
    } catch (err) {
      setAvatarError("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSavePhone = async () => {
    const token = getStoredToken();
    if (!token) return;
    setPhoneMessage(null);
    setSavingPhone(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() || undefined }),
      });
      if (res.ok) {
        const data = (await res.json()) as User;
        setUser(data);
        setPhoneMessage({ type: "success", text: "Phone number saved. Sending verification code…" });
        const codeRes = await fetch("/api/send-verify-code", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const codeData = await codeRes.json().catch(async () => ({ error: await codeRes.text().catch(() => "") || undefined }));
        if (codeRes.ok) {
          setPhoneMessage({ type: "success", text: "Phone saved. Check your phone for the 6-digit code, then enter it below." });
        } else {
          const errMsg = (codeData as { error?: string }).error;
          if (codeRes.status === 404) {
            setPhoneMessage({ type: "error", text: "Verification service temporarily unavailable. Try again in a moment." });
          } else {
            setPhoneMessage({ type: "error", text: phoneErrorText(errMsg, `Code not sent (${codeRes.status}). Click 'Send verification code' to try again.`) });
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        const apiError = (errData as { error?: string }).error;
        if (res.status === 409) {
          setPhoneMessage({ type: "error", text: apiError || "This phone number is already registered to another account." });
        } else if (res.status === 404) {
          setPhoneMessage({ type: "error", text: "Could not save. Check your connection and try again." });
        } else {
          setPhoneMessage({ type: "error", text: phoneErrorText(apiError, "Failed to save") });
        }
      }
    } finally {
      setSavingPhone(false);
    }
  };

  const handleSendVerifyCode = async () => {
    const token = getStoredToken();
    if (!token) return;
    setPhoneMessage(null);
    setSendingCode(true);
    try {
      const res = await fetch("/api/send-verify-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPhoneMessage({ type: "success", text: "Verification code sent to your phone." });
      } else {
        if (res.status === 404) {
          setPhoneMessage({ type: "error", text: "Verification service temporarily unavailable. Try again in a moment." });
        } else {
          setPhoneMessage({ type: "error", text: phoneErrorText((data as { error?: string }).error, "Failed to send code") });
        }
      }
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyPhone = async () => {
    const token = getStoredToken();
    if (!token) return;
    setPhoneMessage(null);
    setVerifying(true);
    try {
      const res = await fetch("/api/user/profile/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setVerifyCode("");
        setPhoneMessage({
          type: "success",
          text: "Phone verified. Go to the Dashboard to browse and subscribe to apps.",
        });
        load();
      } else {
        setPhoneMessage({ type: "error", text: phoneErrorText((data as { error?: string }).error, "Verification failed") });
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleUnsubscribe = async (appId: string) => {
    const token = getStoredToken();
    if (!token) return;
    await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ appId }),
    });
    load();
  };

  if (loading || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  const activeSubs = subs.filter((s) => s.status === "active");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-white">Profile</h1>

      {/* Profile picture */}
      <section className="mt-8 rounded-xl border border-white/10 bg-surface-elevated p-6">
        <h2 className="text-lg font-medium text-white">Profile picture</h2>
        <p className="mt-1 text-sm text-gray-400">
          {avatarUploadConfigured === false
            ? "Profile photo upload is not available for this site."
            : "Click your photo or the button below to choose a new image."}
        </p>
        {avatarError && (
          <p className="mt-2 text-sm text-amber-400">{avatarError}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => (avatarUploadConfigured && !uploading ? fileInputRef.current?.click() : null)}
            className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-white/10 bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center"
            disabled={!avatarUploadConfigured || uploading}
            title={avatarUploadConfigured ? "Change profile photo" : "Upload not available"}
            aria-label="Profile picture - click to change"
          >
            {(user?.avatarUrl || avatarUrl) ? (
              <img
                src={user?.avatarUrl || avatarUrl}
                alt=""
                width={96}
                height={96}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover pointer-events-none"
              />
            ) : (
              <svg
                className="h-12 w-12 text-gray-500 pointer-events-none"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            )}
          </button>
          <div className="min-w-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={handleUploadAvatar}
              disabled={uploading || avatarUploadConfigured === false}
              aria-label="Choose profile image"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || avatarUploadConfigured === false}
              title={avatarUploadConfigured === false ? "Upload not available" : "Choose a photo"}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading…" : avatarUploadConfigured === false ? "Upload not available" : "Change photo"}
            </button>
          </div>
        </div>
      </section>

      {/* Account details + phone (required for subscribe) */}
      <section className="mt-6 rounded-xl border border-white/10 bg-surface-elevated p-6">
        <h2 className="text-lg font-medium text-white">Account</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400">Email</label>
            <p className="mt-1 text-white">{user?.email ?? session.user.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400">Phone number (required to subscribe)</label>
            {user?.phoneVerified && user?.phoneNumber && !showChangePhone ? (
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <p className="text-white">
                  <span className="font-medium">{user.phoneNumber}</span>
                  <span className="ml-2 text-green-400 text-sm">✓ Verified</span>
                </p>
                <button
                  type="button"
                  onClick={() => { setShowChangePhone(true); setPhoneMessage(null); }}
                  className="rounded-lg border border-white/20 px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
                >
                  Change number
                </button>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 234 555 0123"
                  className="rounded-lg border border-white/10 bg-surface-muted px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand w-48"
                />
                <button
                  type="button"
                  onClick={handleSavePhone}
                  disabled={savingPhone}
                  className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                >
                  {savingPhone ? "Saving…" : user?.phoneVerified ? "Save new number" : "Save phone"}
                </button>
                {user?.phoneVerified && showChangePhone && (
                  <button
                    type="button"
                    onClick={() => { setShowChangePhone(false); setPhoneNumber(user?.phoneNumber ?? ""); setPhoneMessage(null); }}
                    className="rounded-lg border border-white/20 px-3 py-2 text-sm text-gray-400 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400">Phone verified</label>
            <p className="mt-1 text-white">{user?.phoneVerified ? "Yes" : "No — verify below to subscribe to apps"}</p>
            {((user?.phoneNumber && !user?.phoneVerified) || (phoneNumber.trim() && !user?.phoneVerified)) && (
              <div className="mt-4 space-y-4 rounded-lg border border-white/10 bg-surface-muted/50 p-4">
                <div>
                  <p className="text-sm font-medium text-gray-300">Step 1 — Get the code</p>
                  <p className="mt-1 text-sm text-gray-400">
                    A 6-digit code was sent to your phone when you saved your number. Didn&apos;t get it or need a new one? Click below to send again.
                  </p>
                  <button
                    type="button"
                    onClick={handleSendVerifyCode}
                    disabled={sendingCode}
                    className="mt-2 rounded-lg border border-white/20 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50"
                  >
                    {sendingCode ? "Sending…" : "Send verification code again"}
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300">Step 2 — Enter the code</p>
                  <p className="mt-1 text-sm text-gray-400">
                    Enter the 6-digit code from your phone, then click Verify.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 items-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="rounded-lg border border-white/10 bg-surface-muted px-3 py-2 text-sm text-white placeholder-gray-500 w-28 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      aria-label="6-digit verification code from SMS"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyPhone}
                      disabled={verifying || verifyCode.length < 6}
                      className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                    >
                      {verifying ? "Verifying…" : "Verify"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {phoneMessage && (
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-sm ${phoneMessage.type === "success" ? "text-green-400" : "text-amber-400"}`}>
                {phoneMessage.text}
              </p>
              {phoneMessage.type === "success" && (
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover"
                >
                  Go to Dashboard
                </Link>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-400">SMS status</label>
            <p className="mt-1 text-white">{user?.smsStatus ?? "pending"}</p>
            <p className="mt-1 text-xs text-gray-500">
              Reply <strong>STOP</strong> to any message to opt out of all SMS. Reply <strong>START</strong> to opt back in.
            </p>
          </div>
        </div>
      </section>

      {/* Managed products (subscriptions) — unsubscribe here */}
      <section className="mt-6 rounded-xl border border-white/10 bg-surface-elevated p-6">
        <h2 className="text-lg font-medium text-white">Managed products</h2>
        <p className="mt-1 text-sm text-gray-400">Your subscriptions. Unsubscribe to stop receiving texts for that product.</p>
        {activeSubs.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No active subscriptions.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {activeSubs.map((sub) => (
              <li
                key={sub.subscriptionId}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-surface-muted/50 px-4 py-3"
              >
                <span className="font-medium text-white">{sub.app?.name ?? sub.appId}</span>
                <button
                  type="button"
                  onClick={() => handleUnsubscribe(sub.appId)}
                  className="rounded border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20"
                >
                  Unsubscribe
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
