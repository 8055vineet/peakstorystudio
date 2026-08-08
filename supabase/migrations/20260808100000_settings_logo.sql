-- Phase 3h: an admin-uploadable studio logo (circular navbar badge). One
-- nullable media reference on the settings row; existing policies cover it.
alter table public.site_settings
  add column logo_media_id uuid references public.media(id);
