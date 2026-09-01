# Open-Source Migration

Working notes for when we open-source agentled. Captured from a review of the
codebase against the "How to Build Open Source for AI Agents" guide. **Nothing
here is done yet** — this is the checklist and context for when we start.

## Goal & scope

- Open-source the **whole repo** (no extraction from a monorepo — the whole app
  ships, which also keeps all context in one place for agents).
- Enable **self-hosting with your own keys**, so users don't need our hosted
  version. Hosted stays the paid offering — the boundary is *operational*
  (running it well = the service), not code-vs-code.
- Licensing draws the line: **open code license + a brand/trademark carve-out**
  (our logos in `public/logos`, the name, and marks are NOT licensed for reuse).

## Migration checklist

Ordered roughly by priority. Blockers must happen before publishing.

### Blockers (secrets & runnability)

- [ ] **Git history scrub.** Verify no secret was ever committed in any past
      commit. Shipping the whole repo means one historical leak is public
      forever. Safest path: publish a fresh repo with squashed/clean history, or
      scrub with `git-filter-repo`. (`.env.local` / `.dev.vars` are already
      gitignored and not tracked — the risk is *history*, not the working tree.)
- [ ] **Complete `.env.example`.** It currently lists ~6 vars; `src/lib/env.ts`
      requires ~10 more (OpenAI, Stripe secret/webhook, `INTERNAL_SECRET`, Jina,
      etc.). For a bring-your-own-keys product, the key list *is* the product —
      it must be complete and accurate. Mark optional services as optional.
- [ ] **Make non-core services optional** in `src/lib/env.ts` so a fresh clone
      runs on a minimal key set (target: Supabase + OpenAI required; PostHog,
      Stripe, Jina optional). Today several are hard-required and block startup.

### Licensing & OSS hygiene

- [ ] **License**: open code license (MIT/Apache) + brand/trademark carve-out for
      `public/logos` and the name/marks.
- [ ] **OSS meta-files**: `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, and
      `.github/` issue + PR templates. (None exist today.)

### Naming & docs

- [ ] **Rename `laurel`** → a descriptive name across code and docs. The scan
      engine (`src/lib/laurel/*`, the two workers, related migrations/routes) uses
      an internal codename that tells a contributor nothing.
- [ ] **README rewrite.** The current "Layout" section is ~half stale: it omits
      the AI Search Monitor product, the scan pipeline, the two Cloudflare
      workers, Stripe billing, and i18n. Also remove "Private / closed source."
- [ ] **Fix dangling doc ref**: migrations `0005`/`0006` cite `laurel-schema.md`,
      which doesn't exist in the repo. Restore or remove the reference.
- [ ] **Reconcile `public/llms.txt`** with reality (it says "Claude & Gemini, in
      development"; the product is ChatGPT-only and shipped).
- [ ] **AGENTS.md**: add product structure (scan pipeline, workers) and a
      "how to test" section. Keep the `CLAUDE.md = @AGENTS.md` single-source
      pattern (one file imported, so the two can't drift).
- [ ] **Positioning call**: does the README lead with "AI Search Monitor" or
      "our whole company site"? This decides what Pattern 2 (docs) puts first.

### Runnability docs

- [ ] Document all external services (Supabase, Cloudflare queues/cron/workerd,
      OpenAI, Jina, Stripe, Resend, PostHog) and which are optional.
- [ ] Document the dual dev path (`next dev` vs `opennextjs-cloudflare build` +
      `wrangler dev`).

### Later (not blockers)

- [ ] **Plan-gating knob/no-op** so self-hosters aren't forced through Stripe.
      Scan cadence is gated on `users.plan`; make it config-driven (e.g. a
      `SELF_HOSTED` flag or configurable interval) so the open version isn't
      crippled by our commercial tiers while keeping one codebase.
- [ ] **Tests + CI.** At minimum, CI running `typecheck` + `lint` (AGENTS.md
      mandates these but nothing enforces them). Ideally scan-pipeline tests so
      external contributors have a way to validate a change — today there are
      none, which breaks the contribution loop for the part we most want help on.
