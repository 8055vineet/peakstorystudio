-- Phase 3g: admin-chosen site fonts. Two more columns on the one settings
-- row; the existing read-all / admin-update policies already cover them.
alter table public.site_settings
  add column heading_font text not null default 'Cormorant Garamond',
  add column body_font text not null default 'Plus Jakarta Sans';
