-- Daily-sweep due-brands query (Epic 4, slice 3). Returns brand rows that are
-- active, have NO in-flight run, and have NO completed run since `stale_before`
-- (i.e. due for a scan), plus the owner's plan so the caller decides "is this a
-- daily plan?" in code (fail-closed via planOf/isDaily), never in SQL.
--
-- Due is anchored on the last COMPLETED run (not brands.last_scan_at), so a
-- best-effort missed last_scan_at stamp can never cause a re-scan.
--
-- Depends on 0005 (brands, brand_users, users), 0012 (scan_runs). Read-only.

begin;

create or replace function public.due_brands_for_scan(stale_before timestamptz)
returns table (brand_id uuid, plan text)
language sql
stable
as $$
  with due as (
    -- One row per brand: prefer the 'owner' member, else any member, so a brand
    -- with only non-owner members is never silently skipped. distinct on requires
    -- brand_id first in the order by.
    select distinct on (b.id)
      b.id as brand_id, u.plan, b.last_scan_at
    from public.brands b
    join public.brand_users bu on bu.brand_id = b.id
    join public.users u on u.id = bu.user_id
    where b.is_active
      and not exists (
        select 1 from public.scan_runs r
        where r.brand_id = b.id and r.status in ('pending', 'running')
      )
      and not exists (
        select 1 from public.scan_runs r
        where r.brand_id = b.id
          and r.status = 'completed'
          and r.completed_at > stale_before
      )
    order by b.id, (bu.role = 'owner') desc
  )
  -- Most overdue first (never-scanned, then oldest last_scan_at) so a per-tick
  -- cap is fair — last_scan_at is only an ordering hint, never the due check.
  select brand_id, plan from due
  order by last_scan_at asc nulls first;
$$;

-- Called only by the service-role scan sweep (never a browser); the anon role
-- must not be able to enumerate brands.
revoke all on function public.due_brands_for_scan(timestamptz) from public;
grant execute on function public.due_brands_for_scan(timestamptz) to service_role;

commit;
