import type { FaqItem } from "@/components/faq-content";
import { getDictionary, type Locale } from "@/lib/i18n";
import { SITE } from "@/lib/site";

/**
 * JSON-LD for answer engines and rich results.
 *
 * This is the highest-leverage SEO/AEO artifact on the site: it states the
 * facts (what this is, who runs it, what the FAQ says) in a form a crawler or
 * LLM can consume without having to infer them from prose.
 *
 * Rendered per page and per locale:
 * - Organization is the one canonical, language-neutral entity (same `@id`
 *   on every page).
 * - WebSite is per-locale (`inLanguage`, own `@id`/url for /es).
 * - FAQPage is per-page (its `@id` is the page URL) with that page's items.
 *
 * `@id` values cross-reference the nodes so the graph resolves as connected
 * entities rather than unrelated blobs.
 */
export function StructuredData({
  locale,
  path,
  faqItems,
}: {
  locale: Locale;
  /** This page's canonical path (e.g. "/", "/es", "/ai-search"). */
  path: string;
  faqItems: FaqItem[];
}) {
  const dict = getDictionary(locale);
  const orgId = `${SITE.url}/#organization`;
  const siteBase = locale === "en" ? SITE.url : `${SITE.url}/${locale}`;
  const websiteId = `${siteBase}/#website`;
  const pageUrl = `${SITE.url}${path === "/" ? "" : path}`;

  const graph = [
    {
      "@type": "Organization",
      "@id": orgId,
      name: SITE.name,
      legalName: SITE.legalName,
      url: SITE.url,
      logo: { "@type": "ImageObject", url: `${SITE.url}/icon.svg` },
      description: SITE.description,
      sameAs: SITE.socials,
      founder: {
        "@type": "Person",
        name: SITE.founder.name,
        url: SITE.founder.linkedin,
        jobTitle: "Founder",
        description:
          "Data scientist and entrepreneur with more than 10 years of experience building AI, analytics, and technology companies.",
      },
    },
    {
      "@type": "WebSite",
      "@id": websiteId,
      url: siteBase,
      name: SITE.name,
      description: dict.meta.siteDescription,
      publisher: { "@id": orgId },
      inLanguage: locale,
    },
    {
      "@type": "FAQPage",
      "@id": `${pageUrl}/#faq`,
      isPartOf: { "@id": websiteId },
      inLanguage: locale,
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.plain },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      // Content is our own static data, not user input.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}
