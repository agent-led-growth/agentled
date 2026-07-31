-- Subscribers for the Agent-led Growth list.

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- Lowercased email, used for the uniqueness constraint so Foo@x.com and
  -- foo@x.com cannot both subscribe.
  email_normalized text not null generated always as (lower(trim(email))) stored,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'unsubscribed')),
  -- Opaque token for the confirm / unsubscribe links.
  token uuid not null default gen_random_uuid(),
  source text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create unique index if not exists subscribers_email_normalized_key
  on public.subscribers (email_normalized);

create index if not exists subscribers_token_idx on public.subscribers (token);

-- RLS on with no policies: the anon and authenticated roles get no access at
-- all. Every write goes through the service-role client in the API route, which
-- bypasses RLS. This keeps the subscriber list unreadable from the browser.
alter table public.subscribers enable row level security;
