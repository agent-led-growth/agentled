import type { Dictionary } from "./index";

/**
 * Neutral Spanish marketing copy (targets all Spanish speakers, "tú" register).
 * Must satisfy `Dictionary` — the shape is enforced against the English
 * reference in `en.ts`, so a missing or renamed key is a compile error.
 *
 * Brand and product names stay in English by design: "Agent-led Growth" and
 * "AI Search Monitor" are the canonical entity names (see llms.txt).
 */
export const es: Dictionary = {
  hero: {
    headline: "Crece en la era de la IA",
    subhead:
      "Investigación, experimentos y herramientas para la próxima generación del crecimiento.",
    subscribe: "Suscríbete",
    ctaChip: "Prueba el AI Search Monitor",
  },
  faq: {
    eyebrow: "FAQ",
    heading: ["Preguntas,", "respondidas"],
  },
  aiSearch: {
    headline: "¿La IA recomienda tu marca?",
    subhead:
      "Domina tu visibilidad en la IA y consigue más recomendaciones, tráfico y leads.",
    modelsEyebrow: "Monitoriza los principales modelos y asistentes de IA",
    brandMarker: "Tu marca",
  },
  footer: {
    switchLabel: "English",
  },
  meta: {
    siteTitle: "Agent-led Growth — Crece en la era de la IA",
    siteDescription:
      "Investigación independiente sobre cómo la IA está cambiando la forma en que crecen las empresas. Investigación, experimentos, marcos y herramientas para founders, marketers y equipos de crecimiento.",
    siteSocialDescription:
      "Exploramos los nuevos manuales de crecimiento en un mundo moldeado por agentes de IA.",
    aiSearch: {
      title: "AI Search Monitor",
      description:
        "Descubre con qué frecuencia los asistentes de IA recomiendan tu marca. Monitoriza tu visibilidad en ChatGPT, Claude, Gemini, Perplexity y Copilot, y consigue más recomendaciones, tráfico y leads.",
      ogTitle: "AI Search Monitor — ¿La IA recomienda tu marca?",
      ogDescription:
        "Monitoriza con qué frecuencia los asistentes de IA recomiendan tu marca en ChatGPT, Claude, Gemini, Perplexity y Copilot.",
    },
  },
};
