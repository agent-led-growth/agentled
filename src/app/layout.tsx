import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

import { ThemeScript } from "@/components/theme-script";

import "./globals.css";

// next/font downloads and self-hosts these at build time — no runtime request
// to the Google Fonts CDN, which is what the handoff asks for.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const title = "Agent-led Growth — Grow in the Age of AI";
const description =
  "Get research, experiments, and tools for the next generation of growth.";

export const metadata: Metadata = {
  metadataBase: new URL("https://agentled.co"),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "https://agentled.co",
    siteName: "Agent-led Growth",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0d0c" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Font variables must live on <html> so @theme's --font-display can resolve
    // them at :root. The theme itself is a data attribute rather than a class,
    // so React owning className here cannot clobber it on hydration.
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
