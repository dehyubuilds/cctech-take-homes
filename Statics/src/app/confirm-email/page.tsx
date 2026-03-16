"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { setStoredToken } from "@/components/AuthProvider";

function ConfirmEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const emailParam = searchParams?.get("email") ?? "";
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/confirm-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Confirmation failed");
        return;
      }
      const signInRes = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const signInData = await signInRes.json();
      if (!signInRes.ok) {
        setError(signInData.error || "Sign in failed");
        return;
      }
      if (signInData.token && signInData.userId) {
        setStoredToken(signInData.token);
        setSession(
          signInData.user
            ? {
                userId: signInData.user.userId,
                email: signInData.user.email,
                role: signInData.user.role,
                user: signInData.user,
              }
            : null
        );
        router.push("/dashboard");
        router.refresh();
      } else {
        router.push("/login?confirmed=1");
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email.trim()) {
      setError("Enter your email first");
      return;
    }
    setError("");
    setResendLoading(true);
    setResendSent(false);
    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not resend code");
        return;
      }
      setResendSent(true);
    } catch {
      setError("Something went wrong");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold text-white">Confirm your email</h1>
      <p className="mt-1 text-sm text-gray-400">
        We sent a verification code to your email. Enter it below to finish signing up.
      </p>
      <p className="mt-1 text-sm text-gray-500">
        Can&apos;t find it? Check your spam folder, then use &quot;Resend code&quot; below.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-300">
            Verification code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            maxLength={6}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand text-center text-lg tracking-widest"
            placeholder="000000"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            placeholder="Your signup password"
          />
          <p className="mt-1 text-xs text-gray-500">Enter your password so we can log you in after confirming.</p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {resendSent && <p className="text-sm text-green-400">New code sent. Check your email.</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand py-2.5 font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {loading ? "Confirming…" : "Confirm & sign in"}
        </button>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading}
            className="text-brand hover:underline disabled:opacity-50"
          >
            {resendLoading ? "Sending…" : "Resend code"}
          </button>
          <Link href="/login" className="text-gray-400 hover:text-white">
            Back to log in
          </Link>
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-gray-400">
        Already confirmed?{" "}
        <Link href="/login" className="text-brand hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm px-4 py-16 text-gray-400">Loading…</div>}>
      <ConfirmEmailForm />
    </Suspense>
  );
}
