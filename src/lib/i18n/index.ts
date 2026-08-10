import { en } from "./en";
import { es } from "./es";

/** Locales the site can serve. `es` landings live under `/es/`. */
export type Locale = "en" | "es";

/** Shape shared by every locale dictionary, derived from the English reference. */
export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en, es };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}
