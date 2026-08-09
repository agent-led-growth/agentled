import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";

import { PostHogAuth } from "@/components/analytics/posthog-auth";
import { OG_IMAGES, SITE } from "@/lib/site";

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title,
    // Secondary pages get "<page> — Agent-led Growth" without repeating it.
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.founder.name, url: SITE.founder.linkedin }],
  creator: SITE.founder.name,
  publisher: SITE.legalName,
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE.title,
    description: SITE.socialDescription,
    url: SITE.url,
    siteName: SITE.name,
    locale: "en_US",
    type: "website",
    images: OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.socialDescription,
    images: OG_IMAGES,
    creator: "@hsantana8",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: [
    // Unconditional entry first: Discord and some scrapers read the plain
    // theme-color for their embed accent and ignore media-scoped ones.
    { color: "#0b0d0c" },
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
    // them at :root. Theme is dark-only: data-theme is fixed here (a data
    // attribute, not a class, so React owning className cannot clobber it), and
    // colorScheme keeps native controls/scrollbars dark.
    <html
      lang="en"
      data-theme="dark"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="flex min-h-full flex-col">
        {children}
        {/* Keeps PostHog identity in sync with the Supabase session. */}
        <PostHogAuth />
      </body>
      {/* Ahrefs Web Analytics — loads once across all routes. next/script
          forwards data-key to the emitted <script> tag verbatim. */}
      <Script
        src="https://analytics.ahrefs.com/analytics.js"
        data-key="x5ZyneiLaXtn4o4wQ7/Zkw"
        strategy="afterInteractive"
      />
    </html>
  );
}
