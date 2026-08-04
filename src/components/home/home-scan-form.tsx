"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Home scan CTA → the same onboarding flow as the /ai-search landing. */
export function HomeScanForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/ai-search/onboarding?url=${encodeURIComponent(url.trim())}`);
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-[440px] flex-col gap-[10px]">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="yourcompany.com"
        aria-label="Your website"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="h-[54px] w-full border border-[var(--border-hairline)] bg-[var(--field-bg)] px-[18px] text-[16px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] md:h-[58px] md:text-[17px]"
      />
      <button
        type="submit"
        className="grid h-[54px] place-items-center bg-[var(--btn-bg)] px-[30px] text-[16px] font-bold text-[var(--btn-fg)] transition-opacity hover:opacity-90 md:h-[58px] md:text-[17px]"
      >
        Scan my brand
      </button>
    </form>
  );
}
