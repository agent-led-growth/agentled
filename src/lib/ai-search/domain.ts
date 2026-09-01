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

/**
 * Whether a citation host is the brand's own site: the normalized host equals
 * the brand domain, or is a subdomain of it (`docs.farcaster.xyz` counts for
 * `farcaster.xyz`). Subdomain-as-brand still holds — `name.substack.com` matches
 * only its own subdomains, never the shared `substack.com`.
 */
export function isOwnDomain(brandDomain: string, host: string): boolean {
  const brand = normalizeDomain(brandDomain);
  const h = normalizeDomain(host);
  return brand !== "" && (h === brand || h.endsWith(`.${brand}`));
}

/**
 * Whether a submitted value is a usable website: it normalizes to a plausible
 * hostname — dot-separated labels ending in a 2+ letter TLD, ASCII letters,
 * digits and hyphens only. Blocks scripts, prose, and junk; a bare domain (no
 * scheme) is fine since normalizeDomain adds https:// for us. Websites only.
 */
export function isValidWebsite(input: string): boolean {
  const host = normalizeDomain(input);
  return /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host);
}
