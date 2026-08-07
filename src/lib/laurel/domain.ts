/**
 * Domain normalization — one rule, two callers: canonicalising a submitted
 * website before creating a brand, and canonicalising a citation host so
 * `is_own_domain` compares like with like. Pure/isomorphic, no secrets.
 *
 * Rule: lowercase, strip scheme, strip path/query, strip a leading `www.`, keep
 * meaningful subdomains (e.g. `name.substack.com` stays intact). `is_own_domain`
 * is an exact-host match on the result — right for subdomain-as-brand cases like
 * Substack, where `substack.com` (eTLD+1) would wrongly claim every newsletter.
 */
export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return trimmed;
  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname.replace(/^www\./, "");
  } catch {
    // Not a parseable URL — fall back to a rough strip.
    return trimmed
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  }
}

/** Whether a citation host is the brand's own site — exact normalized-host match. */
export function isOwnDomain(brandDomain: string, host: string): boolean {
  return normalizeDomain(brandDomain) === normalizeDomain(host);
}
