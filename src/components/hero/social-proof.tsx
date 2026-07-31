import { BRANDS, USE_BRAND_LOGOS } from "./brands";

/**
 * "Read by people at" tiles. Each brand renders either a monochrome logo or a
 * monogram fallback, so swapping one in is a data change (see `brands.ts`)
 * rather than a markup change. Logos are tinted with `currentColor` and sized
 * to ~20px optical height inside the tile, per the handoff.
 */
export function SocialProof() {
  return (
    <div className="flex flex-col gap-[12px] pt-[4px] md:flex-row md:items-center md:gap-[20px] md:pt-[10px]">
      <span className="shrink-0 font-mono text-[10.5px] tracking-[0.2em] text-[var(--text-faint)] uppercase md:text-[12px]">
        Read by people at
      </span>
      <ul className="flex list-none items-center gap-[8px] md:gap-[9px]">
        {BRANDS.map((brand) => (
          <li
            key={brand.name}
            title={brand.name}
            className="grid size-[36px] place-items-center border border-[var(--border-hairline)] bg-[var(--tile-bg)] text-[var(--text-muted)] md:size-[38px]"
          >
            {USE_BRAND_LOGOS && brand.logo ? (
              <svg
                viewBox="0 0 24 24"
                className="size-[20px]"
                fill="currentColor"
                role="img"
                aria-label={brand.name}
              >
                <path d={brand.logo} />
              </svg>
            ) : (
              <span
                aria-label={brand.name}
                className="font-mono text-[11px] font-bold md:text-[11.5px]"
              >
                {brand.monogram}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
