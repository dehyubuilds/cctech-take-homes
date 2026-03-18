import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppRepository } from "@/lib/repositories";
import { config } from "@/lib/config";
import { ShareAppLink } from "@/components/ShareAppLink";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

/**
 * Use same-origin dynamic OG image so link previews (iMessage, SMS, social) always get
 * a working image from our domain. Avoids 404s from external or relative image URLs.
 */
function appOgImageUrl(base: string, slug: string): string {
  return `${base.replace(/\/$/, "")}/apps/${slug}/opengraph-image`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repo = getAppRepository();
  const app = await repo.getBySlug(slug);
  if (!app) return { title: "App not found" };
  const base = config.app.baseUrl.replace(/\/$/, "");
  const pageUrl = `${base}/apps/${app.slug}`;
  const imageUrl = appOgImageUrl(base, app.slug);
  const title = app.shareTitle || app.name;
  const description = app.shareDescription || app.description || "Subscribe via text on Statics.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: "website",
      siteName: "Statics",
      images: [
        {
          url: imageUrl,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    alternates: { canonical: app.canonicalUrl || pageUrl },
  };
}

export default async function PublicAppSharePage({ params }: PageProps) {
  const { slug } = await params;
  const repo = getAppRepository();
  const app = await repo.getBySlug(slug);
  if (!app) notFound();

  const base = config.app.baseUrl.replace(/\/$/, "");
  const shareUrl = `${base}/apps/${app.slug}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 lg:max-w-4xl">
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
          <div className="mt-8 flex flex-wrap gap-4 items-center">
            <Link
              href="/signup"
              className="rounded-lg bg-brand px-6 py-3 font-medium text-white hover:bg-brand-hover min-h-[44px] inline-flex items-center"
            >
              Sign up to subscribe
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/20 px-6 py-3 text-white hover:bg-white/5 min-h-[44px] inline-flex items-center"
            >
              Log in
            </Link>
            <ShareAppLink shareUrl={shareUrl} appName={app.name} />
            <Link
              href="/dashboard"
              className="rounded-lg bg-surface-muted px-6 py-3 text-gray-300 hover:bg-white/10 min-h-[44px] inline-flex items-center"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
