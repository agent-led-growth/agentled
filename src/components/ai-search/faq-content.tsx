import type { FaqItem } from "@/components/faq-content";

/**
 * FAQ copy for the AI Search Monitor landing.
 *
 * Each item carries the rendered answer (`a`) and a matching `plain` text
 * version for the FAQPage JSON-LD — keep the two in sync when editing.
 */
export const AI_SEARCH_FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is the AI Search Monitor?",
    a: (
      <p>
        AI Search Monitor is a tool by Agent-led Growth (agentled.co) that tracks
        whether AI assistants mention and recommend you when people ask questions
        in your category. It runs real prompts against ChatGPT every day, checks
        each answer for mentions of your brand and citations of your
        domain, and turns that into a visibility score you can watch over time.
      </p>
    ),
    plain:
      "AI Search Monitor is a tool by Agent-led Growth (agentled.co) that tracks whether AI assistants mention and recommend you when people ask questions in your category. It runs real prompts against ChatGPT every day, checks each answer for mentions of your brand and citations of your domain, and turns that into a visibility score you can watch over time.",
  },
  {
    q: "What can the AI Search Monitor track?",
    a: (
      <p>
        Anything with a website or a domain. Websites, apps, SaaS products,
        ecommerce stores, brands, services, local businesses, agencies, creators
        and personal brands, newsletters, open source projects and GitHub
        repositories. If an AI assistant could plausibly name it in an answer, AI
        Search Monitor can track it. All you supply is a domain.
      </p>
    ),
    plain:
      "Anything with a website or a domain. Websites, apps, SaaS products, ecommerce stores, brands, services, local businesses, agencies, creators and personal brands, newsletters, open source projects and GitHub repositories. If an AI assistant could plausibly name it in an answer, AI Search Monitor can track it. All you supply is a domain.",
  },
  {
    q: "How do you measure my brand's visibility in AI answers?",
    a: (
      <p>
        AI Search Monitor reads your site to work out what you do, who you serve
        and who you compete with, then generates the prompts real buyers type into
        AI assistants. It runs those prompts daily and scores each answer on
        whether your brand is named, whether your domain is cited, where you sit
        among the options, and which competitors appear beside you. Your score is
        the share of monitored answers where you appear.
      </p>
    ),
    plain:
      "AI Search Monitor reads your site to work out what you do, who you serve and who you compete with, then generates the prompts real buyers type into AI assistants. It runs those prompts daily and scores each answer on whether your brand is named, whether your domain is cited, where you sit among the options, and which competitors appear beside you. Your score is the share of monitored answers where you appear.",
  },
  {
    q: "Which AI assistants and LLMs do you monitor?",
    a: (
      <p>
        ChatGPT today, with more models coming soon. You can view your score
        per assistant or averaged across them. Visibility is rarely identical
        across models, and the gap between them is usually the most useful thing
        on the dashboard.
      </p>
    ),
    plain:
      "ChatGPT today, with more models coming soon. You can view your score per assistant or averaged across them. Visibility is rarely identical across models, and the gap between them is usually the most useful thing on the dashboard.",
  },
  {
    q: "How often is my visibility refreshed?",
    a: (
      <p>
        Daily. Every prompt is re-run against every assistant you monitor once a
        day, and each run is added to your history rather than replacing the last
        one. AI answers are volatile, so one check tells you almost nothing. Daily
        sampling is what turns noise into a trend.
      </p>
    ),
    plain:
      "Daily. Every prompt is re-run against every assistant you monitor once a day, and each run is added to your history rather than replacing the last one. AI answers are volatile, so one check tells you almost nothing. Daily sampling is what turns noise into a trend.",
  },
  {
    q: "How is this different from traditional SEO tools?",
    a: (
      <p>
        SEO tools measure ranked links against keywords, using a public index that
        anyone can query. AI Search Monitor measures whether you get named inside a
        generated answer, where there is no ranking and no index. You track prompts
        instead of keywords, mentions and citations instead of positions, and a
        competitor set the assistant chooses rather than one you picked. You still
        want your SEO tool. This covers the surface it cannot see.
      </p>
    ),
    plain:
      "SEO tools measure ranked links against keywords, using a public index that anyone can query. AI Search Monitor measures whether you get named inside a generated answer, where there is no ranking and no index. You track prompts instead of keywords, mentions and citations instead of positions, and a competitor set the assistant chooses rather than one you picked. You still want your SEO tool. This covers the surface it cannot see.",
  },
  {
    q: "Is the AI Search Monitor free?",
    a: (
      <p>
        Yes, there is a free scan and no credit card is needed. Enter your domain,
        watch the live scan work out your category and competitors, pick up to
        three topics, and enter your email to open your dashboard. The free tier
        keeps those topics refreshed daily. Paid tiers add more prompts and deeper
        competitor tracking.
      </p>
    ),
    plain:
      "Yes, there is a free scan and no credit card is needed. Enter your domain, watch the live scan work out your category and competitors, pick up to three topics, and enter your email to open your dashboard. The free tier keeps those topics refreshed daily. Paid tiers add more prompts and deeper competitor tracking.",
  },
  {
    q: "Why is my brand not showing up in ChatGPT answers?",
    a: (
      <p>
        Usually one of four reasons. Your site does not say plainly what you do and
        who it is for. You have no third party coverage, and assistants lean on
        reviews, comparisons and directories more than on your own marketing. Your
        category wording does not match how buyers phrase prompts. Or you are too
        new for the sources to have caught up. AI Search Monitor shows which
        competitors get named in your place and which sources get cited instead of
        yours.
      </p>
    ),
    plain:
      "Usually one of four reasons. Your site does not say plainly what you do and who it is for. You have no third party coverage, and assistants lean on reviews, comparisons and directories more than on your own marketing. Your category wording does not match how buyers phrase prompts. Or you are too new for the sources to have caught up. AI Search Monitor shows which competitors get named in your place and which sources get cited instead of yours.",
  },
  {
    q: "Is this GEO, AEO or LLMO? Are they the same thing?",
    a: (
      <p>
        Broadly yes. Generative Engine Optimization, Answer Engine Optimization and
        Large Language Model Optimization are competing labels for the same goal:
        getting recommended inside AI generated answers rather than ranked in a list
        of links. Agent-led Growth treats this as one layer of a wider shift, where
        agents become the audience and increasingly the buyer. AI Search Monitor is
        the measurement layer for it, whichever acronym wins.
      </p>
    ),
    plain:
      "Broadly yes. Generative Engine Optimization, Answer Engine Optimization and Large Language Model Optimization are competing labels for the same goal: getting recommended inside AI generated answers rather than ranked in a list of links. Agent-led Growth treats this as one layer of a wider shift, where agents become the audience and increasingly the buyer. AI Search Monitor is the measurement layer for it, whichever acronym wins.",
  },
  {
    q: "Which prompts do you track, and can I change them?",
    a: (
      <p>
        AI Search Monitor suggests prompts from your site, your category and your
        competitors, then hands them to you. Every prompt is fully editable. Add
        the ones your buyers actually ask, rewrite the ones that missed, remove
        anything irrelevant. The best prompts are usually the ones you hear on sales
        calls, so the list is meant to be edited rather than accepted.
      </p>
    ),
    plain:
      "AI Search Monitor suggests prompts from your site, your category and your competitors, then hands them to you. Every prompt is fully editable. Add the ones your buyers actually ask, rewrite the ones that missed, remove anything irrelevant. The best prompts are usually the ones you hear on sales calls, so the list is meant to be edited rather than accepted.",
  },
  {
    q: "What is a prompt?",
    a: (
      <p>
        A prompt is one question we send to an AI model to check how your brand
        shows up in its answer. In practice, one prompt is one AI answer
        monitored on one model: a single question, run on ChatGPT, produces one
        answer and counts as one prompt. Each plan includes a set number of
        prompts, 9 on Free and Starter, 50 on Pro and 150 on Business.
      </p>
    ),
    plain:
      "A prompt is one question we send to an AI model to check how your brand shows up in its answer. In practice, one prompt is one AI answer monitored on one model: a single question, run on ChatGPT, produces one answer and counts as one prompt. Each plan includes a set number of prompts, 9 on Free and Starter, 50 on Pro and 150 on Business.",
  },
  {
    q: "What is the difference between prompts and models?",
    a: (
      <p>
        A prompt is the question being monitored; a model is the AI system that
        answers it, such as ChatGPT. Today every prompt runs on ChatGPT, with
        more models coming soon. Once a question can run on more than one model,
        each model counts as its own prompt, because each produces a separate
        answer, so the same question on two models is two prompts. A 50-prompt
        plan could then cover, say, 25 questions across two models.
      </p>
    ),
    plain:
      "A prompt is the question being monitored; a model is the AI system that answers it, such as ChatGPT. Today every prompt runs on ChatGPT, with more models coming soon. Once a question can run on more than one model, each model counts as its own prompt, because each produces a separate answer, so the same question on two models is two prompts. A 50-prompt plan could then cover, say, 25 questions across two models.",
  },
  {
    q: "What is a brand?",
    a: (
      <p>
        A brand is the website or URL you want to monitor, such as agentled.co.
        Each account has its own private workspace for a brand, with its own
        prompts, results and history, so two people can monitor the same domain
        independently. Starter and Pro include one brand; Business includes up to
        three.
      </p>
    ),
    plain:
      "A brand is the website or URL you want to monitor, such as agentled.co. Each account has its own private workspace for a brand, with its own prompts, results and history, so two people can monitor the same domain independently. Starter and Pro include one brand; Business includes up to three.",
  },
  {
    q: "How do I pay?",
    a: (
      <p>
        Payments are billed securely through Stripe. Depending on your country,
        Stripe supports a range of payment methods, and you will see the options
        available to you at checkout.
      </p>
    ),
    plain:
      "Payments are billed securely through Stripe. Depending on your country, Stripe supports a range of payment methods, and you will see the options available to you at checkout.",
  },
];
