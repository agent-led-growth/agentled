import Link from "next/link";
import type { ReactNode } from "react";

const linkClass =
  "underline decoration-[var(--text-faint)] underline-offset-[3px] transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]";

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={linkClass}
    >
      {children}
    </a>
  );
}

const QUESTIONS: { q: string; a: ReactNode }[] = [
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
  },
  {
    q: "What is the AI Search Monitor?",
    a: (
      <>
        <p>
          The{" "}
          <Link href="/ai-search-monitor" className={linkClass}>
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
  },
];

/**
 * Built on native <details>/<summary> so it is keyboard- and
 * screen-reader-accessible with no JavaScript, and works even if hydration
 * never happens.
 */
export function Faq() {
  return (
    <section
      id="faq"
      className="border-t border-[var(--border-hairline)] bg-[var(--surface)] px-[26px] py-[56px] md:px-[64px] md:py-[100px]"
    >
      <div className="flex flex-col gap-[30px] md:flex-row md:gap-[80px]">
        <div className="md:w-[300px] md:shrink-0">
          <p className="font-mono text-[10.5px] tracking-[0.2em] text-[var(--text-faint)] uppercase md:text-[12px]">
            FAQ
          </p>
          <h2 className="mt-[14px] text-[34px] leading-[0.95] font-bold tracking-[-0.045em] text-[var(--text-primary)] md:text-[44px]">
            Questions,
            <br />
            answered
          </h2>
        </div>

        <ul className="flex max-w-[760px] list-none flex-col md:flex-1">
          {QUESTIONS.map((item) => (
            <li
              key={item.q}
              className="border-t border-[var(--border-hairline)] last:border-b"
            >
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-[20px] py-[20px] text-[17px] leading-[1.35] font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--accent)] md:py-[24px] md:text-[20px] [&::-webkit-details-marker]:hidden">
                  {item.q}
                  {/* Plus that becomes a minus — echoes the lockup mark. */}
                  <span
                    aria-hidden="true"
                    className="relative mt-[6px] block size-[13px] shrink-0 md:mt-[8px]"
                  >
                    <span className="absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2 bg-current" />
                    <span className="absolute top-0 left-1/2 h-full w-[2px] -translate-x-1/2 bg-current transition-transform duration-150 group-open:scale-y-0" />
                  </span>
                </summary>
                <div className="flex max-w-[62ch] flex-col gap-[14px] pb-[22px] text-[15px] leading-[1.55] text-[var(--text-muted)] md:pb-[26px] md:text-[17px]">
                  {item.a}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
