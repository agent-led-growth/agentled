import { SOCIALS } from "./socials";

const COMPANY = "Campo Base Labs SL";
const YEAR = 2026;

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border-hairline)] bg-[var(--surface)] px-[26px] py-[34px] md:px-[64px] md:py-[40px]">
      <div className="flex flex-col gap-[26px] md:flex-row md:items-center md:justify-between md:gap-[40px]">
        <p className="font-mono text-[11px] tracking-[0.12em] text-[var(--text-faint)] uppercase md:text-[12px]">
          {COMPANY}, {YEAR}
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
    </footer>
  );
}
