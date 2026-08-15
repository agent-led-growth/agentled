"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { OtpForm } from "@/components/auth/otp-form";
import type { Dictionary, Locale } from "@/lib/i18n";
import { PATHS } from "@/lib/metadata";
import { PLAN_FEATURES, type Plan } from "@/lib/plan";
import { FEATURED_PLAN, isPaidPlan, PRICING_PLANS, priceFor, type Interval } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/client";

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
 * Paid CTAs open a Stripe Checkout Session (Epic 6). A signed-in visitor goes
 * straight to checkout; a signed-out one signs in first (email-OTP modal), then
 * resumes the same checkout — the plan/interval they clicked is preserved. The
 * free CTA keeps starting the free-scan flow.
 */
export function PricingCards({ copy, locale }: { copy: PricingCopy; locale: Locale }) {
  const [interval, setInterval] = useState<Interval>("monthly");
  const startHref = PATHS.aiSearch[locale];

  // Signed-in state + the user's current paid plan, resolved client-side so
  // /pricing stays statically prerenderable. Anonymous visitors resolve to
  // signed-out + "free", so nothing is marked and paid CTAs open the sign-in modal.
  const [signedIn, setSignedIn] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        if (!data.session) {
          setSignedIn(false);
          return;
        }
        setSignedIn(true);
        return fetch("/api/ai-search/plan")
          .then((r) => r.json())
          .then((d: { plan?: string }) => {
            if (active) setCurrentPlan(d.plan ?? "free");
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Checkout state: which plan's button is busy, a pending {plan,interval} awaiting
  // sign-in (drives the sign-in modal), whether to show the "already subscribed"
  // manage modal, and the last error to surface.
  const [busy, setBusy] = useState<Plan | null>(null);
  const [pending, setPending] = useState<{ plan: Plan; interval: Interval } | null>(null);
  const [manage, setManage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function goCheckout(plan: Plan, chosen: Interval) {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: chosen }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        manage?: boolean;
        error?: string;
      };
      // Already subscribed → explain and offer the portal, don't start a checkout.
      if (res.ok && data.manage) {
        setBusy(null);
        setManage(true);
        return;
      }
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error ?? copy.checkout.error);
    } catch {
      setError(copy.checkout.error);
    }
    setBusy(null);
  }

  function onPaidCta(plan: Plan) {
    if (signedIn) {
      void goCheckout(plan, interval);
    } else {
      setError(null);
      setPending({ plan, interval });
    }
  }

  return (
    <div className="flex flex-col gap-[32px] md:gap-[44px]">
      <BillingToggle copy={copy} interval={interval} onChange={setInterval} />

      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4">
        {PRICING_PLANS.map((plan) => {
          const price = priceFor(plan, interval);
          const featured = plan === FEATURED_PLAN;
          // Only a paid current plan is marked — free is the default, and
          // logged-out users resolve to "free", so they see nothing different.
          const isCurrent = currentPlan !== "free" && currentPlan === plan;
          const highlight = featured || isCurrent;
          const p = copy.plans[plan];
          return (
            <div
              key={plan}
              className={`flex flex-col gap-[20px] border p-[24px] ${
                highlight
                  ? "border-[var(--accent)] bg-[var(--field-bg)]"
                  : "border-[var(--border-hairline)] bg-[var(--surface)]"
              }`}
            >
              <div className="flex items-center justify-between gap-[8px]">
                <h3 className="text-[19px] font-semibold text-[var(--text-primary)]">
                  {p.name}
                </h3>
                {isCurrent ? (
                  <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--accent)] uppercase">
                    {copy.currentPlan}
                  </span>
                ) : featured ? (
                  <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--accent)] uppercase">
                    {copy.featured}
                  </span>
                ) : null}
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

              {isCurrent ? (
                <span
                  aria-current="true"
                  className="block w-full border border-[var(--accent)] px-[16px] py-[11px] text-center text-[14px] font-medium text-[var(--accent)]"
                >
                  {copy.currentPlan}
                </span>
              ) : isPaidPlan(plan) ? (
                <button
                  type="button"
                  onClick={() => onPaidCta(plan)}
                  disabled={busy !== null}
                  className={`block w-full border px-[16px] py-[11px] text-center text-[14px] font-medium transition-colors disabled:opacity-70 ${
                    featured
                      ? "border-transparent bg-[var(--btn-bg)] text-[var(--btn-fg)] hover:opacity-90"
                      : "border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--text-faint)]"
                  }`}
                >
                  {busy === plan ? "…" : p.cta}
                </button>
              ) : (
                <Link
                  href={startHref}
                  className="block w-full border border-[var(--border-hairline)] px-[16px] py-[11px] text-center text-[14px] font-medium text-[var(--text-primary)] no-underline transition-colors hover:border-[var(--text-faint)]"
                >
                  {p.cta}
                </Link>
              )}

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

      {error && !pending ? (
        <p role="alert" className="text-center font-mono text-[12px] text-[#e0603f]">
          {error}
        </p>
      ) : null}

      {pending ? (
        <SignInModal
          copy={copy}
          onClose={() => setPending(null)}
          onSignedIn={() => {
            const resume = pending;
            setPending(null);
            setSignedIn(true);
            void goCheckout(resume.plan, resume.interval);
          }}
        />
      ) : null}

      {manage ? <ManagePlanModal copy={copy} onClose={() => setManage(false)} /> : null}
    </div>
  );
}

/**
 * Shown when a visitor who already has a live subscription clicks a plan CTA. We
 * don't start a second checkout (that would double-bill); instead we explain and
 * hand them to the Stripe Customer Portal, where plan switches, card updates and
 * cancellation live.
 */
function ManagePlanModal({ copy, onClose }: { copy: PricingCopy; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function goPortal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error ?? copy.checkout.error);
    } catch {
      setError(copy.checkout.error);
    }
    setBusy(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.checkout.manageTitle}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-[20px]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[520px] border border-[var(--border-hairline)] bg-[var(--surface)] p-[28px] md:p-[36px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.checkout.close}
          className="absolute top-[14px] right-[16px] text-[20px] leading-none text-[var(--text-faint)] transition-colors hover:text-[var(--text-primary)]"
        >
          ×
        </button>
        <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
          {copy.checkout.manageTitle}
        </h2>
        <p className="mt-[10px] mb-[22px] text-[15px] leading-[1.5] text-[var(--text-muted)]">
          {copy.checkout.manageSub}
        </p>
        <button
          type="button"
          onClick={goPortal}
          disabled={busy}
          className="w-full border border-transparent bg-[var(--btn-bg)] px-[16px] py-[11px] text-center text-[14px] font-medium text-[var(--btn-fg)] transition-opacity hover:opacity-90 disabled:opacity-70"
        >
          {busy ? "…" : copy.checkout.manageCta}
        </button>
        {error ? (
          <p role="alert" className="mt-[12px] font-mono text-[12px] text-[#e0603f]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Sign-in-first checkout gate: a signed-out visitor who picks a paid plan signs in
 * here (email-OTP), then `onSignedIn` resumes the Stripe checkout they started.
 * Reuses the shared OtpForm; no brand is created (this is a pure sign-in).
 */
function SignInModal({
  copy,
  onClose,
  onSignedIn,
}: {
  copy: PricingCopy;
  onClose: () => void;
  onSignedIn: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.checkout.signInTitle}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-[20px]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[520px] border border-[var(--border-hairline)] bg-[var(--surface)] p-[28px] md:p-[36px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.checkout.close}
          className="absolute top-[14px] right-[16px] text-[20px] leading-none text-[var(--text-faint)] transition-colors hover:text-[var(--text-primary)]"
        >
          ×
        </button>
        <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
          {copy.checkout.signInTitle}
        </h2>
        <p className="mt-[10px] mb-[22px] text-[15px] leading-[1.5] text-[var(--text-muted)]">
          {copy.checkout.signInSub}
        </p>
        <OtpForm source="pricing" submitLabel="Send code" onSuccess={onSignedIn} />
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
