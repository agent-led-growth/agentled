<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agentled

Website + app for agentled.co. Private repo, closed source.

## Stack

Next.js 16 App Router + TypeScript + Tailwind v4, deployed to **Cloudflare
Workers** via `@opennextjs/cloudflare`. Supabase for Postgres + Auth. Resend
for email. Package manager is **pnpm**.

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
- Secrets never land in the repo. `.env.local` locally,
  `wrangler secret put` in production.
- Before declaring work done: `pnpm typecheck` and `pnpm lint` must pass.
- Theme is `data-theme` on `<html>`, never a class, and the next/font variables
  must stay on `<html>` or `--font-display` resolves to empty at `:root` and the
  whole site silently falls back to the system font.
- `src/components/hero/brands.ts` is generated — never hand-edit SVG paths.
- Design tokens live in `globals.css`. Use the semantic `--text-*`/`--surface`
  vars so components work in both themes instead of duplicating colours.
