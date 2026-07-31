"use client";

import { useEffect, useRef } from "react";

import { createTraces, type TracesHandle } from "@/lib/traces";
import { currentTheme, useTheme } from "@/lib/use-theme";

/**
 * The canvas is masked so it dissolves into the copy: leftwards on desktop
 * (right 2/3 of the frame), and thinned through the middle band on mobile
 * where the headline and form sit.
 */
export function TracesCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const handle = useRef<TracesHandle | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    handle.current = createTraces(el, currentTheme());

    const onThemeChange = (e: Event) => {
      const next = (e as CustomEvent<"dark" | "light">).detail;
      handle.current?.setTheme(next);
    };
    window.addEventListener("themechange", onThemeChange);

    return () => {
      window.removeEventListener("themechange", onThemeChange);
      handle.current?.destroy();
      handle.current = null;
    };
  }, []);

  // Keep the module in step if the theme changed before the listener attached.
  useEffect(() => {
    if (theme) handle.current?.setTheme(theme);
  }, [theme]);

  // h-full is required rather than inset-y-0: a canvas is a replaced element,
  // so top/bottom insets do not stretch it — it would fall back to its
  // intrinsic aspect ratio, which the backing store then feeds back into.
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="traces-canvas pointer-events-none absolute top-0 right-0 h-full w-full md:w-2/3"
    />
  );
}
