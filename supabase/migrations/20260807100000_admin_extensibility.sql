-- Phase 3e: admin-extensible content — More pages, gallery categories,
-- booking services. See docs/superpowers/specs/2026-08-07-admin-extensibility-design.md.

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  media_id uuid references public.media(id),
  video_embed_url text,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  -- An item is a photograph, or a video (optionally postered) — never neither.
  check (media_id is not null or video_embed_url is not null)
);

create index collection_items_collection_idx
  on public.collection_items (collection_id, sort_order);

create table public.gallery_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  sort_order int not null default 0
);

create table public.booking_services (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  sort_order int not null default 0
);

-- Same grant-broadly-let-RLS-decide pattern as
-- 20260730204126_row_level_security.sql (see its own comment).
grant select, insert, update, delete on
  public.collections,
  public.collection_items,
  public.gallery_categories,
  public.booking_services
to anon, authenticated, service_role;

alter table public.collections        enable row level security;
alter table public.collection_items   enable row level security;
alter table public.gallery_categories enable row level security;
alter table public.booking_services   enable row level security;

create policy collections_read_published on public.collections
  for select using (status = 'published' or public.is_admin());

create policy collections_admin_all on public.collections
  for all using (public.is_admin()) with check (public.is_admin());

create policy collection_items_read_published on public.collection_items
  for select using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
        and (c.status = 'published' or public.is_admin())
    )
  );

create policy collection_items_admin_all on public.collection_items
  for all using (public.is_admin()) with check (public.is_admin());

-- The public site renders category order and the services list, so both read openly.
create policy gallery_categories_read_all on public.gallery_categories
  for select using (true);

create policy gallery_categories_admin_all on public.gallery_categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy booking_services_read_all on public.booking_services
  for select using (true);

create policy booking_services_admin_all on public.booking_services
  for all using (public.is_admin()) with check (public.is_admin());

-- Rename atomically: the category row and every photo that names it, in one
-- transaction, so a rename can never strand photos on a dead name.
create or replace function public.rename_gallery_category(p_old text, p_new text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'rename_gallery_category: admin only';
  end if;
  update public.gallery_categories set name = p_new where name = p_old;
  if not found then
    raise exception 'rename_gallery_category: no category named "%"', p_old;
  end if;
  update public.gallery_photos set category = p_new where category = p_old;
end;
$$;

revoke execute on function public.rename_gallery_category(text, text) from public, anon;
grant execute on function public.rename_gallery_category(text, text) to authenticated, service_role;

-- Seeds: exactly what is hard-coded today, in today's order.
insert into public.gallery_categories (name, sort_order) values
  ('Pre-Wedding', 0), ('Wedding', 1), ('Engagement', 2), ('Haldi & Mehendi', 3);

insert into public.booking_services (name, sort_order) values
  ('Cinematic Film', 0), ('Fine Art Photography', 1), ('Drone Aerials', 2), ('Pre-Wedding Shoot', 3);
