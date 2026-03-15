import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Statics | Curated SMS Apps",
  description: "Subscribe to curated apps and receive SMS updates.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://statics.example.com"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
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
      <body className="min-h-screen bg-surface font-sans antialiased statics-body">
        <AuthProvider>
          <Nav />
          <main className="min-h-screen safe-bottom">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
