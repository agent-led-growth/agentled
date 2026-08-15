import Link from "next/link";

import { HeaderAuth } from "@/components/auth/header-auth";
import { Lockup } from "@/components/hero/lockup";
import type { Locale } from "@/lib/i18n";
import type { LocalePaths } from "@/lib/metadata";

/**
 * The shared top header for the marketing surfaces (root landing + tool
 * landings). Lockup on the left links home; a Sign up / Sign in button on the
 * right opens the auth modal. No divider — it sits over the page background.
 *
 * `languageToggle`, when passed, renders a compact EN/ES switch just left of
 * the auth button. Only the two landings supply it; other pages that reuse
 * SiteHeader (e.g. the signed-in home) omit it.
 */
export function SiteHeader({
  languageToggle,
}: {
  languageToggle?: { locale: Locale; paths: LocalePaths };
}) {
  return (
    <header className="flex items-center justify-between gap-[16px] px-[26px] pt-[26px] md:px-[56px] md:pt-[44px]">
      <Link href="/" aria-label="Agent-led Growth — home" className="no-underline">
        <Lockup />
      </Link>
      <div className="flex items-center gap-[14px] md:gap-[18px]">
        {languageToggle && (
          <LanguageToggle
            locale={languageToggle.locale}
            paths={languageToggle.paths}
          />
        )}
        <HeaderAuth />
      </div>
    </header>
  );
}

const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
];

function LanguageToggle({
  locale,
  paths,
}: {
  locale: Locale;
  paths: LocalePaths;
}) {
  return (
    <div
      aria-label="Language"
      className="flex items-center gap-[7px] font-display text-[13px] md:text-[14px]"
    >
      {LOCALES.map((l, i) => (
        <span key={l.code} className="flex items-center gap-[7px]">
          {i > 0 && (
            <span aria-hidden="true" className="text-[var(--text-faint)]">
              /
            </span>
          )}
          {l.code === locale ? (
            <span aria-current="true" className="text-[var(--text-primary)]">
              {l.label}
            </span>
          ) : (
            <Link
              href={paths[l.code]}
              hrefLang={l.code}
              className="text-[var(--text-faint)] no-underline transition-colors hover:text-[var(--text-primary)]"
            >
              {l.label}
            </Link>
          )}
        </span>
      ))}
    </div>
  );
}
