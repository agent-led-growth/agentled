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
      {/*
        Mobile: one centred column (icons → link columns → copyright).
        Desktop: icons top-left, link columns top-right, copyright at the
        bottom below the icons.
      */}
      <div className="flex flex-col items-center gap-[40px] text-center md:flex-row md:items-start md:gap-[80px] md:text-left">
        {/* Social links — text with an external-link arrow (↗ = leaves the site),
            styled as a labelled column like the link groups on the right. */}
        <nav aria-label="Social links" className="flex flex-col items-center gap-[16px] md:items-start">
          <p className={columnLabel}>{t.follow}</p>
          <ul className="flex list-none flex-col gap-[12px]">
            {SOCIALS.map((social) => (
              <li key={social.name}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`${footerLink} inline-flex items-center gap-[6px]`}
                >
                  {social.name}
                  {/* Decorative: the visible link text already names the target. */}
                  <span aria-hidden="true" className="text-[var(--text-faint)]">
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Link columns */}
        <div className="flex flex-col items-center gap-[40px] md:flex-row md:items-start md:gap-[80px]">
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
            <p className={columnLabel}>{t.company}</p>
            <ul className="flex list-none flex-col gap-[12px]">
              <li>
                <Link href="/privacy" className={footerLink}>
                  {t.privacy}
                </Link>
              </li>
              <li>
                <Link href="/terms" className={footerLink}>
                  {t.terms}
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

      {/* Copyright — bottom of the footer in both layouts. */}
      <p className="mt-[40px] text-center text-[13px] text-[var(--text-faint)] md:mt-[48px] md:text-left">
        {COMPANY}, <span className="num">{YEAR}</span>
      </p>
    </footer>
  );
}
