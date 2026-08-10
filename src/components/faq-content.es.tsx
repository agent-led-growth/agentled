import Link from "next/link";

import { type FaqItem, ExternalLink, linkClass } from "./faq-content";

/**
 * Copia de las FAQ en español, en un solo lugar.
 *
 * Cada elemento incluye tanto la respuesta renderizada (`a`, que puede
 * contener enlaces y varios párrafos) como una versión en texto plano
 * (`plain`) para el JSON-LD de FAQPage. Ambas deben decir lo mismo: los
 * buscadores tratan como discrepancia los datos estructurados que no
 * coinciden con la página visible, así que mantenlas sincronizadas al editar.
 */
export const FAQ_ITEMS_ES: FaqItem[] = [
  {
    q: "¿Qué es Agent-led Growth?",
    a: (
      <p>
        Agent-led Growth es una publicación de investigación independiente sobre
        cómo la IA está cambiando la forma en que crecen las empresas. Publicamos
        investigaciones, experimentos, frameworks y herramientas para ayudar a
        fundadores, marketers y equipos de crecimiento a adaptarse a un mundo
        donde la IA influye cada vez más en el descubrimiento, la evaluación, la
        compra y la interacción con los clientes.
      </p>
    ),
    plain:
      "Agent-led Growth es una publicación de investigación independiente sobre cómo la IA está cambiando la forma en que crecen las empresas. Publicamos investigaciones, experimentos, frameworks y herramientas para ayudar a fundadores, marketers y equipos de crecimiento a adaptarse a un mundo donde la IA influye cada vez más en el descubrimiento, la evaluación, la compra y la interacción con los clientes.",
  },
  {
    q: "¿Para quién es Agent-led Growth?",
    a: (
      <p>
        Agent-led Growth es para fundadores, marketers, equipos de producto y
        líderes de crecimiento que quieren entender cómo la IA y los agentes están
        redefiniendo el crecimiento. Ya sea que estés explorando AI Search, el
        descubrimiento agéntico, los agentes de IA o nuevas estrategias de
        go-to-market, nuestra investigación y nuestras herramientas están pensadas
        para ayudarte a ir un paso por delante.
      </p>
    ),
    plain:
      "Agent-led Growth es para fundadores, marketers, equipos de producto y líderes de crecimiento que quieren entender cómo la IA y los agentes están redefiniendo el crecimiento. Ya sea que estés explorando AI Search, el descubrimiento agéntico, los agentes de IA o nuevas estrategias de go-to-market, nuestra investigación y nuestras herramientas están pensadas para ayudarte a ir un paso por delante.",
  },
  {
    q: "¿Qué es el AI Search Monitor?",
    a: (
      <>
        <p>
          El{" "}
          <Link href="/es/ai-search" className={linkClass}>
            AI Search Monitor
          </Link>{" "}
          te ayuda a entender cómo presentan tu marca los asistentes de IA.
        </p>
        <p>
          Introduce tu empresa, marca o producto y analizaremos cómo plataformas
          de IA como ChatGPT, Claude, Gemini y otras mencionan tu negocio, qué
          competidores aparecen junto a ti y en qué puntos podrías estar
          infrarrepresentado.
        </p>
        <p>
          El objetivo es ayudarte a medir, monitorizar y mejorar tu visibilidad
          en las plataformas de descubrimiento impulsadas por IA.
        </p>
      </>
    ),
    plain:
      "El AI Search Monitor te ayuda a entender cómo presentan tu marca los asistentes de IA. Introduce tu empresa, marca o producto y analizaremos cómo plataformas de IA como ChatGPT, Claude, Gemini y otras mencionan tu negocio, qué competidores aparecen junto a ti y en qué puntos podrías estar infrarrepresentado. El objetivo es ayudarte a medir, monitorizar y mejorar tu visibilidad en las plataformas de descubrimiento impulsadas por IA.",
  },
  {
    q: "¿Quién está detrás de Agent-led Growth?",
    a: (
      <p>
        Agent-led Growth fue fundada por{" "}
        <ExternalLink href="https://www.linkedin.com/in/hugosantana8/">
          Hugo Santana
        </ExternalLink>
        , científico de datos y emprendedor con más de 10 años de experiencia
        creando empresas de IA, analítica y tecnología.
      </p>
    ),
    plain:
      "Agent-led Growth fue fundada por Hugo Santana, científico de datos y emprendedor con más de 10 años de experiencia creando empresas de IA, analítica y tecnología.",
  },
  {
    q: "¿Dónde puedo leer ediciones anteriores?",
    a: (
      <p>
        Puedes leer nuestra investigación, frameworks y herramientas{" "}
        <ExternalLink href="https://agentledco.substack.com">
          en Substack
        </ExternalLink>
        .
      </p>
    ),
    plain:
      "Puedes leer nuestra investigación, frameworks y herramientas en Substack en https://agentledco.substack.com.",
  },
  {
    q: "¿Cómo me suscribo?",
    a: (
      <p>
        Suscríbete gratis en agentled.co para recibir nuevas investigaciones,
        experimentos, herramientas e ideas prácticas sobre el futuro del
        crecimiento en la era de la IA.
      </p>
    ),
    plain:
      "Suscríbete gratis en agentled.co para recibir nuevas investigaciones, experimentos, herramientas e ideas prácticas sobre el futuro del crecimiento en la era de la IA.",
  },
];
