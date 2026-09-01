# Contributing

Thanks for helping improve Agent-led Growth.

## Setup

Requires **Node 22+** and **pnpm**.

```bash
pnpm install
cp .env.example .env.local   # Supabase + OpenAI at minimum
pnpm dev
```

The app deploys to Cloudflare Workers (runtime is **workerd**, not Node). Use
`pnpm dev` for day-to-day work; use `pnpm preview` to catch workerd-only issues
before they reach production.

## Before opening a PR

Both must pass — they're the merge gate:

```bash
pnpm typecheck
pnpm lint
```

Also exercise the flow you changed locally. Conventions (Supabase clients, RLS,
env access, theming) are in [AGENTS.md](AGENTS.md).

## Reporting

Open a GitHub issue for bugs and feature requests.

By contributing you agree your work is licensed under [Apache-2.0](LICENSE).
Don't add our brand marks or logos to a fork — see [NOTICE](NOTICE).
