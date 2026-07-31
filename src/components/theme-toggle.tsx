"use client";

import { useTheme } from "@/lib/use-theme";

/**
 * Not in the original handoff. Kept deliberately quiet and square-cornered so
 * it sits inside the brand rules rather than announcing itself next to the CTA.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  // Render the frame during SSR but leave the glyph out until the client has
  // resolved the theme, so the layout never shifts.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme ? `Switch to ${theme === "dark" ? "light" : "dark"} theme` : "Switch theme"
      }
      title={theme === "dark" ? "Light theme" : "Dark theme"}
      className="grid size-[30px] shrink-0 place-items-center border border-[var(--border-hairline)] text-[var(--text-muted)] transition-colors hover:border-[var(--text-faint)] hover:text-[var(--text-primary)] md:size-[34px]"
    >
      {theme === null ? null : theme === "dark" ? (
        // Sun — clicking goes to light.
        <svg
          viewBox="0 0 24 24"
          className="size-[15px] md:size-[16px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="square"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3M4.8 4.8l2.1 2.1M17.1 17.1l2.1 2.1M19.2 4.8l-2.1 2.1M6.9 17.1l-2.1 2.1" />
        </svg>
      ) : (
        // Moon — clicking goes to dark.
        <svg
          viewBox="0 0 24 24"
          className="size-[15px] md:size-[16px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden="true"
        >
          <path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7Z" />
        </svg>
      )}
    </button>
  );
}
