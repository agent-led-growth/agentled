-- Account API keys for the public API (and, later, the MCP server). A key belongs
-- to a public.users row. The plaintext secret is shown once at creation and never
-- stored — only its SHA-256 hash (`key_hash`, unique, what we look a request up by)
-- and a short display prefix (`key_prefix`, e.g. "agl_live_AbC1…") for the UI.
--
-- RLS is enabled with NO policies, so anon/authenticated clients have no access at
-- all (same pattern as public.subscribers). All access goes through the service-role
-- client in server route handlers, scoped by user_id in code — key material must
-- never be reachable from the browser.

begin;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  label text not null,
  key_hash text not null unique,
  key_prefix text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists api_keys_user_id_idx on public.api_keys (user_id);

alter table public.api_keys enable row level security;

grant all on public.api_keys to service_role;

commit;
