/**
 * Placeholder copy — to be rewritten. Built on native <details>/<summary> so it
 * is keyboard- and screen-reader-accessible with no JavaScript, and still works
 * if hydration never happens.
 */
const QUESTIONS = [
  {
    q: "What is Agent-led Growth?",
    a: "A research publication about how growth works when AI agents — not people — are doing the searching, comparing and buying. Essays, experiments and tools, published in the open.",
  },
  {
    q: "Who is it for?",
    a: "Founders, growth and marketing teams who can feel that the old playbook is bending, and would rather run the experiments than wait for the case studies.",
  },
  {
    q: "How often do you publish?",
    a: "Roughly weekly. Every piece is either original research, a documented experiment with its numbers, or a tool you can use the same day.",
  },
  {
    q: "What is the AI Search Monitor?",
    a: "A tool that tracks how AI assistants find, cite and describe your brand — and tells you what to change when they get it wrong. It's in development now.",
  },
  {
    q: "What does it cost, and can I leave?",
    a: "It's free, and every email has a one-click unsubscribe. We never sell or share your address.",
  },
];

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
                <p className="max-w-[62ch] pb-[22px] text-[15px] leading-[1.55] text-[var(--text-muted)] md:pb-[26px] md:text-[17px]">
                  {item.a}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
