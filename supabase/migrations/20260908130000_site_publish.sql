-- Phase 5 (SEO): the freshness loop's database half. See
-- docs/superpowers/specs/2026-09-08-seo-design.md section 6.
--
-- The public site is prerendered at build time, so a content change is not
-- live until Cloudflare rebuilds. This migration gives the admin a single
-- fact to act on — "content changed after the last dispatch" — by
--   1. maintaining updated_at on weddings and site_settings (PS-047, pulled
--      forward from Phase 7: the columns existed but nothing ever set them,
--      so they always equalled created_at; the admin's per-wedding "Live /
--      Publishing…" cue compares weddings.updated_at against the live
--      build's timestamp, which only works once the column is true);
--   2. a site_publish singleton row that records when public content last
--      changed and when/how the request-rebuild Edge Function last fired;
--   3. one trigger function, attached to every public-content table, that
--      stamps content_changed_at only when a change is publicly visible.

-- 1. updated_at maintenance (PS-047). moddatetime ships with Supabase
--    (hosted and local); it sets NEW.<column> = now() on every update.
create extension if not exists moddatetime with schema extensions;

create trigger weddings_set_updated_at
  before update on public.weddings
  for each row execute function extensions.moddatetime(updated_at);

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function extensions.moddatetime(updated_at);

-- 2. site_publish: one row by construction, same shape as site_settings.
create table public.site_publish (
  id                   int primary key check (id = 1),
  content_changed_at   timestamptz,
  last_dispatch_at     timestamptz,
  last_dispatch_status text,
  dispatch_count       int not null default 0,
  followup_sent        boolean not null default false,
  updated_at           timestamptz not null default now()
);

-- Seed with content_changed_at = now(): everything that exists at migration
-- time is "waiting" until the first dispatch, which is the truthful state
-- for a freshly migrated project.
insert into public.site_publish (id, content_changed_at) values (1, now());

create trigger site_publish_set_updated_at
  before update on public.site_publish
  for each row execute function extensions.moddatetime(updated_at);

comment on table public.site_publish is
  'Singleton (id = 1) driving the admin''s rebuild loop. content_changed_at is
   written by the mark_site_content_changed() trigger below whenever a
   publicly visible row changes; last_dispatch_at, last_dispatch_status,
   dispatch_count and followup_sent are written only by the request-rebuild
   Edge Function, which holds the service-role key. Browsers read it
   (admins, via site_publish_admin_read) and never write it: anon and
   authenticated hold no insert/update/delete grant, so a session PATCH
   fails with 42501 rather than becoming a silent no-op.';

-- Tables created by migrations are owned by postgres and pick up no
-- default privileges (see 20260730204126_row_level_security.sql), so grant
-- explicitly — but narrowly this time. select for every role so RLS can
-- decide who reads; writes for service_role only. The revoke is redundant
-- with never granting, and stays as the reviewer-visible statement of
-- intent, exactly as 20260907120000_profiles_write_lockdown.sql does.
grant select on public.site_publish to anon, authenticated, service_role;
grant insert, update, delete on public.site_publish to service_role;
revoke insert, update, delete on public.site_publish from anon, authenticated;

alter table public.site_publish enable row level security;

create policy site_publish_admin_read on public.site_publish
  for select using (public.is_admin());
-- Deliberately no insert/update/delete policies.

-- 3. The content-changed trigger.
--
-- One function for all ten tables, branching on TG_TABLE_NAME and TG_OP,
-- rather than three WHEN-clause triggers per table (a WHEN clause cannot
-- name NEW on DELETE or OLD on INSERT, so per-event triggers would be the
-- alternative — 20 trigger definitions instead of 10, with the rule spread
-- across them). The rule, in one place:
--   * tables with a status column (weddings, gallery_photos, films,
--     testimonials, collections): fire when the row is or was published —
--     NEW.status = 'published' on insert/update, OLD.status = 'published'
--     on update/delete. A draft being edited, created or deleted is not
--     visible to the public site, so it must not trigger a build; a draft
--     becoming published, or a published row becoming draft, is.
--   * child tables without a status (wedding_photos, collection_items):
--     fire when the parent wedding/collection is published, looked up by
--     COALESCE(NEW.parent_id, OLD.parent_id). When the parent is deleted
--     and cascades to its children, the lookup finds nothing and the
--     parent's own trigger has already stamped the change.
--   * everything else (site_settings, gallery_categories, booking_services):
--     every change is public; always fire.
--
-- security definer + owned by postgres so the update on site_publish
-- succeeds no matter which role's statement fired the trigger (anon and
-- authenticated cannot write site_publish themselves). AFTER ROW so a
-- statement that fails its own constraints never stamps anything. Not
-- callable directly: execute is revoked from public/anon/authenticated,
-- and Postgres does not check execute privilege when firing a trigger.
create or replace function public.mark_site_content_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_status text;
  v_old_status text;
  v_visible    boolean;
begin
  if tg_table_name in ('weddings', 'gallery_photos', 'films', 'testimonials', 'collections') then
    if tg_op in ('INSERT', 'UPDATE') then v_new_status := new.status; end if;
    if tg_op in ('UPDATE', 'DELETE') then v_old_status := old.status; end if;
    v_visible := v_new_status = 'published' or v_old_status = 'published';
  elsif tg_table_name = 'wedding_photos' then
    select w.status = 'published' into v_visible
      from public.weddings w
     where w.id = coalesce(
       case when tg_op <> 'DELETE' then new.wedding_id end,
       case when tg_op <> 'INSERT' then old.wedding_id end);
  elsif tg_table_name = 'collection_items' then
    select c.status = 'published' into v_visible
      from public.collections c
     where c.id = coalesce(
       case when tg_op <> 'DELETE' then new.collection_id end,
       case when tg_op <> 'INSERT' then old.collection_id end);
  else
    v_visible := true;
  end if;

  if coalesce(v_visible, false) then
    update public.site_publish set content_changed_at = now() where id = 1;
  end if;
  return null;
end;
$$;

revoke execute on function public.mark_site_content_changed() from public, anon, authenticated;

create trigger weddings_content_changed
  after insert or update or delete on public.weddings
  for each row execute function public.mark_site_content_changed();

create trigger wedding_photos_content_changed
  after insert or update or delete on public.wedding_photos
  for each row execute function public.mark_site_content_changed();

create trigger gallery_photos_content_changed
  after insert or update or delete on public.gallery_photos
  for each row execute function public.mark_site_content_changed();

create trigger films_content_changed
  after insert or update or delete on public.films
  for each row execute function public.mark_site_content_changed();

create trigger testimonials_content_changed
  after insert or update or delete on public.testimonials
  for each row execute function public.mark_site_content_changed();

create trigger collections_content_changed
  after insert or update or delete on public.collections
  for each row execute function public.mark_site_content_changed();

create trigger collection_items_content_changed
  after insert or update or delete on public.collection_items
  for each row execute function public.mark_site_content_changed();

create trigger site_settings_content_changed
  after insert or update or delete on public.site_settings
  for each row execute function public.mark_site_content_changed();

create trigger gallery_categories_content_changed
  after insert or update or delete on public.gallery_categories
  for each row execute function public.mark_site_content_changed();

create trigger booking_services_content_changed
  after insert or update or delete on public.booking_services
  for each row execute function public.mark_site_content_changed();
