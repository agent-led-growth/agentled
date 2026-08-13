import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { NOINDEX } from "@/lib/metadata";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/session";

export const metadata: Metadata = {
  title: "Your account",
  robots: NOINDEX,
};

export default async function AccountPage() {
  const user = await getUser();
  // No valid session (or it expired and cannot be refreshed without a Proxy —
  // see README "Known constraints"): send them home, where the header's
  // Sign in modal lives.
  if (!user) redirect("/");

  // Read the app profile through the request-scoped server client so the
  // own-row RLS policy applies. Falls back to the auth email if the row is
  // somehow missing.
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("email, created_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const email = profile?.email ?? user.email ?? "your account";

  return (
    <PageShell eyebrow="Signed in" title="Your account">
      <p className="max-w-[46ch] text-[17px] leading-[1.5] text-[var(--text-muted)] md:text-[21px] md:leading-[1.45]">
        You&rsquo;re signed in as{" "}
        <span className="text-[var(--text-primary)]">{email}</span>. Your email
        is verified.
      </p>

      <form action="/api/auth/signout" method="post" className="mt-[6px]">
        <button
          type="submit"
          className="border border-[var(--border-hairline)] px-[20px] py-[12px] text-[15px] text-[var(--text-muted)] transition-colors hover:border-[var(--text-faint)] hover:text-[var(--text-primary)] md:text-[16px]"
        >
          Sign out
        </button>
      </form>
    </PageShell>
  );
}
