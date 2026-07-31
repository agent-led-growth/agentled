import Image from "next/image";

import { BRANDS } from "./brands";

/**
 * "Read by people at" tiles.
 *
 * Tiles stay light in both themes, following the same rule the design applies
 * to the CTA chip. Real brand marks carry their own colours and baked-in
 * backgrounds (Gartner is white, Siemens teal), so a consistent light tile is
 * the only way all five read — and it keeps the row visually even.
 *
 * Logos are `unoptimized` on purpose: they are tiny static PNGs already at
 * their target size, so running them through the image optimizer on Workers
 * would add cost and a cold-start dependency for no gain.
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
            className="grid size-[36px] place-items-center border border-border-light bg-white md:size-[38px]"
          >
            <Image
              src={brand.logo}
              alt={brand.name}
              width={brand.size}
              height={brand.size}
              unoptimized
              className="size-[20px] object-contain"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
