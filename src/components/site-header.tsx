import Link from "next/link";

import { HeaderAuth } from "@/components/auth/header-auth";
import { Lockup } from "@/components/hero/lockup";

/**
 * The shared top header for the marketing surfaces (root landing + tool
 * landings). Lockup on the left links home; a Sign up / Sign in button on the
 * right opens the auth modal. No divider — it sits over the page background.
 */
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-[16px] px-[26px] pt-[26px] md:px-[56px] md:pt-[44px]">
      <Link href="/" aria-label="Agent-led Growth — home" className="no-underline">
        <Lockup />
      </Link>
      <HeaderAuth />
    </header>
  );
}
