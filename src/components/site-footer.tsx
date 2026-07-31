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
          <ul className="flex list-none flex-wrap items-center gap-x-[24px] gap-y-[14px] md:gap-x-[30px]">
            {SOCIALS.map((social) => (
              <li key={social.name}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group inline-flex items-center gap-[9px] text-[14px] text-[var(--text-muted)] no-underline transition-colors hover:text-[var(--text-primary)] md:text-[15px]"
                >
                  <svg
                    viewBox={social.viewBox}
                    className="h-[15px] w-auto shrink-0 md:h-[16px]"
                    fill="currentColor"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d={social.path} />
                  </svg>
                  {social.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
