import type { Metadata } from "next";
import { config } from "@/lib/config";

const baseUrl = config.app.baseUrl.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(config.app.baseUrl),
  title: "Art of the Question",
  description:
    "High-signal interview questions, why they worked, and how to use them — not a clip tool, a signal engine.",
  openGraph: {
    title: "Art of the Question",
    description:
      "Identify, explain, and teach the questions that unlock real answers.",
    url: `${baseUrl}/art-of-the-question`,
    siteName: "Statics",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Art of the Question",
    description: "Questions that unlock answers.",
  },
};

export default function ArtOfTheQuestionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-zinc-100 antialiased">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-15%,rgba(244,114,182,0.11),transparent_50%),radial-gradient(ellipse_50%_40%_at_100%_0%,rgba(34,211,238,0.07),transparent_45%),radial-gradient(ellipse_40%_35%_at_0%_20%,rgba(168,85,247,0.05),transparent_40%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:56px_56px] opacity-[0.45]"
        aria-hidden
      />
      <div className="relative">{children}</div>
    </div>
  );
}
