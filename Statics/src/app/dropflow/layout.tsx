"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getStoredToken } from "@/components/AuthProvider";

export default function DropflowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<{ phoneNumber?: string; phoneVerified?: boolean } | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);

  const verified = !!(profile?.phoneNumber?.trim() && profile?.phoneVerified);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      const redirect = pathname ? `/dropflow${pathname === "/dropflow" ? "" : pathname.replace(/^\/dropflow/, "")}` : "/dropflow";
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
      setProfileChecked(true);
      return;
    }
    const token = getStoredToken();
    if (!token) {
      setProfileChecked(true);
      return;
    }
    fetch("/api/user/profile", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setProfile(data ?? null);
        setProfileChecked(true);
      })
      .catch(() => setProfileChecked(true));
  }, [session, loading, pathname, router]);

  useEffect(() => {
    if (verified && session?.userId && typeof window !== "undefined") {
      localStorage.setItem("dropflow_userId", session.userId);
    }
  }, [verified, session?.userId]);

  if (loading || !profileChecked) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden />
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (!verified) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center md:max-w-2xl lg:max-w-3xl">
        <h1 className="text-2xl font-semibold text-white">Dropflow</h1>
        <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
          <p className="font-medium text-amber-200">Verify your phone to use Dropflow</p>
          <p className="mt-2 text-sm text-gray-400">
            To use any app, including Dropflow, your phone number must be added and verified in your Profile.
          </p>
          <Link
            href="/profile"
            className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Go to Profile
          </Link>
        </div>
        <p className="mt-6 text-sm text-gray-500">
          <Link href="/dashboard" className="text-brand hover:underline">← Dashboard</Link>
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
