# Agent-led Growth

The Agent-led Growth repository — the [agentled.co](https://agentled.co) site
plus the AI Search monitoring tool: track how a brand shows up in AI-generated
answers (ChatGPT today; Claude, Gemini, Perplexity and others coming soon).

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind v4 · Supabase (Postgres + Auth) ·
deployed to Cloudflare Workers via `@opennextjs/cloudflare`. Package manager is
**pnpm**; requires **Node 22+**.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase + OpenAI (the minimum to boot)
pnpm dev                     # http://localhost:3000
```

First-time database setup: run `supabase/schema.sql` against your Supabase
project (SQL Editor, or `psql <connection-string> -f supabase/schema.sql`) to
create the tables, RLS policies, and functions.

Everything else in `.env.example` (Resend, Stripe, Jina, PostHog) is optional —
the related feature disables itself when its keys are unset. Set `SELF_HOSTED=true`
to run without billing.

## Scripts

| Command          | Does                                         |
| ---------------- | -------------------------------------------- |
| `pnpm dev`       | Next dev server                              |
| `pnpm typecheck` | `tsc --noEmit`                               |
| `pnpm lint`      | ESLint                                       |
| `pnpm preview`   | Build for Workers and run locally in workerd |
| `pnpm run deploy`| Build and deploy to Cloudflare               |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Conventions live in
[AGENTS.md](AGENTS.md).

## License

[Apache-2.0](LICENSE). The name and brand assets are not covered — see
[NOTICE](NOTICE).
