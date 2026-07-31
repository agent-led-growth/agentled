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
  app/                  routes (App Router)
  lib/
    env.ts              validated env access
    supabase/
      client.ts         browser client
      server.ts         server components / actions / route handlers
      admin.ts          service-role client (bypasses RLS — server only)
      proxy.ts          session refresh
    email/resend.ts     Resend client + default sender
  proxy.ts              wires session refresh into every request
```
