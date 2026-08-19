-- Location targeting for AI Search (Epic: geo scope). A brand can be measured
-- worldwide (the default, unchanged) or scoped to a specific country or city, so
-- its visibility numbers reflect the market it actually sells in rather than a
-- globally-averaged blur. The scope steers OpenAI's web_search `user_location`
-- and biases prompt wording; worldwide brands keep today's exact behaviour.
--
-- Depends on 0005 (brands). Column-only add — no RLS change, since the existing
-- is_brand_member policy already covers new columns.
-- Wrapped in a transaction: run the whole file at once; any failure rolls back.

begin;

alter table public.brands
  -- The scope mode. 'worldwide' (default) leaves measurement untouched.
  add column if not exists location_mode text not null default 'worldwide'
    check (location_mode in ('worldwide', 'country', 'city')),
  -- ISO-3166 alpha-2, uppercase. Null when worldwide.
  add column if not exists location_country text,
  -- City display name (GeoNames). Null unless location_mode = 'city'.
  add column if not exists location_city text,
  -- Human display label, e.g. 'Germany' or 'Berlin, Germany'. Null when worldwide.
  add column if not exists location_label text;

commit;
