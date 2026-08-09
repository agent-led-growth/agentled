import Link from "next/link";

import { getDictionary } from "@/lib/i18n";

import { AntennaMark } from "./marks";

/**
 * Deliberately light-themed in BOTH hero themes — it is the one element that
 * stays white on dark, which is what makes it read as the primary product CTA.
 */
export function CtaChip({
  className = "",
  label = getDictionary("en").hero.ctaChip,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Link
      href="/ai-search"
      className={`inline-flex items-center gap-[11px] border border-border-light bg-white py-[9px] pr-[14px] pl-[9px] text-ink-2 no-underline transition-colors hover:border-[#b9bfb0] md:gap-[13px] md:pr-[20px] ${className}`}
    >
      <AntennaMark className="size-[26px] shrink-0 md:size-[30px]" />
      <span className="text-[14px] font-medium tracking-[-0.01em] md:text-[16px]">
        {label}
      </span>
      <span
        aria-hidden="true"
        className="font-mono text-[13px] text-olive md:text-[15px]"
      >
        ↗
      </span>
    </Link>
  );
}
