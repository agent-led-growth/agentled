## What & why

Describe the change and the motivation. Link the issue it addresses
(e.g. `Closes #123`).

## How I verified

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Exercised the affected flow locally (describe how)

## Notes for reviewers

Anything worth calling out — trade-offs, follow-ups, areas you're unsure about.

## Checklist

- [ ] No secrets committed (kept in `.env.local` / `.dev.vars`)
- [ ] New tables have RLS enabled with explicit policies (if applicable)
- [ ] No `src/proxy.ts` / `src/middleware.ts` added
- [ ] Env read through `src/lib/env.ts`, not `process.env` directly
