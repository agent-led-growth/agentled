import Link from "next/link";
import type { ReactNode } from "react";

/**
 * FAQ copy, in one place.
 *
 * Each item carries both the rendered answer (`a`, which may contain links and
 * multiple paragraphs) and a `plain` text version for the FAQPage JSON-LD.
 * They must say the same thing — search engines treat structured data that
 * does not match the visible page as a mismatch, so keep them in sync when
 * editing.
 */
export type FaqItem = {
  q: string;
  a: ReactNode;
  plain: string;
};

const linkClass =
  "underline decoration-[var(--text-faint)] underline-offset-[3px] transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]";

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={linkClass}>
      {children}
    </a>
  );
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is Agent-led Growth?",
    a: (
      <p>
        Agent-led Growth is an independent research publication about how AI is
        changing the way businesses grow. We publish research, experiments,
        frameworks, and tools to help founders, marketers, and growth teams
        adapt to a world where AI increasingly influences discovery, evaluation,
        buying, and customer interactions.
      </p>
    ),
    plain:
      "Agent-led Growth is an independent research publication about how AI is changing the way businesses grow. We publish research, experiments, frameworks, and tools to help founders, marketers, and growth teams adapt to a world where AI increasingly influences discovery, evaluation, buying, and customer interactions.",
  },
  {
    q: "Who is Agent-led Growth for?",
    a: (
      <p>
        Agent-led Growth is for founders, marketers, product teams, and growth
        leaders who want to understand how AI and agents are reshaping growth.
        Whether you&rsquo;re exploring AI Search, agentic discovery, AI agents,
        or new go-to-market strategies, our research and tools are designed to
        help you stay ahead.
      </p>
    ),
    plain:
      "Agent-led Growth is for founders, marketers, product teams, and growth leaders who want to understand how AI and agents are reshaping growth. Whether you're exploring AI Search, agentic discovery, AI agents, or new go-to-market strategies, our research and tools are designed to help you stay ahead.",
  },
  {
    q: "What is the AI Search Monitor?",
    a: (
      <>
        <p>
          The{" "}
          <Link href="/ai-search" className={linkClass}>
            AI Search Monitor
          </Link>{" "}
          helps you understand how AI assistants present your brand.
        </p>
        <p>
          Enter your company, brand, or product, and we&rsquo;ll analyze how AI
          platforms like ChatGPT, Claude, Gemini, and others mention your
          business, which competitors appear alongside you, and where you may be
          underrepresented.
        </p>
        <p>
          The goal is to help you measure, monitor, and improve your visibility
          across AI-powered discovery platforms.
        </p>
      </>
    ),
    plain:
      "The AI Search Monitor helps you understand how AI assistants present your brand. Enter your company, brand, or product, and we'll analyze how AI platforms like ChatGPT, Claude, Gemini, and others mention your business, which competitors appear alongside you, and where you may be underrepresented. The goal is to help you measure, monitor, and improve your visibility across AI-powered discovery platforms.",
  },
  {
    q: "Who is behind Agent-led Growth?",
    a: (
      <p>
        Agent-led Growth was founded by{" "}
        <ExternalLink href="https://www.linkedin.com/in/hugosantana8/">
          Hugo Santana
        </ExternalLink>
        , a data scientist and entrepreneur with more than 10 years of
        experience building AI, analytics, and technology companies.
      </p>
    ),
    plain:
      "Agent-led Growth was founded by Hugo Santana, a data scientist and entrepreneur with more than 10 years of experience building AI, analytics, and technology companies.",
  },
  {
    q: "Where can I read past issues?",
    a: (
      <p>
        You can read our research, frameworks, and tools{" "}
        <ExternalLink href="https://agentledco.substack.com">
          on Substack
        </ExternalLink>
        .
      </p>
    ),
    plain:
      "You can read our research, frameworks, and tools on Substack at https://agentledco.substack.com.",
  },
  {
    q: "How do I subscribe?",
    a: (
      <p>
        Subscribe for free at agentled.co to receive new research, experiments,
        tools, and practical insights about the future of growth in the age of
        AI.
      </p>
    ),
    plain:
      "Subscribe for free at agentled.co to receive new research, experiments, tools, and practical insights about the future of growth in the age of AI.",
  },
];
