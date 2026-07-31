export const THEME_STORAGE_KEY = "agentled-theme";
export const THEME_ATTR = "data-theme";

/**
 * Runs before first paint so the correct theme is applied without a flash of
 * the wrong palette. Kept as a raw inline script deliberately — a React effect
 * would run too late.
 *
 * Writes an attribute rather than a class: React owns `className` on <html>
 * (for the next/font variables) and would overwrite a class on hydration.
 */
const script = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var t=d?"dark":"light";document.documentElement.setAttribute(${JSON.stringify(
  THEME_ATTR,
)},t);document.documentElement.style.colorScheme=t;}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
