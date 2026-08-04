import { FAQ_ITEMS, type FaqItem } from "./faq-content";

/**
 * Built on native <details>/<summary> so it is keyboard- and
 * screen-reader-accessible with no JavaScript, and works even if hydration
 * never happens. Defaults to the root copy in `faq-content.tsx` (shared with
 * the FAQPage JSON-LD); pass `items` to reuse the same style on other pages.
 */
export function Faq({ items = FAQ_ITEMS }: { items?: FaqItem[] }) {
  return (
    <section
      id="faq"
      className="border-t border-[var(--border-hairline)] bg-[var(--surface)] px-[26px] py-[56px] md:px-[64px] md:py-[100px]"
    >
      <div className="flex flex-col gap-[30px] md:flex-row md:gap-[80px]">
        <div className="md:w-[300px] md:shrink-0">
          <p className="font-mono text-[10.5px] tracking-[0.2em] text-[var(--text-faint)] uppercase md:text-[12px]">
            FAQ
          </p>
          <h2 className="mt-[14px] text-[34px] leading-[0.95] font-bold tracking-[-0.045em] text-[var(--text-primary)] md:text-[44px]">
            Questions,
            <br />
            answered
          </h2>
        </div>

        <ul className="flex max-w-[760px] list-none flex-col md:flex-1">
          {items.map((item) => (
            <li
              key={item.q}
              className="border-t border-[var(--border-hairline)] last:border-b"
            >
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-[20px] py-[20px] text-[17px] leading-[1.35] font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--accent)] md:py-[24px] md:text-[20px] [&::-webkit-details-marker]:hidden">
                  <h3 className="text-[17px] font-medium md:text-[20px]">
                    {item.q}
                  </h3>
                  {/* Plus that becomes a minus — echoes the lockup mark. */}
                  <span
                    aria-hidden="true"
                    className="relative mt-[6px] block size-[13px] shrink-0 md:mt-[8px]"
                  >
                    <span className="absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2 bg-current" />
                    <span className="absolute top-0 left-1/2 h-full w-[2px] -translate-x-1/2 bg-current transition-transform duration-150 group-open:scale-y-0" />
                  </span>
                </summary>
                <div className="flex max-w-[62ch] flex-col gap-[14px] pb-[22px] text-[15px] leading-[1.55] text-[var(--text-muted)] md:pb-[26px] md:text-[17px]">
                  {item.a}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
