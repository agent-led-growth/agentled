/**
 * Social-proof brands for the "Read by people at" tiles.
 *
 * GENERATED — do not hand-edit the path data.
 *
 * Every mark is monochrome and tinted with currentColor, so the row follows the
 * theme instead of shipping baked-in brand colours.
 *
 * Two shapes of asset, because not every brand has a vector mark:
 *  - `logo`: a 24x24 path. Microsoft is constructed from its published
 *    proportions; HP and CrewAI come from Simple Icons (CC0-1.0 path data).
 *  - `mask`: a PNG alpha mask used with CSS `mask-image` over a currentColor
 *    background. Gartner and Siemens are wordmark brands with no vector symbol,
 *    so their real letterform is extracted from their favicon (see
 *    scripts/make-masks.js) rather than approximated in another typeface.
 *
 * The marks remain the trademarks of their respective owners.
 */

export type Brand = {
  name: string;
  /** Fallback if the asset ever fails to load. */
  monogram: string;
  /** 24x24 viewBox path. */
  logo?: string;
  /** URL of a white-on-transparent PNG alpha mask. */
  mask?: string;
};

export const BRANDS: Brand[] = [
  {
    name: "Microsoft",
    monogram: "MS",
    logo: "M1.5 1.5h10v10h-10zM12.5 1.5h10v10h-10zM1.5 12.5h10v10h-10zM12.5 12.5h10v10h-10z",
  },
  {
    name: "Gartner",
    monogram: "GA",
    mask: "/logos/gartner-mask.png",
  },
  {
    name: "HP",
    monogram: "HP",
    logo: "M12.0069 24h-.3572l2.459-6.7453h3.3796c.5907 0 1.2364-.4533 1.4424-1.0166l2.6652-7.3085c.4396-1.1952-.2473-2.1706-1.525-2.1706h-4.6983l-3.929 10.798-2.2255 6.127C3.929 22.434 0 17.6806 0 12.007 0 6.498 3.7092 1.8546 8.7647.4396L6.4705 6.759 2.6514 17.2547h2.5415L8.4488 8.339h1.9095l-3.2558 8.9158H9.644l3.0223-8.3251c.4396-1.1952-.2473-2.1706-1.525-2.1706h-2.143l2.459-6.7453C11.636 0 11.8145 0 11.9931 0 18.6285 0 24 5.3715 24 12.007c.0137 6.6216-5.3578 11.993-11.9931 11.993zM19.2742 8.325h-1.9096l-2.6789 7.336h1.9096l2.6789-7.336z",
  },
  {
    name: "Siemens",
    monogram: "SI",
    mask: "/logos/siemens-mask.png",
  },
  {
    name: "CrewAI",
    monogram: "CA",
    logo: "M12.482.18C7.161 1.319 1.478 9.069 1.426 15.372c-.051 5.527 3.1 8.68 8.68 8.627 6.716-.05 14.259-6.87 12.09-10.9-.672-1.292-1.396-1.344-2.687-.207-1.602 1.395-1.654.31-.207-2.893 1.757-3.98 1.705-5.322-.31-7.544C17.03.388 14.962-.388 12.482.181Zm5.322 2.068c2.273 2.015 2.376 4.236.465 8.42-1.395 3.1-2.17 3.515-3.824 1.86-1.24-1.24-1.343-3.46-.258-6.044 1.137-2.635.982-3.1-.568-1.653-3.72 3.358-6.458 9.765-5.424 12.503.464 1.189.825 1.395 2.737 1.395 2.79 0 6.303-1.705 7.957-3.926 1.756-2.274 2.79-2.274 2.79-.052 0 3.875-6.459 8.627-11.625 8.627-6.251 0-9.351-4.752-7.491-11.47.878-2.995 4.443-7.904 7.077-9.66 3.255-2.17 5.684-2.17 8.164 0z",
  },
];
