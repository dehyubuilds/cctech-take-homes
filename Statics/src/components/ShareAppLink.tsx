"use client";

import { useState } from "react";

interface ShareAppLinkProps {
  /** Full URL to share (use when you have it, e.g. canonical on server). */
  shareUrl?: string;
  /** Path to append to origin (e.g. `/apps/march-madness`). Used when full URL isn’t available at render (e.g. dashboard). */
  path?: string;
  appName: string;
  className?: string;
  /** Icon-only style (no “Share link” text). */
  iconOnly?: boolean;
}

export function ShareAppLink({ shareUrl: shareUrlProp, path, appName, className = "", iconOnly = false }: ShareAppLinkProps) {
  const [copied, setCopied] = useState(false);

  function getShareUrl(): string {
    if (shareUrlProp) return shareUrlProp;
    if (typeof window !== "undefined" && path) {
      const p = path.startsWith("/") ? path : `/${path}`;
      return `${window.location.origin}${p}`;
    }
    return "";
  }

  async function handleShare() {
    const url = getShareUrl();
    if (!url) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: appName,
          url,
          text: `Subscribe to ${appName}`,
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const ShareIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );

  const baseClass =
    className ||
    (iconOnly
      ? "rounded-lg border border-white/20 p-3 text-gray-300 hover:bg-white/5 hover:text-white inline-flex items-center justify-center min-h-[44px] min-w-[44px]"
      : "rounded-lg border border-white/20 px-6 py-3 text-gray-300 hover:bg-white/5 hover:text-white inline-flex items-center gap-2 min-h-[44px]");

  return (
    <button
      type="button"
      onClick={handleShare}
      className={baseClass}
      aria-label={copied ? "Link copied" : "Share link"}
      title="Share link"
    >
      {copied ? (
        <span className={iconOnly ? "text-green-400" : "text-green-400"}>
          {iconOnly ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            "Link copied!"
          )}
        </span>
      ) : (
        <>
          <ShareIcon />
          {!iconOnly && "Share link"}
        </>
      )}
    </button>
  );
}
