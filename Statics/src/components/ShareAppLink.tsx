"use client";

import { useState } from "react";

interface ShareAppLinkProps {
  shareUrl: string;
  appName: string;
  className?: string;
}

export function ShareAppLink({ shareUrl, appName, className = "" }: ShareAppLinkProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: appName,
          url: shareUrl,
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
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={
        className ||
        "rounded-lg border border-white/20 px-6 py-3 text-gray-300 hover:bg-white/5 hover:text-white inline-flex items-center gap-2 min-h-[44px]"
      }
      aria-label="Share link"
    >
      {copied ? (
        <>
          <span className="text-green-400">Link copied!</span>
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share link
        </>
      )}
    </button>
  );
}
