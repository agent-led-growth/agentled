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

Each company's square **icon mark** (not its wordmark), as PNGs in
`public/logos`, listed in `src/components/hero/brands.ts`.

Source resolution is capped by what each company publishes: Microsoft and
Siemens ship 128px icons; Gartner, HP and CrewAI only publish 32px favicons.
Those three are therefore slightly soft on 2× displays — replace them if better
assets turn up (Brandfetch has them, but blocks automated fetches).

The tiles are **light in both themes**, departing from 4A's transparent tiles.
Real marks carry their own colours and baked-in backgrounds (Gartner white,
Siemens teal), so a uniform light tile is the only way all five read, and it
follows the rule the design already applies to the CTA chip.

Worth a second look before launch: "Read by people at" alongside corporate
logos can imply endorsement by those companies.

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
