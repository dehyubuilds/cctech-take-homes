"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function HomePage() {
  const { session, loading } = useAuth();

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-16 sm:py-24 lg:py-32">
      <div className="mx-auto w-full max-w-2xl text-center md:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
          Statics
        </h1>
        <p className="mt-4 text-xl text-brand font-medium sm:text-2xl lg:text-3xl">
          Apps that text you what matters.
        </p>
        <p className="mt-5 text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto lg:text-xl lg:max-w-3xl">
          Subscribe to curated apps that deliver picks, alerts, and insights directly to your phone—no downloads required.
        </p>
      {!loading && session ? (
        <div className="mt-12 lg:mt-16 flex flex-col sm:flex-row items-center justify-center gap-4 lg:gap-6">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto rounded-xl bg-brand px-8 py-3.5 lg:px-10 lg:py-4 text-base lg:text-lg font-medium text-white hover:bg-brand-hover transition-colors min-h-[48px] lg:min-h-[52px] flex items-center justify-center"
          >
            Dashboard
          </Link>
          <Link
            href="/profile"
            className="w-full sm:w-auto rounded-xl border border-gray-600 px-8 py-3.5 lg:px-10 lg:py-4 text-base lg:text-lg font-medium text-white hover:bg-white/5 transition-colors min-h-[48px] lg:min-h-[52px] flex items-center justify-center"
          >
            Profile
          </Link>
        </div>
      ) : !loading ? (
        <>
          <div className="mt-12 lg:mt-16 flex flex-col sm:flex-row items-center justify-center gap-4 lg:gap-6">
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-xl bg-brand px-8 py-3.5 lg:px-10 lg:py-4 text-base lg:text-lg font-medium text-white hover:bg-brand-hover transition-colors min-h-[48px] lg:min-h-[52px] flex items-center justify-center"
            >
              Get started
            </Link>
          </div>
          <p className="mt-6 lg:mt-8 text-sm lg:text-base text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="text-brand hover:text-brand-hover transition-colors underline underline-offset-2">
              Log in
            </Link>
          </p>
        </>
      ) : null}
      </div>
    </div>
  );
}
