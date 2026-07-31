/**
 * Social-proof brands for the "Read by people at" tiles.
 *
 * Logos are the companies' own square icon marks (not their wordmarks), stored
 * as PNGs in `public/logos`. Source resolution varies because it is capped by
 * what each company publishes: Microsoft and Siemens ship 128px icons, while
 * Gartner, HP and CrewAI only publish 32px favicons.
 *
 * The marks remain the trademarks of their respective owners.
 */

export type Brand = {
  name: string;
  /** Fallback shown if the image is missing. */
  monogram: string;
  logo: string;
  /** Intrinsic width/height of the source file, for correct density hints. */
  size: number;
};

export const BRANDS: Brand[] = [
  { name: "Microsoft", monogram: "MS", logo: "/logos/microsoft.png", size: 128 },
  { name: "Gartner", monogram: "GA", logo: "/logos/gartner.png", size: 32 },
  { name: "HP", monogram: "HP", logo: "/logos/hp.png", size: 32 },
  { name: "Siemens", monogram: "SI", logo: "/logos/siemens.png", size: 128 },
  { name: "CrewAI", monogram: "CA", logo: "/logos/crewai.png", size: 32 },
];
