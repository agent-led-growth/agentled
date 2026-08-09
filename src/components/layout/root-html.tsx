import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";

import { PostHogAuth } from "@/components/analytics/posthog-auth";
import type { Locale } from "@/lib/i18n";

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

/**
 * The shared <html>/<body> shell. Each locale route group has its own root
 * layout (Next allows one <html> per group), and they must not drift, so the
 * scaffolding lives here and each layout only supplies `lang`.
 *
 * Font variables must live on <html> so @theme's --font-display can resolve
 * them at :root. Theme is dark-only: data-theme is fixed here (a data
 * attribute, not a class, so React owning className cannot clobber it), and
 * colorScheme keeps native controls/scrollbars dark.
 */
export function RootHtml({
  lang,
  children,
}: Readonly<{ lang: Locale; children: React.ReactNode }>) {
  return (
    <html
      lang={lang}
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
