import { FAQ_ITEMS } from "@/components/faq-content";
import { SITE } from "@/lib/site";

/**
 * JSON-LD for answer engines and rich results.
 *
 * This is the highest-leverage SEO/AEO artifact on the site: it states the
 * facts (what this is, who runs it, what the FAQ says) in a form a crawler or
 * LLM can consume without having to infer them from prose.
 *
 * `@id` values cross-reference the nodes so the graph resolves as one entity
 * rather than three unrelated blobs.
 */
export function StructuredData() {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
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
      "@id": `${SITE.url}/#website`,
      url: SITE.url,
      name: SITE.name,
      description: SITE.description,
      publisher: { "@id": `${SITE.url}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE.url}/#faq`,
      isPartOf: { "@id": `${SITE.url}/#website` },
      mainEntity: FAQ_ITEMS.map((item) => ({
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
