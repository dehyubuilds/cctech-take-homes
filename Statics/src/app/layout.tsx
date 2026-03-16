import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { AuthProvider } from "@/components/AuthProvider";
import { config } from "@/lib/config";

// Absolute OG image URL so Facebook and other crawlers can fetch it (see app/opengraph-image.tsx)
const baseUrl = config.app.baseUrl.replace(/\/$/, "");
const defaultOgImage = `${baseUrl}/opengraph-image`;

export const metadata: Metadata = {
  title: "Statics | Apps that text you what matters.",
  description: "Apps that text you what matters.",
  metadataBase: new URL(config.app.baseUrl),
  openGraph: {
    title: "Statics",
    description: "Apps that text you what matters.",
    url: config.app.baseUrl,
    siteName: "Statics",
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: "Statics" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Statics",
    description: "Apps that text you what matters.",
    images: [defaultOgImage],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f0f0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta property="fb:app_id" content="123456789012345" />
      </head>
      <body className="min-h-screen bg-surface font-sans antialiased statics-body">
        <AuthProvider>
          <Nav />
          <main className="min-h-screen safe-bottom">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
