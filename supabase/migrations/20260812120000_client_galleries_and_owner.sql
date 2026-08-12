-- Client delivery portal + owner-only team management (see
-- docs/superpowers/specs/2026-08-12-client-portal-and-team-design.md).
--
-- client_galleries is how the studio delivers photographs: each row is a
-- title + description + Google Drive folder link, unlocked by an access
-- code the studio gives the couple. The code IS the credential, so the
-- table is admin-only under RLS — no anon policy exists at all — and the
-- single public read path is the security-definer RPC below, which only
-- ever returns published rows matching the presented code. A couple can
-- never enumerate, or even count, anyone else's deliveries.

create table public.client_galleries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  couple_label text,
  description text,
  drive_url text not null,
  -- Plaintext deliberately: the admin must be able to re-read the code to
  -- tell the couple, and RLS already denies every non-admin read. The help
  -- text in the admin prescribes 8+ random characters, which makes online
  -- guessing through the rate of one RPC call per attempt impractical.
  access_code text not null,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

comment on table public.client_galleries is
  'Per-couple photo-delivery entries (Google Drive links) shown after access-code sign-in.
   Admin-only under RLS; the public reads exclusively through client_galleries_for_code().';

alter table public.client_galleries enable row level security;

-- Same grant-broadly-let-RLS-decide pattern as every other table (see
-- 20260730204126_row_level_security.sql). With no anon-facing policy, anon
-- holds the grant but every direct read or write is refused.
grant select, insert, update, delete on public.client_galleries
  to anon, authenticated, service_role;

create policy client_galleries_admin_all on public.client_galleries
  for all using (public.is_admin()) with check (public.is_admin());

-- The one public read path. SECURITY DEFINER so it can see past RLS; it
-- narrows to published rows matching the code and returns only display
-- fields — never the code column itself, never draft rows, never a count
-- of anything else. Codes under 6 characters return nothing outright so a
-- trivially short guess cannot match even a carelessly chosen code.
create or replace function public.client_galleries_for_code(p_code text)
returns table (id uuid, title text, couple_label text, description text, drive_url text)
language sql
security definer
set search_path = public
stable
as $$
  select g.id, g.title, g.couple_label, g.description, g.drive_url
  from public.client_galleries g
  where length(trim(coalesce(p_code, ''))) >= 6
    and g.status = 'published'
    and upper(g.access_code) = upper(trim(p_code))
  order by g.sort_order asc, g.created_at asc;
$$;

revoke all on function public.client_galleries_for_code(text) from public;
grant execute on function public.client_galleries_for_code(text) to anon, authenticated, service_role;

-- Team management: exactly one account — the owner's — may create or remove
-- admin accounts. The owner is data, not code: scripts/seed-admin.mjs marks
-- the account it seeds, and the manage-team Edge Function is the only thing
-- that reads this flag (RLS still gates content writes on role = 'admin').
alter table public.profiles
  add column is_owner boolean not null default false;

comment on column public.profiles.is_owner is
  'True for exactly one account, the studio owner — the only caller manage-team accepts
   for creating or removing admins. Content permissions come from role, never from this.';
