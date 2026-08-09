"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { capture } from "@/lib/analytics";

import { BRAND } from "./fixtures";

/** Landing URL capture → onboarding, carrying the URL as a query param. */
export function ScanForm() {
  const router = useRouter();
  const [url, setUrl] = useState<string>(BRAND.url);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = url.trim() || BRAND.url;
    capture("scan_started", { domain: v, source: "ai-search" });
    router.push(`/ai-search/onboarding?url=${encodeURIComponent(v)}`);
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-[600px] flex-col gap-[10px] md:flex-row"
    >
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="yourcompany.com"
        aria-label="Your website"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="h-[56px] w-full px-[18px] text-[16px] placeholder:text-[var(--dim)] md:h-[64px] md:flex-1 md:px-[20px] md:text-[18px]"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--line)",
          color: "var(--ink)",
        }}
      />
      <button
        type="submit"
        className="grid h-[56px] shrink-0 place-items-center px-[30px] text-[17px] font-bold transition-opacity hover:opacity-90 md:h-[64px] md:text-[18px]"
        style={{ background: "var(--signal)", color: "var(--on-signal)" }}
      >
        Scan my brand
      </button>
    </form>
  );
}
