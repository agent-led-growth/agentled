# Paid Plans — Technical Plan

Status: **plan for review** (nothing built yet beyond `users.plan` + `plan.ts`).
Scope: turn AI Search Monitor into a paid product with free + 3 paid tiers.

> **No Claude yet.** Phase 1 does not add Claude to the DB, the designs, or the
> prompt model. "More models" is copy only. Claude ships whole in Phase 2.

---

## 1. The offer

| Plan | Monthly | Yearly | Brands | Models | Prompts | Frequency | Report |
|---|---:|---:|---:|---|---:|---|---|
| **Free Scan** | $0 | — | 1 | ChatGPT | 9 | One-time | — |
| **Starter** | $19 | $190 | 1 | ChatGPT | 9 | Daily | Weekly |
| **Pro** | $90 | $900 | 1 | ChatGPT, more models coming soon | 50 | Daily | Weekly |
| **Business** | $270 | $2,700 | 3 | ChatGPT, more models coming soon | 150 | Daily | Weekly |

**Who each plan is for:**
- **Free Scan** — anyone curious about their AI visibility
- **Starter** — small businesses, creators, and solo founders
- **Pro** — companies actively working on AI visibility
- **Business** — agencies and teams managing multiple brands

- Yearly = **monthly × 10** (2 months free).
- Paid plans include a **Weekly report**.
- The pricing page lives at **`/ai-search/pricing`** (+ `/es/ai-search/pricing`) — it is the AI Search Monitor's pricing only.
- **Internal rule (never shown as Claude yet):** `1 question × 1 model = 1 prompt`.
  Today every prompt runs on ChatGPT, so Pro = 50 questions on ChatGPT. When more
  models arrive the **limits don't change** — a Pro user still gets 50 prompts/day
  and can distribute them across models (e.g. 25 questions × 2 models).

## 2. Decisions (locked)

- **More models = copy only.** Pro/Business say "more models coming soon." Nothing
  Claude-shaped goes in the DB, prompt UI, or dashboard in Phase 1.
- **Prompt = a question** (Phase 1). Everything runs on ChatGPT. **No per-model
  selector or model column** anywhere yet. The `question + model` concept lands
  whole in Phase 2, and the `1q×1m=1prompt` accounting falls out of it then.
- **Full prompt management** — users add / edit / remove questions with a live
  "X / N used" counter, enforced at the plan limit.
- **Phased rollout** — Phase 1 = pay + limits + daily scans + surface; Phase 2 =
  more models + per-model execution.
- **Downgrade = auto-pause extras, deterministically** — nothing is deleted;
  over-limit items are paused by a fixed rule (**keep oldest active, pause newest**);
  user can re-choose later.
- **Free = one free scan per _account_** (never per URL). That scan creates the
  account's own brand + prompts + history. A different account can scan the same
  URL and get a fully independent result.
- **Stripe is the source of truth**; we mirror subscription state into `users` via
  webhook and never call Stripe on a request.

## 3. Brand identity (already correct — do not regress)

The current schema already models this the way we want, so **no identity migration**:

- `brands` has its own `id`; `brands.domain` is **deliberately NOT unique**
  (`0005` comment: *"one brand per signup, so the same domain can appear on many rows"*).
- Ownership is the `brand_users` membership table; RLS scopes reads via
  `is_brand_member()`. Scans lock and run per `brand_id`, never per URL.

Consequence: two accounts monitoring `agentled.co` are two independent brand
records with independent prompts and history. **Rules to preserve:**
- Never add `UNIQUE(domain)` / `UNIQUE(url)`.
- Always schedule and gate **per brand record**, never per URL.
- Free-scan and plan limits are **per account**, not per URL.

## 4. Plan → capabilities (the gating matrix)

Lives in code (`src/lib/plan.ts` → `PLAN_FEATURES`), keyed by plan string. Fail-closed (unknown value → free).

| Capability | free | starter | pro | business |
|---|---|---|---|---|
| Brands (per account) | 1 | 1 | 1 | 3 |
| Prompts (questions) | 9 | 9 | 50 | 150 |
| Frequency | one-time | daily | daily | daily |
| Models | chatgpt | chatgpt | chatgpt (+ soon) | chatgpt (+ soon) |

"Models" is not enforced in Phase 1 (everything is ChatGPT); it exists so the copy
and Phase-2 gating have a home. Every gate calls a server-side helper (`limits(plan)`,
`brandLimit`, `promptLimit`, `isDaily`). The client's copy of the plan is UI-only.

## 5. Phase 1 — epics (in build order)

> Epics 1–5 are built and tested against **manually-set** `users.plan` values
> (as we set them today). **Stripe is last (Epic 6)** and simply automates flipping
> `users.plan` — so nothing below is blocked on payments being wired up.

### Epic 1 — Plan model & gating (foundation)
- Extend `plan.ts`: `Plan = free | starter | pro | business`; `PLAN_FEATURES`; helpers (`limits`, `brandLimit`, `promptLimit`, `isDaily`).
- Shared server-side enforcement used by every gated route.
- **No new migration here** — `users.plan` already exists; the Stripe mirror columns move to Epic 6, where they're actually needed.

### Epic 2 — Pricing surface & "clear views"
- Public **`/ai-search/pricing`** page: plan cards + monthly/yearly toggle + FAQ (content ready). CTAs point to checkout, wired for real in Epic 6 (placeholder/sign-in until then).
- **Update the `/ai-search` landing FAQ** with the pricing FAQs (what's a prompt,
  prompts vs models, what's a brand, how to pay) — edit
  `src/components/ai-search/faq-content.tsx`, keep each item's `plain` field in sync
  for the FAQPage JSON-LD, and mirror the additions into
  `faq-content.es.tsx` (Spanish). See §8.
- **Dashboard audit (explicit).** The current dashboard **shows Claude** (platform
  cards, "Score by platform", model locks) and generic **"Upgrade" buttons**. Remove
  Claude everywhere (Phase 1 shows only ChatGPT — no second platform, no lock), and
  reframe the "Upgrade" placeholders into real, plan-aware CTAs (or "more models
  coming soon" copy where a model was implied). See §9.
- **Plan/usage views** in-app: current plan, prompts/brands used, cadence + next scan, manage-subscription link (link wired in Epic 6).
- **Upgrade CTAs** throughout (scan cadence, "brand/prompt limit reached") → pricing/checkout.
- Trend/delta charts are prepared here but only populate once run history exists (Epic 4).

### Epic 3 — Prompt management (questions only)
- Prompt **CRUD** (add / edit / remove **questions**) — API + Settings UI (the current
  "Edit your prompts" / "Add prompt" placeholders become real).
- **Usage counter** "X / N used"; enforce the plan's prompt limit on add.
- **No model column, no Claude toggle.** One question = one prompt, runs on ChatGPT.

### Epic 4 — Daily scans ("frequency" + history)

**The scan unit is the per-account brand row** (§3) — its own prompts, its own
isolated results, keyed by `brand_id`, **never a shared domain**. Two accounts on
the same URL are two rows → two independent runs and histories. Reuses the working
one-time pipeline (queue + consumer + runner); Epic 4 adds only the schedule + the
run record.

- **`scan_runs` table** — one immutable row per run: **owner (`user_id`) + `brand_id`**,
  `status`, `trigger`, `model`, counts, timestamps, cost (see §7). Unlocks **real
  trends/deltas** (hidden today — only one run exists).
- **Trends read completed runs only.** A stale-reaped run keeps the partial `scans`
  rows it wrote (under a `failed` run). The trend/metrics aggregation must scope
  `scans` to `run_id IN (completed runs)`, not read by `brand_id` alone, or partial
  failed data pollutes the charts.
- **Append-only, nothing deleted.** `scans` was built append-only ("never updated,
  only inserted") and already carries `prompt_id` + `model`; the one-time flow's
  `deleteBrandScans` overwrite is **removed**. Add `run_id` + `prompt_text` to `scans`.
- **Run state machine**: `pending → running → completed | failed`. Only a
  `completed` run advances the brand's next due time (`completed_at + ~24h`); a
  `failed`/stuck run does not, and is retried on a short backoff.
- **Idempotent enqueue**: a brand row with a `pending`/`running` run is never
  re-enqueued — no two concurrent runs for one row.
- **Daily sweep (paid only).** An **hourly cron** enqueues every **paid + active**
  brand row whose last completed run is older than ~24h and has no in-flight run,
  onto the existing `agentled-scan` queue; the existing consumer **drains them brand
  by brand** until the day's set is done. **Free is never scheduled** — it keeps the
  one-time onboarding scan (itself a `scan_run`, `trigger=onboarding`, so history is
  continuous if they upgrade).
- **`brands`** gains `last_scan_at` and `is_active` (the latter shared with Epic 5,
  for paused rows).
- Cron host: a small dedicated cron worker (like the scan-consumer) — TBD at build.
- **Edited-prompt history (v1 = snapshot + reset-on-edit).** Each result snapshots
  the `prompt_text` it actually ran; editing a prompt stays an in-place `text` update
  (Epic 3); the **trend plots only points whose snapshot matches the prompt's current
  text**, so an edit cleanly starts the line fresh — no versions table, no typo-vs-pivot
  judgement. Old answers are kept for audit, never blended in.

### Epic 5 — Brand limits & downgrade
- Enforce brand cap **per account** at creation (1/1/1/3) with an "upgrade for more brands" CTA.
- **Active/paused** state on brands (and prompts). On downgrade, auto-pause over-limit
  items by a **deterministic rule: keep the oldest active, pause the newest extras**
  (e.g. Business→Pro: keep the oldest brand active, pause the 2 newest; 150→50 prompts:
  keep the oldest 50 active). Nothing deleted; user re-activates within the limit later.
  Paused items don't scan or count.

### Epic 6 — Stripe billing (last; you own product/price setup)
- **Migration**: Stripe mirror columns on `users` — `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `plan_status`, `current_period_end`, `cancel_at_period_end`.
- **Prices**: 3 paid plans × monthly/yearly = **6 price IDs** (free has no price) → an
  env-driven map (`STRIPE_PRICE_<PLAN>_<INTERVAL>`) with a `price_id → {plan, interval}`
  reverse lookup in `src/lib/stripe/prices.ts`. Env-driven so the local $0.10 test
  prices swap for the real live prices with **no code change**.
- **Checkout** route: subscription-mode Checkout Session, `client_reference_id = userId`, reuse/create the Stripe customer.
- **Customer Portal** route: manage / cancel / switch.
- **Webhook** `/api/stripe/webhook`: verify signature; on `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed` → update `users.plan` + mirror columns (map price_id → plan). This **replaces the manual plan-setting** used through Epics 1–5.
- Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (via `wrangler secret put`).

## 6. Daily-scan timing (for review)

No fixed clock time. Per-brand, staggered, completion-anchored — **documented for review**:

- Each paid, active brand has a `next_scan_at`; it becomes due when `next_scan_at <= now`.
- A **cron runs hourly**, selects brands that are **due AND daily AND active AND have no
  `pending`/`running` run**, and enqueues them (capped per tick as a safety valve).
- `next_scan_at` is advanced **only when a run completes** (`completed_at + 24h`), so a
  brand keeps its own daily slot and failures don't skip a day.
- Failed runs retry on a short backoff (e.g. re-due in ~1–2h), bounded by max attempts.
- Fully configurable later (frequency, hour windows, per-plan cadence).

**Cost note:** daily scans multiply OpenAI spend by ~30×/month per brand vs. the
one-time scan — worth a per-plan margin check before launch.

## 7. Data model changes (summary)

- `users`: + Stripe mirror columns (Epic 6).
- **`scan_runs`** (new) — an immutable snapshot per run, so an August-2026 run never
  looks like it used a model added in 2027:
  - **`user_id`** (owner) + `brand_id` (the per-account monitored row), run `status`
    (pending/running/completed/failed), `trigger` (onboarding | scheduled | manual),
  - `model` (text, **always `'chatgpt'` for now** — a recorded value, not Claude schema),
    `prompts_attempted`, `prompts_completed`,
  - `started_at`, `completed_at`, `error`, and usage/cost metadata (tokens, est. cost).
  - `scans` already has `brand_id` + `prompt_id` + `model` and is append-only; Epic 4
    adds **`run_id`** (which run) + **`prompt_text`** (snapshot of the question actually
    run), so editing a prompt never re-labels past results; trends match on `prompt_text`
    (reset-on-edit).
- `brands`: + `last_scan_at`, `is_active` (Epics 4, 5). Due = last completed run
  older than ~24h. **No new uniqueness on domain; `id` stays a random uuid.**
- `prompts`: user-owned **questions** only (no model column in Phase 1). Editing is
  an in-place `text` update; history integrity comes from `scans.prompt_text` above.
- Every new table gets RLS with explicit policies (repo rule), scoped via `is_brand_member`.

## 8. Content deliverables

- **`/ai-search/pricing` page** (+ `/es/ai-search/pricing`) — the AI Search Monitor's
  pricing surface. Prices in `src/lib/pricing.ts`; capabilities from `PLAN_FEATURES`;
  localized copy (plan names, taglines/who-it's-for, feature labels) in the i18n
  dictionaries. Uses "more models coming soon" (no Claude). *(Done — Epic 2.)*
- **`/ai-search` landing FAQ update** — add the pricing FAQs to the existing FAQ
  system for discovery/SEO:
  - `src/components/ai-search/faq-content.tsx` (EN) — new items; each needs its
    `plain` field for the FAQPage JSON-LD kept in sync.
  - `src/components/ai-search/faq-content.es.tsx` (ES) — same items translated
    (site is i18n'd; the two must stay in lockstep).
  - New FAQs: *What's a prompt? · Prompts vs models · What's a brand? · How do I pay?*
    (source copy in the pricing doc; keep "more models coming soon", no Claude).

## 9. UI/UX placeholders to replace (already in the app)

Generic "Upgrade 🔒" placeholders that need real plan info + working CTAs:
- **Scan cadence** row (Settings) — real cadence (Daily for paid) + upgrade CTA for free.
- **Frequency lock** chip (filter bar) — real cadence / upgrade.
- **Model lock** (overview, prompt-detail "Score by platform") — reframe as **"more models
  coming soon"**, not a Claude toggle.
- **"Edit your prompts" / "Add prompt"** (Settings) — real question CRUD + counter.
- **Brand switcher / "+ New"** — per-account brand-limit awareness + upgrade CTA at the cap.
- **Deltas / trend charts** — become real once `scan_runs` history exists (currently "—").

## 10. Suggested build order

`1a` plan model (`plan.ts` + `PLAN_FEATURES`) → `1b` pricing page + landing-FAQ update + dashboard audit (remove Claude, fix upgrade CTAs) + plan/usage views → `1c` question management (CRUD + counter) → `1d` daily scans + run history/state machine → `1e` brand limits + deterministic downgrade → `1f` Stripe (mirror migration + checkout/portal/webhook). Everything through `1e` runs on manually-set plans; `1f` automates it. Ship when 1a–1f cohere.

## 11. Phase 2 (later, out of scope here)

Add real **models** beyond ChatGPT (provider + extraction), the **question + model**
prompt concept and per-model execution, blended/per-model dashboard views, and the
plan-gating that enables extra models for Pro/Business.

## 12. Inputs still needed from you

- **Stripe** (you're handling): the 8 price IDs (4 plans × monthly/yearly),
  `STRIPE_SECRET_KEY`, webhook signing secret. Pass when ready.
- Confirm the **daily-scan timing policy** in §6 (or adjust).
