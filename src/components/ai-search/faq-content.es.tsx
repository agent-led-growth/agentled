import type { FaqItem } from "@/components/faq-content";

/**
 * Copia de las FAQ en español para la landing del AI Search Monitor.
 *
 * Cada elemento incluye la respuesta renderizada (`a`) y una versión en
 * texto plano (`plain`) equivalente para el JSON-LD de FAQPage: mantén ambas
 * sincronizadas al editar.
 */
export const AI_SEARCH_FAQ_ITEMS_ES: FaqItem[] = [
  {
    q: "¿Qué es el AI Search Monitor?",
    a: (
      <p>
        AI Search Monitor es una herramienta de Agent-led Growth (agentled.co)
        que rastrea si los asistentes de IA te mencionan y te recomiendan cuando
        la gente hace preguntas en tu categoría. Cada día lanza prompts reales a
        ChatGPT y Claude, revisa cada respuesta en busca de menciones de tu marca
        y citas de tu dominio, y lo convierte en un índice de visibilidad que
        puedes seguir a lo largo del tiempo.
      </p>
    ),
    plain:
      "AI Search Monitor es una herramienta de Agent-led Growth (agentled.co) que rastrea si los asistentes de IA te mencionan y te recomiendan cuando la gente hace preguntas en tu categoría. Cada día lanza prompts reales a ChatGPT y Claude, revisa cada respuesta en busca de menciones de tu marca y citas de tu dominio, y lo convierte en un índice de visibilidad que puedes seguir a lo largo del tiempo.",
  },
  {
    q: "¿Qué puede rastrear el AI Search Monitor?",
    a: (
      <p>
        Cualquier cosa con un sitio web o un dominio. Sitios web, apps, productos
        SaaS, tiendas de ecommerce, marcas, servicios, negocios locales,
        agencias, creadores y marcas personales, newsletters, proyectos de código
        abierto y repositorios de GitHub. Si un asistente de IA pudiera nombrarlo
        de forma plausible en una respuesta, AI Search Monitor puede rastrearlo.
        Lo único que aportas es un dominio.
      </p>
    ),
    plain:
      "Cualquier cosa con un sitio web o un dominio. Sitios web, apps, productos SaaS, tiendas de ecommerce, marcas, servicios, negocios locales, agencias, creadores y marcas personales, newsletters, proyectos de código abierto y repositorios de GitHub. Si un asistente de IA pudiera nombrarlo de forma plausible en una respuesta, AI Search Monitor puede rastrearlo. Lo único que aportas es un dominio.",
  },
  {
    q: "¿Cómo se mide la visibilidad de mi marca en las respuestas de IA?",
    a: (
      <p>
        AI Search Monitor lee tu sitio para entender qué haces, a quién te diriges
        y con quién compites, y luego genera los prompts que los compradores
        reales escriben en los asistentes de IA. Lanza esos prompts a diario y
        puntúa cada respuesta según si se nombra tu marca, si se cita tu dominio,
        qué lugar ocupas entre las opciones y qué competidores aparecen junto a
        ti. Tu puntuación es el porcentaje de respuestas monitorizadas en las que
        apareces.
      </p>
    ),
    plain:
      "AI Search Monitor lee tu sitio para entender qué haces, a quién te diriges y con quién compites, y luego genera los prompts que los compradores reales escriben en los asistentes de IA. Lanza esos prompts a diario y puntúa cada respuesta según si se nombra tu marca, si se cita tu dominio, qué lugar ocupas entre las opciones y qué competidores aparecen junto a ti. Tu puntuación es el porcentaje de respuestas monitorizadas en las que apareces.",
  },
  {
    q: "¿Qué asistentes de IA y modelos de lenguaje se monitorizan?",
    a: (
      <p>
        ChatGPT y Claude por ahora, y pronto habrá más. Puedes ver tu puntuación
        por asistente o promediada entre todos. La visibilidad rara vez es
        idéntica entre modelos, y la diferencia entre ellos suele ser lo más útil
        del panel.
      </p>
    ),
    plain:
      "ChatGPT y Claude por ahora, y pronto habrá más. Puedes ver tu puntuación por asistente o promediada entre todos. La visibilidad rara vez es idéntica entre modelos, y la diferencia entre ellos suele ser lo más útil del panel.",
  },
  {
    q: "¿Con qué frecuencia se actualiza mi visibilidad?",
    a: (
      <p>
        A diario. Cada prompt se vuelve a lanzar una vez al día contra todos los
        asistentes que monitorizas, y cada ejecución se añade a tu historial en
        lugar de reemplazar la anterior. Las respuestas de IA son volátiles, así
        que una sola comprobación no te dice casi nada. El muestreo diario es lo
        que convierte el ruido en una tendencia.
      </p>
    ),
    plain:
      "A diario. Cada prompt se vuelve a lanzar una vez al día contra todos los asistentes que monitorizas, y cada ejecución se añade a tu historial en lugar de reemplazar la anterior. Las respuestas de IA son volátiles, así que una sola comprobación no te dice casi nada. El muestreo diario es lo que convierte el ruido en una tendencia.",
  },
  {
    q: "¿En qué se diferencia esto de las herramientas de SEO tradicionales?",
    a: (
      <p>
        Las herramientas de SEO miden enlaces posicionados frente a keywords,
        usando un índice público que cualquiera puede consultar. AI Search Monitor
        mide si te nombran dentro de una respuesta generada, donde no hay ranking
        ni índice. Rastreas prompts en lugar de keywords, menciones y citas en
        lugar de posiciones, y un conjunto de competidores que elige el asistente
        en lugar de uno que eliges tú. Sigues necesitando tu herramienta de SEO.
        Esto cubre la superficie que ella no puede ver.
      </p>
    ),
    plain:
      "Las herramientas de SEO miden enlaces posicionados frente a keywords, usando un índice público que cualquiera puede consultar. AI Search Monitor mide si te nombran dentro de una respuesta generada, donde no hay ranking ni índice. Rastreas prompts en lugar de keywords, menciones y citas en lugar de posiciones, y un conjunto de competidores que elige el asistente en lugar de uno que eliges tú. Sigues necesitando tu herramienta de SEO. Esto cubre la superficie que ella no puede ver.",
  },
  {
    q: "¿El AI Search Monitor es gratis?",
    a: (
      <p>
        Sí, hay un análisis gratuito y no hace falta tarjeta de crédito. Introduce
        tu dominio, observa cómo el análisis en vivo descubre tu categoría y tus
        competidores, elige hasta tres temas e introduce tu email para abrir tu
        panel. El plan gratuito mantiene esos temas actualizados a diario. Los
        planes de pago añaden más prompts y un seguimiento más profundo de la
        competencia.
      </p>
    ),
    plain:
      "Sí, hay un análisis gratuito y no hace falta tarjeta de crédito. Introduce tu dominio, observa cómo el análisis en vivo descubre tu categoría y tus competidores, elige hasta tres temas e introduce tu email para abrir tu panel. El plan gratuito mantiene esos temas actualizados a diario. Los planes de pago añaden más prompts y un seguimiento más profundo de la competencia.",
  },
  {
    q: "¿Por qué mi marca no aparece en las respuestas de ChatGPT?",
    a: (
      <p>
        Normalmente por una de cuatro razones. Tu sitio no dice con claridad qué
        haces y para quién. No tienes cobertura de terceros, y los asistentes se
        apoyan más en reseñas, comparativas y directorios que en tu propio
        marketing. La forma en que describes tu categoría no coincide con cómo
        formulan los compradores sus prompts. O eres demasiado nuevo y las fuentes
        aún no te han recogido. AI Search Monitor te muestra qué competidores se
        nombran en tu lugar y qué fuentes se citan en vez de las tuyas.
      </p>
    ),
    plain:
      "Normalmente por una de cuatro razones. Tu sitio no dice con claridad qué haces y para quién. No tienes cobertura de terceros, y los asistentes se apoyan más en reseñas, comparativas y directorios que en tu propio marketing. La forma en que describes tu categoría no coincide con cómo formulan los compradores sus prompts. O eres demasiado nuevo y las fuentes aún no te han recogido. AI Search Monitor te muestra qué competidores se nombran en tu lugar y qué fuentes se citan en vez de las tuyas.",
  },
  {
    q: "¿Esto es GEO, AEO o LLMO? ¿Son lo mismo?",
    a: (
      <p>
        En líneas generales, sí. Generative Engine Optimization, Answer Engine
        Optimization y Large Language Model Optimization son etiquetas que compiten
        por el mismo objetivo: que te recomienden dentro de las respuestas
        generadas por IA en lugar de posicionarte en una lista de enlaces.
        Agent-led Growth lo considera una capa de un cambio más amplio, en el que
        los agentes se convierten en la audiencia y, cada vez más, en el
        comprador. AI Search Monitor es la capa de medición para ello, gane el
        acrónimo que gane.
      </p>
    ),
    plain:
      "En líneas generales, sí. Generative Engine Optimization, Answer Engine Optimization y Large Language Model Optimization son etiquetas que compiten por el mismo objetivo: que te recomienden dentro de las respuestas generadas por IA en lugar de posicionarte en una lista de enlaces. Agent-led Growth lo considera una capa de un cambio más amplio, en el que los agentes se convierten en la audiencia y, cada vez más, en el comprador. AI Search Monitor es la capa de medición para ello, gane el acrónimo que gane.",
  },
  {
    q: "¿Qué prompts se rastrean y puedo cambiarlos?",
    a: (
      <p>
        AI Search Monitor sugiere prompts a partir de tu sitio, tu categoría y tus
        competidores, y luego te los entrega. Cada prompt es totalmente editable.
        Añade los que tus compradores realmente preguntan, reescribe los que no
        acertaron y elimina cualquier cosa irrelevante. Los mejores prompts suelen
        ser los que escuchas en las llamadas de ventas, así que la lista está
        pensada para editarse, no para aceptarse tal cual.
      </p>
    ),
    plain:
      "AI Search Monitor sugiere prompts a partir de tu sitio, tu categoría y tus competidores, y luego te los entrega. Cada prompt es totalmente editable. Añade los que tus compradores realmente preguntan, reescribe los que no acertaron y elimina cualquier cosa irrelevante. Los mejores prompts suelen ser los que escuchas en las llamadas de ventas, así que la lista está pensada para editarse, no para aceptarse tal cual.",
  },
];
