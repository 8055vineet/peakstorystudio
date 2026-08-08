-- Phase 3i: admin-controlled surface warmth for the public site.
-- One scalar in [0, 1]; the app interpolates the cream surface ramp from it
-- (src/data/surfaceTint.js) and applies the result as --offwhite-* CSS
-- variables. 0.5 reproduces today's palette exactly.
alter table public.site_settings
  add column surface_warmth numeric not null default 0.5
  check (surface_warmth >= 0 and surface_warmth <= 1);
