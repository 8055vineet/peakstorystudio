-- Phase 3c: the site's singular, admin-editable content. One row, forever.
-- See docs/superpowers/specs/2026-08-04-admin-cms-settings-design.md §2.

create table public.site_settings (
  id int primary key default 1 check (id = 1),
  quote_text text not null,
  quote_credit text not null,
  brand_story_heading text not null,
  brand_story_p1 text not null,
  brand_story_p2 text not null,
  hero_media_id uuid references public.media(id),
  brand_story_media_id uuid references public.media(id),
  closing_media_id uuid references public.media(id),
  studio_address text not null,
  studio_email text not null,
  studio_phone text not null,
  whatsapp_number text not null default '',
  instagram_url text not null default '',
  youtube_url text not null default '',
  updated_at timestamptz not null default now()
);

-- Same grant-broadly-let-RLS-decide pattern as
-- 20260730204126_row_level_security.sql (see its own comment).
grant select, update on public.site_settings to anon, authenticated, service_role;

alter table public.site_settings enable row level security;

-- The public site reads with the anon key.
create policy site_settings_read_all on public.site_settings
  for select using (true);

-- Only admins write. No insert/delete policies exist at all: the row is
-- created below and check (id = 1) keeps it singular.
create policy site_settings_admin_update on public.site_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- Seed with the studio's real, owner-confirmed content so a from-empty
-- reset reproduces a working site with no extra step. Media ids start null;
-- scripts/load-real-content.mjs points them at the real Home images.
insert into public.site_settings (
  id, quote_text, quote_credit, brand_story_heading, brand_story_p1, brand_story_p2,
  studio_address, studio_email, studio_phone, whatsapp_number
) values (
  1,
  'Every journey builds toward a single, breathless moment. We are here to capture the story when it reaches its absolute peak.',
  'by abhinav',
  'The Brand Story',
  'At Peak Story Studio, we believe that life''s most profound moments are not just lived—they unfold like a masterpiece. Whether it is the quiet, nervous anticipation right before a wedding ceremony or the soaring crescendo of a cinematic short film, every narrative has a summit.',
  'Our passion lies in recognizing that exact heartbeat. We don''t just record events; we wait for the emotion, the light, and the connection to converge at their highest point. By freezing time at the peak of your story, we turn fleeting chapters into timeless memories that you can relive forever.',
  '2/231 Vastu Khand, Gomtinagar, Lucknow, UP',
  'peakstorystudio@gmail.com',
  '+91 8881621021',
  '918881621021'
);
