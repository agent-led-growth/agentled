"use client";

import Link from "next/link";
import { useState } from "react";

import type { Dictionary, Locale } from "@/lib/i18n";
import { PATHS } from "@/lib/metadata";
import { PLAN_FEATURES, type Plan } from "@/lib/plan";
import { FEATURED_PLAN, PRICING_PLANS, priceFor, type Interval } from "@/lib/pricing";

type PricingCopy = Dictionary["pricing"];

/** The capability lines shown on a plan card, composed from PLAN_FEATURES. */
function featureLines(plan: Plan, f: PricingCopy["features"]): string[] {
  const feat = PLAN_FEATURES[plan];
  const paid = plan !== "free";
  return [
    `${feat.brands} ${feat.brands === 1 ? f.brand : f.brands}`,
    `${feat.prompts} ${f.prompts}`,
    feat.frequency === "daily" ? f.dailyScans : f.oneTimeScan,
    // Weekly report is a paid perk (Starter and up).
    ...(paid ? [f.weeklyReport] : []),
    // Pro/Business are where extra models will land (Phase 2) — copy only.
    plan === "pro" || plan === "business" ? `${f.chatgpt}, ${f.moreModelsSoon}` : f.chatgpt,
  ];
}

/**
 * Plan grid with a Monthly/Yearly toggle. Prices come from `src/lib/pricing.ts`,
 * capabilities from PLAN_FEATURES; all copy is passed in from the locale
 * dictionary so this stays a pure presentation component.
 *
 * TODO(epic-6): paid CTAs currently start the free flow. Once Stripe lands they
 * point at a Checkout Session for the selected plan + interval.
 */
export function PricingCards({ copy, locale }: { copy: PricingCopy; locale: Locale }) {
  const [interval, setInterval] = useState<Interval>("monthly");
  const startHref = PATHS.aiSearch[locale];

  return (
    <div className="flex flex-col gap-[32px] md:gap-[44px]">
      <BillingToggle copy={copy} interval={interval} onChange={setInterval} />

      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4">
        {PRICING_PLANS.map((plan) => {
          const price = priceFor(plan, interval);
          const featured = plan === FEATURED_PLAN;
          const p = copy.plans[plan];
          return (
            <div
              key={plan}
              className={`flex flex-col gap-[20px] border p-[24px] ${
                featured
                  ? "border-[var(--accent)] bg-[var(--field-bg)]"
                  : "border-[var(--border-hairline)] bg-[var(--surface)]"
              }`}
            >
              <div className="flex items-center justify-between gap-[8px]">
                <h3 className="text-[19px] font-semibold text-[var(--text-primary)]">
                  {p.name}
                </h3>
                {featured && (
                  <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--accent)] uppercase">
                    {copy.featured}
                  </span>
                )}
              </div>

              <p className="min-h-[40px] text-[14px] leading-[1.4] text-[var(--text-muted)]">
                {p.tagline}
              </p>

              <div className="flex items-baseline gap-[4px]">
                <span className="text-[32px] font-bold text-[var(--text-primary)]">
                  {price === null ? copy.freePrice : `$${price}`}
                </span>
                {price !== null && (
                  <span className="text-[14px] text-[var(--text-faint)]">
                    {interval === "monthly" ? copy.perMonth : copy.perYear}
                  </span>
                )}
              </div>

              <Link
                href={startHref}
                className={`block w-full border px-[16px] py-[11px] text-center text-[14px] font-medium no-underline transition-colors ${
                  featured
                    ? "border-transparent bg-[var(--btn-bg)] text-[var(--btn-fg)] hover:opacity-90"
                    : "border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--text-faint)]"
                }`}
              >
                {p.cta}
              </Link>

              <ul className="flex list-none flex-col gap-[10px] border-t border-[var(--border-hairline)] pt-[18px]">
                {featureLines(plan, copy.features).map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-[9px] text-[14px] leading-[1.4] text-[var(--text-muted)]"
                  >
                    <span aria-hidden="true" className="mt-[2px] text-[var(--accent)]">
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BillingToggle({
  copy,
  interval,
  onChange,
}: {
  copy: PricingCopy;
  interval: Interval;
  onChange: (i: Interval) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-[14px]">
      <div
        role="tablist"
        aria-label={copy.eyebrow}
        className="inline-flex border border-[var(--border-hairline)]"
      >
        {(["monthly", "yearly"] as const).map((i) => {
          const active = interval === i;
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(i)}
              className={`px-[18px] py-[9px] text-[13px] font-medium transition-colors ${
                active
                  ? "bg-[var(--btn-bg)] text-[var(--btn-fg)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {i === "monthly" ? copy.billing.monthly : copy.billing.yearly}
            </button>
          );
        })}
      </div>
      <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--accent)] uppercase">
        {copy.billing.yearlyNote}
      </span>
    </div>
  );
}
