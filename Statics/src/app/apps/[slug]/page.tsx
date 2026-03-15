import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppRepository } from "@/lib/repositories";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repo = getAppRepository();
  const app = await repo.getBySlug(slug);
  if (!app) return { title: "App not found" };
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://statics.example.com";
  const url = `${base}/apps/${app.slug}`;
  const image = app.shareImageUrl.startsWith("http") ? app.shareImageUrl : `${base}${app.shareImageUrl}`;
  return {
    title: app.shareTitle,
    description: app.shareDescription,
    openGraph: {
      title: app.shareTitle,
      description: app.shareDescription,
      images: [{ url: image }],
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: app.shareTitle,
      description: app.shareDescription,
      images: [image],
    },
    alternates: { canonical: app.canonicalUrl || url },
  };
}

export default async function PublicAppSharePage({ params }: PageProps) {
  const { slug } = await params;
  const repo = getAppRepository();
  const app = await repo.getBySlug(slug);
  if (!app) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface-elevated">
        {app.thumbnailUrl && (
          <div className="aspect-video bg-surface-muted">
            <img
              src={app.thumbnailUrl}
              alt=""
              width={800}
              height={450}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="p-8">
          <h1 className="text-2xl font-semibold text-white">{app.name}</h1>
          <p className="mt-3 text-gray-400">{app.description}</p>
          <p className="mt-4 text-brand">
            {app.priceCents === 0 ? "Free" : `$${(app.priceCents / 100).toFixed(2)}/mo`}
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/signup"
              className="rounded-lg bg-brand px-6 py-3 font-medium text-white hover:bg-brand-hover"
            >
              Sign up to subscribe
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/20 px-6 py-3 text-white hover:bg-white/5"
            >
              Log in
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg bg-surface-muted px-6 py-3 text-gray-300 hover:bg-white/10"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
