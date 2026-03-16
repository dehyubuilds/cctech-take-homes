import { ImageResponse } from "next/og";

export const alt = "Statics - Apps that text you what matters.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          backgroundColor: "#0f0f0f",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "white",
            marginBottom: 16,
          }}
        >
          Statics
        </div>
        <div
          style={{
            fontSize: 36,
            color: "#6366f1",
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
