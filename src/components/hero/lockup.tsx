import { PlusMark } from "./marks";

/** Mark + stacked wordmark. 40px mark / 17.9px type on desktop, 31.5 / 13.7 on mobile. */
export function Lockup() {
  return (
    <div className="flex items-center gap-[11px] md:gap-[14px]">
      <PlusMark className="size-[31.5px] shrink-0 md:size-[40px]" />
      <span className="text-[13.7px] leading-[0.95] font-bold tracking-[-0.04em] text-[var(--text-primary)] md:text-[17.9px]">
        AGENT-LED
        <br />
        GROWTH
      </span>
    </div>
  );
}
