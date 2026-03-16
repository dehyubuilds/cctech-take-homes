import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:py-28 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
        Statics
      </h1>
      <p className="mt-4 text-xl text-brand font-medium">
        Apps that text you what matters.
      </p>
      <p className="mt-5 text-lg text-gray-400 leading-relaxed">
        Subscribe to curated apps that deliver picks, alerts, and insights directly to your phone—no downloads required.
      </p>
      <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          href="/signup"
          className="w-full sm:w-auto rounded-xl bg-brand px-8 py-3.5 text-base font-medium text-white hover:bg-brand-hover transition-colors min-h-[48px] flex items-center justify-center"
        >
          Get started
        </Link>
      </div>
      <p className="mt-6 text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="text-brand hover:text-brand-hover transition-colors underline underline-offset-2">
          Log in
        </Link>
      </p>
    </div>
  );
}
