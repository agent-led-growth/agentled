-- Links an AI Search Monitor user to the site they want monitored, plus the
-- optional description and the topics they selected during onboarding. One row
-- per user for now (the latest); this table will grow as the real tool is built
-- (e.g. generated prompts). Populated by the OTP verify route (ai-search source).
--
-- Onboarding automations are still gated by public.users.welcome_email_sent_at:
-- a user joins only their first automation ever (landing or ai-search), so no
-- separate flag is needed here.

create table if not exists public.ai_search_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  website text not null,
  description text,
  -- Selected onboarding topics; variable length (not capped at 3).
  topics text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- RLS on; writes go through the service-role client in the verify route. No
-- client policy yet — nothing reads this client-side until the real tool exists
-- (same as subscribers). Add a self-read policy then.
alter table public.ai_search_sites enable row level security;

-- "Auto-expose new tables" is off, so grant explicitly (service_role only).
grant all on public.ai_search_sites to service_role;
