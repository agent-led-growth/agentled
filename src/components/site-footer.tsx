import Link from "next/link";

import { getDictionary, type Locale } from "@/lib/i18n";
import { PATHS } from "@/lib/metadata";

import { SOCIALS } from "./socials";

const COMPANY = "Campo Base Labs SL";
const YEAR = 2026;

const columnLabel = "eyebrow text-[var(--text-faint)]";
const footerLink =
  "text-[14px] text-[var(--text-muted)] no-underline transition-colors hover:text-[var(--text-primary)] md:text-[15px]";

/** Fixed language autonyms — shown the same in every locale. */
const LANGUAGES: { code: Locale; label: string; href: string }[] = [
  { code: "en", label: "English", href: PATHS.home.en },
  { code: "es", label: "Español", href: PATHS.home.es },
];

/**
 * `locale` drives the localized column labels and points the tool link at the
 * matching-language landing. Defaults to English for the app/auth pages that
 * render the footer without a locale.
 */
export function SiteFooter({ locale = "en" }: { locale?: Locale }) {
  const t = getDictionary(locale).footer;

  return (
    <footer className="border-t border-[var(--border-hairline)] bg-[var(--surface)] px-[26px] py-[40px] md:px-[64px] md:py-[48px]">
      <div className="flex flex-col gap-[40px] md:flex-row md:justify-between md:gap-[80px]">
        {/* Brand block */}
        <div className="flex flex-col gap-[22px]">
          <p className="eyebrow text-[var(--text-faint)]">
            {COMPANY}, <span className="num">{YEAR}</span>
          </p>

          <nav aria-label="Social links">
            {/*
              Negative margins cancel the padding the square tap targets add
              around each icon, so the row's optical edges line up with the
              container padding rather than sitting ~8px inside it.
            */}
            <ul className="-mx-[8px] flex list-none items-center gap-[4px] md:gap-[6px]">
              {SOCIALS.map((social) => (
                <li key={social.name}>
                  {/*
                    Icon-only, so the link needs an accessible name of its own —
                    without it a screen reader announces the bare URL. The square
                    target matches the theme toggle and keeps the tap area at a
                    comfortable size without the hit areas overlapping.
                  */}
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={social.name}
                    title={social.name}
                    className="grid size-[32px] place-items-center text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] md:size-[34px]"
                  >
                    {/* Height is per-icon (see socials.ts) so the glyphs match
                        optically rather than sharing one nominal size. */}
                    <svg
                      viewBox={social.viewBox}
                      style={{ height: social.height }}
                      className="w-auto shrink-0"
                      fill="currentColor"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d={social.path} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Link columns */}
        <div className="flex gap-[56px] md:gap-[80px]">
          <div className="flex flex-col gap-[16px]">
            <p className={columnLabel}>{t.tools}</p>
            <ul className="flex list-none flex-col gap-[12px]">
              <li>
                <Link href={PATHS.aiSearch[locale]} className={footerLink}>
                  AI Search Monitor
                </Link>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-[16px]">
            <p className={columnLabel}>{t.languages}</p>
            <ul className="flex list-none flex-col gap-[12px]">
              {LANGUAGES.map((lang) => (
                <li key={lang.code}>
                  {lang.code === locale ? (
                    <span
                      aria-current="true"
                      className="text-[14px] text-[var(--text-primary)] md:text-[15px]"
                    >
                      {lang.label}
                    </span>
                  ) : (
                    <Link
                      href={lang.href}
                      hrefLang={lang.code}
                      className={footerLink}
                    >
                      {lang.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
