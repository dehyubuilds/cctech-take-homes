import Link from "next/link";
import type { App } from "@/lib/domain";

interface AppCardProps {
  app: Pick<App, "appId" | "name" | "slug" | "description" | "thumbnailUrl" | "status" | "priceCents">;
  isSubscribed: boolean;
  canSubscribe?: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
}

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}/mo`;
}

export function AppCard({ app, isSubscribed, canSubscribe = true, onSubscribe, onUnsubscribe }: AppCardProps) {
  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-surface-elevated transition hover:border-white/20">
      <Link href={`/apps/${app.slug}`} className="block">
        <div className="aspect-video bg-surface-muted">
          {app.thumbnailUrl ? (
            <img
              src={app.thumbnailUrl}
              alt=""
              width={400}
              height={225}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              No image
            </div>
          )}
        </div>
        <div className="p-4">
          <h2 className="font-semibold text-white">{app.name}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-gray-400">
            {app.description}
          </p>
          <p className="mt-2 text-sm font-medium text-brand">
            {formatPrice(app.priceCents)}
          </p>
        </div>
      </Link>
      <div className="flex gap-2 border-t border-white/10 p-4">
        <Link
          href={`/app/${app.slug}`}
          className="flex-1 rounded-lg border border-white/20 py-3 min-h-[44px] flex items-center justify-center text-sm font-medium text-white hover:bg-white/5 active:bg-white/10"
        >
          View app
        </Link>
        {isSubscribed ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUnsubscribe();
            }}
            className="rounded-lg bg-red-500/20 px-4 py-3 min-h-[44px] text-sm font-medium text-red-400 hover:bg-red-500/30 active:bg-red-500/40"
          >
            Unsubscribe
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (canSubscribe) onSubscribe();
            }}
            disabled={!canSubscribe}
            title={!canSubscribe ? "Add and verify phone in Profile to subscribe" : undefined}
            className="rounded-lg bg-brand px-4 py-3 min-h-[44px] text-sm font-medium text-white hover:bg-brand-hover active:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Subscribe
          </button>
        )}
      </div>
    </article>
  );
}
