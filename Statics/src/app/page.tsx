import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
        Statics
      </h1>
      <p className="mt-4 text-lg text-gray-400">
        Curated SMS apps. Subscribe once, get daily picks and updates on your phone.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link
          href="/login"
          className="rounded-lg border border-white/20 px-6 py-3 text-white hover:bg-white/5"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-brand px-6 py-3 font-medium text-white hover:bg-brand-hover"
        >
          Sign up
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg bg-surface-elevated px-6 py-3 text-white hover:bg-surface-muted"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
