-- Phase 6 flow-review fixes: profiles becomes read-only for every
-- browser-reachable role, and client access codes get a stored-shape
-- guarantee. Two hardening changes, one migration.

-- 1. public.profiles: admins read, nobody browser-reachable writes.
--
-- profiles_admin_all (20260730204126_row_level_security.sql) gave every
-- admin full write access to EVERY profiles row through PostgREST with
-- nothing but their own session. Once 20260812120000 added is_owner, that
-- meant a non-owner admin could
--     PATCH /rest/v1/profiles?user_id=eq.<self>   {"is_owner": true}
-- and pass the owner-only gate in the manage-team Edge Function — or demote
-- the owner's role, or DELETE the owner's row outright. "Only the owner
-- manages the team" was one REST call from false.
--
-- Nothing in the browser writes profiles at all: src/lib/auth.js only ever
-- SELECTs. Every legitimate writer — scripts/seed-admin.mjs,
-- scripts/verify-admin.mjs, and the manage-team Edge Function — holds the
-- service-role key, which bypasses RLS and keeps its grant below. So the
-- table can be made read-only for anon and authenticated without breaking
-- any real code path.
--
-- Two layers, deliberately. The policy swap narrows what RLS lets an admin
-- do here to select. The REVOKE is the grant-level backstop RLS never had
-- on this table: the row_level_security migration grants broadly and lets
-- RLS be "the actual security boundary", which means a future policy
-- mistake — say, a well-meaning `for all` policy for the Team panel —
-- would silently reopen writes. After this it cannot, without a second,
-- explicit GRANT that a reviewer will see.

drop policy profiles_admin_all on public.profiles;

create policy profiles_admin_read on public.profiles
  for select using (public.is_admin());

revoke insert, update, delete on public.profiles from anon, authenticated;

comment on table public.profiles is
  'Admin is an explicit role, never merely an authenticated session. Phase 6 adds client
   sign-in, at which point every couple is authenticated too; policies testing only for
   authentication would hand couples full CRUD over site content.
   Read-only for anon and authenticated (no insert/update/delete grant, select-only
   policies): role and is_owner are written only with the service-role key — by
   scripts/seed-admin.mjs and the manage-team Edge Function — never from a browser
   session, or any admin could make themselves the owner.';

-- 2. client_galleries.access_code: what is stored must be what the RPC can
--    match.
--
-- client_galleries_for_code() refuses presented codes shorter than 6
-- characters and compares the TRIMMED input against the stored value
-- as-is. A code saved with a stray leading or trailing space, or under 6
-- characters, could therefore never be entered successfully — the studio
-- would hand a couple a code that silently never works. The RPC's floor is
-- now the column's floor, and stored codes are trimmed by construction.

alter table public.client_galleries
  add constraint client_galleries_access_code_check
  check (access_code = btrim(access_code) and length(access_code) >= 6);
