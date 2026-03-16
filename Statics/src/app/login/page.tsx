"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { setStoredToken } from "@/components/AuthProvider";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const confirmed = searchParams?.get("confirmed") === "1";
  const registered = searchParams?.get("registered") === "1";
  const reset = searchParams?.get("reset") === "1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    console.log("[Statics Auth] signin request", { email: email.trim().toLowerCase() });
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      console.log("[Statics Auth] signin response", { status: res.status, ok: res.ok, data: { ...data, token: data.token ? "[present]" : undefined } });
      if (!res.ok) {
        setError(data.error || "Sign in failed");
        return;
      }
      if (data.token) {
        setStoredToken(data.token);
        setSession(
          data.user
            ? {
                userId: data.user.userId,
                email: data.user.email,
                role: data.user.role,
                user: data.user,
              }
            : null
        );
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      console.error("[Statics Auth] signin error", err);
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold text-white">Log in</h1>
      <p className="mt-1 text-sm text-gray-400">
        Don’t have an account?{" "}
        <Link href="/signup" className="text-brand hover:underline">
          Sign up
        </Link>
      </p>
      {(confirmed || registered || reset) && (
        <p className="mt-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
          {reset ? "Password reset. You can sign in with your new password." : confirmed ? "Email confirmed. You can sign in now." : "Account created. Sign in below."}
        </p>
      )}
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
          />
          <p className="mt-1 text-right text-sm">
            <Link href="/forgot-password" className="text-gray-400 hover:text-brand hover:underline">
              Forgot password?
            </Link>
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        {error && typeof error === "string" && error.includes("confirm your email") && (
          <p className="text-sm">
            <Link
              href={`/confirm-email?email=${encodeURIComponent(email.trim() || "")}`}
              className="text-brand hover:underline"
            >
              Enter your verification code →
            </Link>
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand py-2.5 font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm px-4 py-16 text-gray-400">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
