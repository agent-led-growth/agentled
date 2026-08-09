import { en } from "./en";

/** Locales the site can serve. `es` landings are added under `/es/`. */
export type Locale = "en" | "es";

/** Shape shared by every locale dictionary, derived from the English reference. */
export type Dictionary = typeof en;

/**
 * Registered dictionaries. `Partial` on purpose: a locale can be declared in
 * `Locale` before its dictionary exists, and `getDictionary` falls back to
 * English so a missing translation never crashes a render.
 */
const dictionaries: Partial<Record<Locale, Dictionary>> = { en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}
