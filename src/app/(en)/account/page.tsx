import { redirect } from "next/navigation";

/**
 * The account view now lives inside the AI Search Monitor shell (the dashboard's
 * "Account" header tab), so it shares the header + nav panel and the light theme.
 * `/account` stays a stable, linkable URL and just routes there; the dashboard
 * gate handles auth (signed-out visitors get the sign-in gate).
 */
export default function AccountPage() {
  redirect("/ai-search/dashboard?tab=account");
}
