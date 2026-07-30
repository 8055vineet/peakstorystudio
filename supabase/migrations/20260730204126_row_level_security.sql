-- Phase 1b: RLS. See spec section 5.3.
-- The anon key is public by design; these policies are what make that safe.

-- security definer so the policies below can read profiles without
-- recursing through profiles' own RLS.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Tables created by migrations are owned by role "postgres". Only objects
-- owned by supabase_admin (auth.*, storage.*) pick up default privileges for
-- anon/authenticated/service_role; these do not. Without an explicit GRANT,
-- Postgres denies access before RLS is ever evaluated ("permission denied for
-- table ..."), no matter what the policies below say. Grant broadly here —
-- exactly the pattern Supabase itself uses for storage.objects — and let RLS
-- be the actual security boundary.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on
  public.media,
  public.weddings,
  public.wedding_photos,
  public.gallery_photos,
  public.films,
  public.testimonials,
  public.profiles,
  public.inquiries
to anon, authenticated, service_role;

alter table public.media           enable row level security;
alter table public.weddings        enable row level security;
alter table public.wedding_photos  enable row level security;
alter table public.gallery_photos  enable row level security;
alter table public.films           enable row level security;
alter table public.testimonials    enable row level security;
alter table public.profiles        enable row level security;
alter table public.inquiries       enable row level security;

-- Published content is world-readable.
create policy media_read_all on public.media
  for select using (true);

create policy weddings_read_published on public.weddings
  for select using (status = 'published');

create policy gallery_read_published on public.gallery_photos
  for select using (status = 'published');

create policy films_read_published on public.films
  for select using (status = 'published');

create policy testimonials_read_published on public.testimonials
  for select using (status = 'published');

create policy wedding_photos_read_published on public.wedding_photos
  for select using (
    exists (
      select 1 from public.weddings w
      where w.id = wedding_photos.wedding_id and w.status = 'published'
    )
  );

-- Admin gets full control of content.
create policy media_admin_all on public.media
  for all using (public.is_admin()) with check (public.is_admin());

create policy weddings_admin_all on public.weddings
  for all using (public.is_admin()) with check (public.is_admin());

create policy wedding_photos_admin_all on public.wedding_photos
  for all using (public.is_admin()) with check (public.is_admin());

create policy gallery_admin_all on public.gallery_photos
  for all using (public.is_admin()) with check (public.is_admin());

create policy films_admin_all on public.films
  for all using (public.is_admin()) with check (public.is_admin());

create policy testimonials_admin_all on public.testimonials
  for all using (public.is_admin()) with check (public.is_admin());

-- A user may read their own profile row; only admin may read or write any.
create policy profiles_read_own on public.profiles
  for select using (user_id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- inquiries: anon gets nothing at all. No select, no insert.
-- Phase 2's Edge Function writes with the service-role key, which bypasses RLS.
create policy inquiries_admin_read on public.inquiries
  for select using (public.is_admin());

create policy inquiries_admin_update on public.inquiries
  for update using (public.is_admin()) with check (public.is_admin());
