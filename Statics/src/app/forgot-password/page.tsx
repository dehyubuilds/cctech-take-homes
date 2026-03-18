"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSent(false);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send reset code");
        return;
      }
      setSent(true);
      router.push(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 md:max-w-md">
      <h1 className="text-2xl font-semibold text-white">Forgot password</h1>
      <p className="mt-1 text-sm text-gray-400">
        Enter your email and we&apos;ll send you a verification code to reset your password.
      </p>
      {sent && (
        <p className="mt-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
          Check your email for the code, then enter it on the next page.
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
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand py-2.5 font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send reset code"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-400">
        <Link href="/login" className="text-brand hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
