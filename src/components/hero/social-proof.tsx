import { BRANDS } from "./brands";

/**
 * "Read by people at" tiles.
 *
 * Marks are monochrome and inherit `currentColor` from the tile, so they follow
 * the theme — light grey on dark, dark grey on light — rather than carrying
 * their own brand colours. Vector marks render as inline SVG; the two
 * wordmark-only brands render their real letterform through a CSS mask over a
 * currentColor background (see `brands.ts`).
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
            className="grid size-[36px] place-items-center text-[var(--text-muted)] md:size-[38px]"
          >
            {brand.logo ? (
              <svg
                viewBox="0 0 24 24"
                className="size-[21px] md:size-[22px]"
                fill="currentColor"
                role="img"
                aria-label={brand.name}
              >
                <path d={brand.logo} />
              </svg>
            ) : brand.mask ? (
              <span
                role="img"
                aria-label={brand.name}
                className="size-[21px] bg-current md:size-[22px]"
                style={{
                  maskImage: `url(${brand.mask})`,
                  WebkitMaskImage: `url(${brand.mask})`,
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                }}
              />
            ) : (
              <span
                aria-label={brand.name}
                className="font-mono text-[10.5px] font-bold md:text-[11.5px]"
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
