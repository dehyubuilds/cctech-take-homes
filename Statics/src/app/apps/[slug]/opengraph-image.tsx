import { ImageResponse } from "next/og";
import { getAppRepository } from "@/lib/repositories";
import { notFound } from "next/navigation";

export const alt = "Subscribe on Statics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const background = "#0f0f0f";
const brand = "#6366f1";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function AppOgImage({ params }: Props) {
  const { slug } = await params;
  const repo = getAppRepository();
  const app = await repo.getBySlug(slug);
  if (!app) notFound();

  const title = app.name;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: background,
          fontFamily: "system-ui, sans-serif",
          padding: 80,
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            marginBottom: 28,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            maxWidth: 900,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 36,
            color: brand,
            fontWeight: 600,
          }}
        >
          Statics - Apps that text you what matters.
        </div>
      </div>
    ),
    { ...size }
  );
}
