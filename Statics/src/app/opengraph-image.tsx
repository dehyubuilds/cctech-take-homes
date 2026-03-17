import { ImageResponse } from "next/og";

export const alt = "Statics - Apps that text you what matters.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Match home page: surface background, just Statics + tagline (no blurb or button)
const background = "#0f0f0f";
const brand = "#6366f1";

export default async function Image() {
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
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            color: "white",
            marginBottom: 28,
            letterSpacing: "-0.02em",
          }}
        >
          Statics
        </div>
        <div
          style={{
            fontSize: 44,
            color: brand,
            fontWeight: 600,
          }}
        >
          Apps that text you what matters.
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
