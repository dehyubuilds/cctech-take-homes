"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { setStoredToken } from "@/components/AuthProvider";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession, session, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && session) {
      router.replace("/dashboard");
    }
  }, [authLoading, session, router]);
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
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)] flex flex-col items-center justify-start md:justify-center px-4 py-10 md:py-16">
      <div className="mx-auto w-full max-w-sm md:max-w-lg lg:max-w-xl text-center rounded-2xl border border-white/10 bg-surface-elevated/60 backdrop-blur-sm px-6 py-10 md:px-12 md:py-12 shadow-xl shadow-black/20">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">Log in</h1>
      <p className="mt-3 text-base text-gray-400">
        Don’t have an account?{" "}
        <Link href="/signup" className="text-brand font-medium hover:underline">
          Sign up
        </Link>
      </p>
      {(confirmed || registered || reset) && (
        <p className="mt-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
          {reset ? "Password reset. You can sign in with your new password." : confirmed ? "Email confirmed. You can sign in now." : "Account created. Sign in below."}
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-10 space-y-5 text-left">
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
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 md:text-lg text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300">
            Password
          </label>
          <div className="relative mt-2">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 md:text-lg pr-12 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
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
          className="w-full rounded-xl bg-brand py-4 text-base md:text-lg font-semibold text-white hover:bg-brand-hover disabled:opacity-50 min-h-[52px] transition-colors"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-16">
        <div className="mx-auto max-w-sm md:max-w-md text-center text-gray-400">Loading…</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
