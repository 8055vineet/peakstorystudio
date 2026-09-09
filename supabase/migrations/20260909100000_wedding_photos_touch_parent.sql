-- Phase 5 follow-up (branch review): adding, reordering, or removing a
-- wedding's album photographs changes its public page — the prerendered
-- ImageGallery lists every photograph — but wedding_photos carries no
-- timestamp of its own, so the sitemap's <lastmod> (weddings.updated_at,
-- maintained by moddatetime since 20260908130000_site_publish.sql) told
-- crawlers the page was unchanged. Any change to a wedding's photographs now
-- touches the parent row; the BEFORE UPDATE moddatetime trigger there sets
-- updated_at = now().

create or replace function public.touch_parent_wedding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent uuid := coalesce(new.wedding_id, old.wedding_id);
begin
  if parent is not null then
    -- A no-op assignment is enough: moddatetime rewrites updated_at on every
    -- UPDATE of the row, whatever the SET list says.
    update public.weddings set id = id where id = parent;
  end if;
  return null;
end;
$$;

revoke execute on function public.touch_parent_wedding() from public, anon, authenticated;

comment on function public.touch_parent_wedding() is
  'AFTER trigger on wedding_photos: bumps the parent wedding''s updated_at (via its moddatetime trigger) so sitemap lastmod and the admin''s live/publishing cue reflect album changes, not only edits to the wedding row itself.';

drop trigger if exists wedding_photos_touch_parent on public.wedding_photos;
create trigger wedding_photos_touch_parent
  after insert or update or delete on public.wedding_photos
  for each row execute function public.touch_parent_wedding();
