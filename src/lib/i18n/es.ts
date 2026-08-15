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
    socialProof: "Leído por gente de",
  },
  faq: {
    eyebrow: "FAQ",
    heading: ["Preguntas,", "respondidas"],
  },
  aiSearch: {
    headline: "¿Recomienda la IA tu marca?",
    subhead:
      "Domina tu visibilidad en la IA y consigue más recomendaciones, tráfico y leads.",
    modelsEyebrow: "Monitoriza los principales modelos y asistentes de IA",
    brandMarker: "Tu marca",
    scanButton: "Scanea mi marca",
    scanAriaLabel: "Tu sitio web",
  },
  pricing: {
    eyebrow: "Precios",
    headline: "Precios que escalan con tu visibilidad",
    subhead:
      "Empieza con un análisis gratuito. Mejora tu plan para seguimiento diario, más prompts y más marcas.",
    backToDashboard: "Volver a Mi Panel",
    checkout: {
      signInTitle: "Inicia sesión para continuar",
      signInSub:
        "Introduce tu email y te enviaremos un código de 6 dígitos. Una vez dentro, te llevamos directo al pago seguro.",
      error: "No se pudo iniciar el pago. Inténtalo de nuevo.",
      close: "Cerrar",
      manageTitle: "Ya tienes un plan",
      manageSub:
        "Ya tienes un plan de pago. Para cambiar de plan, actualizar tu tarjeta o cancelar, usa el portal de facturación seguro de Stripe.",
      manageCta: "Ir al portal de facturación",
    },
    billing: {
      monthly: "Mensual",
      yearly: "Anual",
      yearlyNote: "2 meses gratis",
    },
    perMonth: "/mes",
    perYear: "/año",
    freePrice: "Gratis",
    featured: "Más popular",
    currentPlan: "Plan actual",
    plans: {
      free: {
        name: "Free Scan",
        tagline: "Cualquiera con curiosidad por su visibilidad en la IA.",
        cta: "Empezar gratis",
      },
      starter: {
        name: "Starter",
        tagline: "Pequeñas empresas, creadores y founders en solitario.",
        cta: "Elegir Starter",
      },
      pro: {
        name: "Pro",
        tagline: "Empresas que trabajan activamente su visibilidad en la IA.",
        cta: "Elegir Pro",
      },
      business: {
        name: "Business",
        tagline: "Agencias y equipos que gestionan varias marcas.",
        cta: "Elegir Business",
      },
    },
    features: {
      brand: "marca",
      brands: "marcas",
      prompts: "prompts",
      oneTimeScan: "Análisis único",
      dailyScans: "Análisis diarios",
      weeklyReport: "Informe semanal",
      chatgpt: "ChatGPT",
      moreModelsSoon: "más modelos próximamente",
    },
  },
  footer: {
    tools: "Nuestras herramientas",
    company: "Empresa",
    privacy: "Política de privacidad",
    terms: "Términos y condiciones",
    languages: "Idiomas",
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
      ogTitle: "AI Search Monitor — ¿Recomienda la IA tu marca?",
      ogDescription:
        "Monitoriza con qué frecuencia los asistentes de IA recomiendan tu marca en ChatGPT, Claude, Gemini, Perplexity y Copilot.",
    },
    pricing: {
      title: "Precios",
      description:
        "Planes sencillos para seguir la visibilidad de tu marca en las respuestas de IA. Empieza con un análisis gratuito; mejora tu plan para análisis diarios, más prompts y más marcas.",
    },
  },
};
