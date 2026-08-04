/* eslint-disable @next/next/no-img-element -- external Substack CDN thumbnails; next/image optimization isn't used on Cloudflare */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HomeScanForm } from "@/components/home/home-scan-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { hasScanned } from "@/lib/ai-search";
import { SUBSTACK_URL, getSubstackPosts } from "@/lib/substack";
import { getUser } from "@/lib/supabase/session";

export const metadata: Metadata = {
  title: "Home",
  robots: { index: false, follow: false },
};

const eyebrow =
  "font-mono text-[10.5px] tracking-[0.2em] text-[var(--text-faint)] uppercase md:text-[12px]";
const heading =
  "max-w-[16ch] text-[34px] leading-[1.0] font-bold tracking-[-0.045em] text-[var(--text-primary)] md:text-[44px]";
const sub =
  "max-w-[42ch] text-[16px] leading-[1.5] text-[var(--text-muted)] md:text-[18px]";

export default async function HomePage() {
  const user = await getUser();
  // Signed-out visitors go back to the root landing (Sign in modal lives there).
  if (!user) redirect("/");
  // Already scanned → straight to the dashboard; not scanned → the home scan CTA.
  if (await hasScanned(user.id)) redirect("/ai-search/dashboard");
  const posts = await getSubstackPosts(5);

  return (
    <div className="flex min-h-[100svh] flex-col bg-[var(--surface)]">
      <SiteHeader />

      <main className="flex-1 px-[26px] py-[40px] md:px-[56px] md:py-[56px]">
        <div className="grid gap-[30px] md:grid-cols-2 md:items-start md:gap-[40px]">
          {/* Left — scan CTA; sticks in view while the feed scrolls past */}
          <section className="flex flex-col gap-[20px] md:sticky md:top-[40px] md:self-start">
            <h1 className={heading}>Does AI recommend your brand?</h1>
            <p className={sub}>
              Scan your brand to start monitoring your visibility across AI
              answers.
            </p>
            <HomeScanForm />
          </section>

          {/* Right — RSS feed; scrolls independently, left column stays put */}
          <section
            className="flex flex-col"
            style={{ border: "1px solid var(--border-hairline)" }}
          >
            <div className="border-b border-[var(--border-hairline)] px-[22px] py-[16px]">
              <p className={eyebrow}>From the feed</p>
            </div>
            <div className="flex flex-col">
              {posts.length > 0 ? (
                posts.map((p) => (
                  <a
                    key={p.link}
                    href={p.link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex gap-[16px] border-b border-[var(--border-hairline)] px-[22px] py-[18px] no-underline transition-colors hover:bg-[var(--field-bg)]"
                  >
                    {p.image && (
                      <img
                        src={p.image}
                        alt=""
                        loading="lazy"
                        className="h-[96px] w-[144px] shrink-0 border border-[var(--border-hairline)] object-cover"
                      />
                    )}
                    <div className="flex min-w-0 flex-col gap-[5px]">
                      <span className="line-clamp-2 text-[15px] leading-[1.3] font-medium text-[var(--text-primary)]">
                        {p.title}
                      </span>
                      {p.description && (
                        <span className="line-clamp-2 text-[13px] leading-[1.4] text-[var(--text-muted)]">
                          {p.description}
                        </span>
                      )}
                      <span className="mt-[2px] font-mono text-[10.5px] tracking-[0.04em] text-[var(--text-faint)]">
                        {p.author}
                        {p.date ? ` · ${p.date}` : ""}
                      </span>
                    </div>
                  </a>
                ))
              ) : (
                <p className="px-[22px] py-[20px] text-[14px] text-[var(--text-faint)]">
                  Couldn&rsquo;t load the feed right now.
                </p>
              )}
            </div>

            <a
              href={SUBSTACK_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="shrink-0 border-t border-[var(--border-hairline)] px-[22px] py-[16px] font-mono text-[11px] tracking-[0.18em] text-[var(--text-muted)] uppercase no-underline transition-colors hover:text-[var(--text-primary)]"
            >
              Past articles →
            </a>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
