# Agentled

Website + app for [agentled.co](https://agentled.co). Private / closed source.

## Stack

| Layer     | Choice                                          |
| --------- | ----------------------------------------------- |
| Framework | Next.js 16 (App Router, TypeScript)             |
| Styling   | Tailwind CSS v4                                 |
| Hosting   | Cloudflare Workers via `@opennextjs/cloudflare` |
| Data/Auth | Supabase (Postgres + Auth, SSR cookies)         |
| Email     | Resend                                          |

## Getting started

Requires **Node 22+** (wrangler will refuse to run on anything older).

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev
```

App runs at http://localhost:3000.

## Scripts

| Command          | Does                                         |
| ---------------- | -------------------------------------------- |
| `pnpm dev`       | Next dev server                              |
| `pnpm build`     | Next production build                        |
| `pnpm typecheck` | `tsc --noEmit`                               |
| `pnpm lint`      | ESLint                                       |
| `pnpm preview`   | Build for Workers and run locally in workerd |
| `pnpm deploy`    | Build and deploy to Cloudflare               |

## Environment

`.env.local` is git-ignored. See `.env.example` for the full list.

Client-visible values must be prefixed `NEXT_PUBLIC_`. Server-only secrets
(`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`) are set in production with:

```bash
pnpm wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## Known constraints

**No `proxy.ts` (formerly `middleware.ts`).** Next 16 renamed Middleware to
Proxy and made it run on the Node runtime, with the `runtime` option explicitly
disallowed. `@opennextjs/cloudflare` hard-fails the build on Node-runtime
middleware. So the usual Supabase "refresh the session in middleware" pattern is
unavailable here.

Consequence for auth, when we add it: the browser client refreshes its own
tokens and writes cookies client-side, and the OAuth/magic-link callback needs a
Route Handler (`src/app/auth/callback/route.ts`) to exchange the code and set
cookies. Server Components can read the session but cannot refresh it. Revisit
if OpenNext adds support.

## Layout

```
src/
  app/
    page.tsx                    landing hero (designs 4A/4B)
    ai-search-monitor/          CTA target — placeholder, not yet designed
    subscribed/                 confirm-link landing page
    api/subscribe/              POST subscribe + GET confirm
  components/
    hero/                       hero composition + canvas wrapper
      brands.ts                 social-proof data (GENERATED — see below)
    theme-script.tsx            pre-paint theme, avoids flash
    theme-toggle.tsx
  lib/
    env.ts                      validated env access
    traces.ts                   canvas animation (framework-free)
    use-theme.ts                theme store
    supabase/{client,server,admin}.ts
    email/resend.ts
supabase/migrations/            SQL, apply via Supabase CLI or dashboard
```

## The landing hero

Built from `design_handoff_landing_hero`. Both approved themes ship, with a
toggle in the top-right; the choice persists in `localStorage` and falls back to
`prefers-color-scheme`.

**Theme is a `data-theme` attribute on `<html>`, not a class.** React owns
`className` there for the next/font variables and would overwrite a class during
hydration. For the same reason the font variables *must* stay on `<html>`:
Tailwind's `@theme` resolves `--font-display` at `:root`, and a `var()` it cannot
resolve there computes to empty, silently falling back to the system font.

**Canvas** (`src/lib/traces.ts`) is a direct port of the prototype's `traces`
mode. It honours `prefers-reduced-motion`, pauses off-screen and on
`document.hidden`, caps the backing buffer at 2× DPR, and always paints one
static frame up front so a background tab never shows an empty canvas. Note it
needs an explicit height — a canvas is a replaced element, so `inset-y-0` will
not stretch it.

### Social-proof logos

`src/components/hero/brands.ts` is **generated** — do not hand-edit path data.
Every mark is monochrome and inherits `currentColor`, so the row follows the
theme (light grey on dark, dark grey on light) on transparent tiles.

Two asset shapes, because not every brand has a vector mark:

- **`logo`** — a 24×24 path. Microsoft is constructed from its published
  four-square proportions; HP and CrewAI come from Simple Icons.
- **`mask`** — a white-on-transparent PNG alpha mask, applied with CSS
  `mask-image` over a `currentColor` background. Gartner and Siemens are
  wordmark brands with no vector symbol, so rather than approximate their
  letterform in another typeface, `scripts/make-masks.js` extracts the real
  glyph from their favicon.

To regenerate a mask:

```bash
node scripts/make-masks.js public/logos/source.png public/logos/out-mask.png
```

It takes the most common colour as the field (not a corner sample — Siemens has
white rounded-corner cutouts that would be mistaken for the background) and
discards ink touching the border, which removes those cutouts while keeping the
letterform.

Worth a second look before launch: "Read by people at" alongside corporate
logos can imply endorsement by those companies.

### Favicon

`src/app/icon.svg` — the lockup's plus mark, picked up automatically by the App
Router. There is deliberately no `favicon.ico`; it would take priority over the
SVG.

## FAQ and footer

`src/components/faq.tsx` — **placeholder copy, pending a rewrite.** Built on
native `<details>`/`<summary>`, so it is keyboard- and screen-reader-accessible
with no JavaScript and works even if hydration never happens.

`src/components/socials.ts` is **generated** — do not hand-edit the paths. X,
YouTube and Substack come from Simple Icons; LinkedIn comes from Font Awesome's
free brand set (Simple Icons dropped it), which is why it carries a different
viewBox.

## Subscribe flow

Double opt-in, owned end to end — no Substack dependency.

1. `POST /api/subscribe` validates, upserts into `public.subscribers`
   (idempotent on a normalised email), and sends a confirmation via Resend.
2. `GET /api/subscribe/confirm?token=…` flips the row to `confirmed` and
   redirects to `/subscribed`.

`subscribers` has RLS enabled with **no policies**, so anon and authenticated
have no access at all; writes go through the service-role client in the route
handler. Apply the migration before going live, and verify `agentled.co` in
Resend or the confirmation email will not send.
