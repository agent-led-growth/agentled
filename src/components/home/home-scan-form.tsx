"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { capture } from "@/lib/analytics";
import { EXAMPLE_URL } from "@/components/ai-search/fixtures";

/** Home scan CTA → the same onboarding flow as the /ai-search landing. */
export function HomeScanForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const domain = url.trim();
    if (!domain) return;
    capture("scan_started", { domain, source: "home" });
    router.push(`/ai-search/onboarding?url=${encodeURIComponent(domain)}`);
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-[440px] flex-col gap-[10px]">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={EXAMPLE_URL}
        aria-label="Your website"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="h-[54px] w-full border border-[var(--border-hairline)] bg-[var(--field-bg)] px-[18px] text-[16px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] md:h-[58px] md:text-[17px]"
      />
      <button
        type="submit"
        disabled={!url.trim()}
        className="grid h-[54px] place-items-center bg-[var(--btn-bg)] px-[30px] text-[16px] font-bold text-[var(--btn-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:h-[58px] md:text-[17px]"
      >
        Scan my brand
      </button>
    </form>
  );
}
