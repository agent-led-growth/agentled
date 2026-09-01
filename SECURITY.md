# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report vulnerabilities privately to **security@agentled.co** (or, if that
bounces, hugo@agentled.co). Include:

- a description of the issue and its impact,
- steps to reproduce (a proof of concept if you have one),
- affected version / commit.

We aim to acknowledge reports within 3 business days and to keep you updated as
we investigate. Please give us a reasonable window to ship a fix before any
public disclosure.

## Scope

This repository is the source for both the hosted service (agentled.co) and
self-hosted deployments. When reporting, note whether the issue affects:

- **the hosted service** — anything reachable at agentled.co, or
- **the code** — a flaw a self-hoster would inherit (auth, RLS policies, the
  internal scan routes, secret handling, etc.).

## For self-hosters

- Every table ships with Row Level Security enabled and explicit policies; do
  not disable RLS.
- The Supabase service-role key and `INTERNAL_SECRET` bypass those protections —
  keep them server-side only, never in client code or a public env var.
- The internal scan routes are locked down when `INTERNAL_SECRET` is unset.
  Only set it if you run the background scan workers, and use a strong random
  value.
