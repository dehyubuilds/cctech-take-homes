import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppRepository } from "@/lib/repositories";
import { config } from "@/lib/config";
import { ShareAppLink } from "@/components/ShareAppLink";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Default OG image when app has no share or thumbnail URL (absolute so link previews work). */
const DEFAULT_OG_IMAGE =
  "https://placehold.co/1200x630/1a1a1a/6366f1?text=Statics";

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

/** Build absolute OG image URL. Prefer shareImageUrl, fallback to thumbnailUrl; always return an absolute URL. */
function absoluteOgImage(base: string, shareImageUrl: string, thumbnailUrl: string): string {
  const raw = (shareImageUrl || thumbnailUrl || "").trim();
  if (!raw) return DEFAULT_OG_IMAGE;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  const full = `${base.replace(/\/$/, "")}${path}`;
  return full.replace(/([^:]\/)\/+/g, "$1");
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repo = getAppRepository();
  const app = await repo.getBySlug(slug);
  if (!app) return { title: "App not found" };
  const base = config.app.baseUrl.replace(/\/$/, "");
  const pageUrl = `${base}/apps/${app.slug}`;
  const imageUrl = absoluteOgImage(base, app.shareImageUrl ?? "", app.thumbnailUrl ?? "");
  return {
    title: app.shareTitle,
    description: app.shareDescription,
    openGraph: {
      title: app.shareTitle,
      description: app.shareDescription,
      url: pageUrl,
      type: "website",
      siteName: "Statics",
      images: [
        {
          url: imageUrl,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: app.shareTitle || app.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: app.shareTitle,
      description: app.shareDescription,
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
