<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agentled

Website + app for agentled.co — the marketing site plus the AI Search
monitoring tool. Open source (Apache-2.0); brand assets are reserved (see NOTICE).

## Stack

Next.js 16 App Router + TypeScript + Tailwind v4, deployed to **Cloudflare
Workers** via `@opennextjs/cloudflare`. Supabase for Postgres + Auth. Resend
for email. Package manager is **pnpm**.

## Structure

- **Marketing site** — `src/app/(en)` and `src/app/(es)` (Spanish under `/es/`).
- **AI Search Monitor** — the scan engine in `src/lib/ai-search/` (data access,
  enrichment, prompt generation, providers), driven through the API routes under
  `src/app/api/ai-search/` and the dashboard in `src/components/ai-search/`.
- **Scan workers** — `workers/*` (a queue consumer and a cron), deployed
  separately; each reads its own `.dev.vars`.
- **Billing** — Stripe under `src/lib/stripe/` and `src/app/api/stripe/`;
  optional (see `SELF_HOSTED`).
- The `src/lib/ai-search/` engine was codenamed "Laurel" in early migration
  comments (`0005`/`0006`) — same thing.

## Testing

`pnpm typecheck` and `pnpm lint` are the gate. There is no automated test suite
yet, so also run the affected flow: `pnpm dev` for most work, or `pnpm preview`
(the Workers/workerd build) for anything runtime-sensitive.

## Rules

- Requires Node 22+ locally (wrangler refuses older).
- Runtime is **workerd**, not Node. Node built-ins only work through
  `nodejs_compat`; prefer Web APIs. Never assume a filesystem.
- **Do not add `src/proxy.ts` / `src/middleware.ts`.** Next 16 forces Proxy onto
  the Node runtime and OpenNext hard-fails the Cloudflare build on it. See
  "Known constraints" in the README before reaching for middleware.
- Read env through `src/lib/env.ts`, never `process.env` directly.
- Pick the right Supabase client: `client.ts` in Client Components,
  `server.ts` in Server Components / Actions / Route Handlers, `admin.ts`
  only in trusted server code (it bypasses RLS).
- Every new table gets Row Level Security enabled with explicit policies.
- Secrets never land in the repo. `.env.local` for `next dev`,
  `.dev.vars` for the local wrangler stack (`opennextjs-cloudflare build` +
  `wrangler dev` — the app plus the `workers/*` consumer/cron; each reads its own
  `.dev.vars`, all git-ignored), and `wrangler secret put` in production.
- Before declaring work done: `pnpm typecheck` and `pnpm lint` must pass.
- Theme is `data-theme` on `<html>`, never a class, and the next/font variables
  must stay on `<html>` or `--font-display` resolves to empty at `:root` and the
  whole site silently falls back to the system font.
- Social-proof logos are real brand marks in `public/logos`, listed in
  `src/components/hero/brands.ts`. Their tiles stay light in both themes.
- Design tokens live in `globals.css`. Use the semantic `--text-*`/`--surface`
  vars so components work in both themes instead of duplicating colours.
