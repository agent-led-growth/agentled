"use client";

import { useCallback, useSyncExternalStore } from "react";

import { THEME_ATTR, THEME_STORAGE_KEY } from "@/components/theme-script";

export type Theme = "dark" | "light";

/** The theme currently applied to <html> by ThemeScript. */
export function currentTheme(): Theme {
  return document.documentElement.getAttribute(THEME_ATTR) === "dark"
    ? "dark"
    : "light";
}

const THEME_EVENT = "themechange";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

// The <html> attribute is the source of truth, so this is genuinely an external
// store — useSyncExternalStore keeps React in step without a setState-in-effect.
function getSnapshot(): Theme {
  return currentTheme();
}

// The server cannot know the visitor's theme. Returning null renders the
// theme-dependent bits as neutral until the client takes over, which keeps
// hydration consistent.
function getServerSnapshot(): Theme | null {
  return null;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTR, next);
    root.style.colorScheme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled — theme just won't persist.
    }
    // Notifies both useSyncExternalStore subscribers and the canvas module.
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
  }, []);

  const toggle = useCallback(() => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return { theme, setTheme, toggle };
}
