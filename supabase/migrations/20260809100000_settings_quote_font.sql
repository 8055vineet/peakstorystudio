-- Phase 3j: admin-chosen font for the Home quote (the third public type role
-- after heading and body). Applied on the public site via the --font-quote
-- CSS variable App sets from this row; the `script` Tailwind token reads it.
alter table public.site_settings
  add column quote_font text not null default 'Quicksand';
