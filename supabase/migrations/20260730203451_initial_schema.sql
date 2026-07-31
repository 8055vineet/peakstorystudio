-- Phase 1b: content schema. See docs/superpowers/specs/2026-07-30-end-to-end-platform-design.md section 5.2.

create table public.media (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  width int,
  height int,
  alt_text text not null default '',
  blurhash text,
  created_at timestamptz not null default now()
);

comment on column public.media.alt_text is
  'Accessibility text. Components previously passed the title as alt; this replaces that.';
comment on column public.media.blurhash is
  'Populated from Phase 3, when uploads exist. Feeds the .img-blur-up CSS in src/index.css.';

create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  couple text not null,
  location text not null,
  event_date date,
  summary text,
  cover_media_id uuid references public.media(id),
  video_url text,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','published')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wedding_photos (
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete restrict,
  sort_order int not null default 0,
  primary key (wedding_id, media_id)
);

create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id),
  title text not null,
  category text not null,
  couple text,
  location text,
  grid_span text,
  status text not null default 'published' check (status in ('draft','published')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.films (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  couple text,
  location text,
  duration_seconds int,
  thumbnail_media_id uuid references public.media(id),
  video_embed_url text not null,
  status text not null default 'published' check (status in ('draft','published')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  quote text not null,
  couple text not null,
  event text,
  status text not null default 'published' check (status in ('draft','published')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('admin','client')),
  display_name text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Admin is an explicit role, never merely an authenticated session. Phase 6 adds client
   sign-in, at which point every couple is authenticated too; policies testing only for
   authentication would hand couples full CRUD over site content.';

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  wedding_date date,
  venue text,
  services text[] not null default '{}',
  message text,
  status text not null default 'new' check (status in ('new','contacted','booked','archived')),
  source text not null default 'website',
  created_at timestamptz not null default now()
);

comment on table public.inquiries is
  'Written only by the Phase 2 Edge Function using the service-role key. Anon gets no access
   at all — see the RLS migration.';

create index weddings_status_sort_idx on public.weddings (status, sort_order);
create index gallery_photos_status_sort_idx on public.gallery_photos (status, sort_order);
create index films_status_sort_idx on public.films (status, sort_order);
create index testimonials_status_sort_idx on public.testimonials (status, sort_order);
create index wedding_photos_wedding_idx on public.wedding_photos (wedding_id, sort_order);
