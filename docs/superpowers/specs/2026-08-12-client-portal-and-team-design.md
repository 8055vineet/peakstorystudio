# Client Delivery Portal + Team Management (design)

**Branch:** `phase-4/client-portal-and-team` · **Date:** 2026-08-12 · Pre-deploy feature pair,
owner-requested mid-Phase-4.

## What changes, in one paragraph

The public site's client sign-in stops being cosmetic and stops showing the public photo grid.
A couple signs in with an **access code** the studio gives them and sees a quiet **delivery
list — each entry a title, a description, and a button opening their Google Drive folder** —
which is how the studio actually delivers photographs. Entries are **fully admin-managed**
(new Client Galleries tab: add/edit/publish/reorder/delete, each entry carrying its code).
Privacy model per the owner's explicit choice: **a couple sees only entries matching their
code** — never another couple's folders. Separately, the admin gains **owner-only team
management**: exactly one account (the owner's) can create and remove other admin accounts;
admins it creates have full content power but can never manage the team. This absorbs the
useful core of the old Phase-6 client-portal plan in a radically simpler form.

## Part 1 — Client delivery portal

### Data

Migration `20260812120000_client_galleries_and_owner.sql`:

- **`client_galleries`**: `id uuid pk`, `title text not null`, `couple_label text`,
  `description text`, `drive_url text not null`, `access_code text not null`,
  `sort_order int not null default 0`, `status text not null default 'draft'`
  (draft/published check), `created_at`.
- **RLS: admin-only for everything; no anon policy at all.** The public never reads this
  table directly — Drive links to private weddings must not be world-readable.
- **RPC `client_galleries_for_code(p_code text)`** — `security definer`, granted to
  `anon`/`authenticated`: returns `id, title, couple_label, description, drive_url` of
  **published** rows whose `upper(access_code) = upper(trim(p_code))`, ordered by
  `sort_order`; returns nothing for codes shorter than 6 characters. This is the single
  public read path; the code is the credential. Codes are studio-generated (help text
  prescribes 8+ random characters), so online guessing through the RPC is impractical.
- `access_code` stays plaintext in the table **deliberately**: the admin must be able to
  re-read it to tell the couple, and RLS already denies every non-admin read.

### Public site

- **`AuthModal`** — the client tab becomes real: one field (Access code) → new
  `useClientAccess` hook → RPC. Zero rows → "That access code wasn't recognised." Rows →
  `onLoginSuccess({ role: 'client', name, code })` (persisted in the existing
  `peak_story_user` localStorage slot) and the gallery modal opens. The fake studio-login
  tab (name/password theatre since Phase 0) is replaced by a quiet panel linking to the real
  admin app at `/admin.html`.
- **`ClientGalleryModal`** — full rewrite: fetches entries for `user.code` on open (same
  hook), renders the delivery list — title, description, "Open in Google Drive ↗"
  (`target="_blank"`, `rel="noreferrer"`). Distinct loading / error-with-retry / empty
  ("Your galleries are being prepared.") states. The photo grid, fake favourites, and fake
  ZIP download are deleted. `photos` prop gone.
- Layering rule kept: components → `src/hooks/useClientAccess.js` →
  `src/lib/queries/clientGalleries.js` → supabase client.

### Admin

New **Client Galleries** tab, built on the existing resource factory
(`makeResourceQueries('client_galleries', ...)` + `ResourceList`/`ResourceForm`): fields
Title (required), Couple (optional label), Description (textarea), Drive folder link
(required, the full `https://drive.google.com/...` URL), Access code (required, help text:
8+ characters, give it to the couple; the same code across several entries shows them
together), Order. Draft-first create with the standard publish-now banner; publish toggle,
reorder, delete as everywhere else.

## Part 2 — Owner-only team management

### Data

Same migration: `alter table public.profiles add column is_owner boolean not null default false`.
The owner is data, not code: `scripts/seed-admin.mjs` now marks the account it seeds
`is_owner = true` (hosted Step 8 therefore seeds the owner), and the local admin is updated in
place. RLS is untouched — `role = 'admin'` still gates content writes; `is_owner` matters only
to the team function and the team UI.

### Edge Function `manage-team`

Same auth skeleton as `sign-upload`/`delete-media` (getUser from the caller's token, profile
read with the service-role key) but the gate is **`is_owner = true`** — a mere admin gets 403.
Actions:

- `list` — every `role='admin'` profile joined to its auth email:
  `[{ userId, email, displayName, isOwner, createdAt }]`.
- `create { email, password }` — validates shape (email pattern; password ≥ 10 chars),
  `auth.admin.createUser` (email pre-confirmed; public signups stay disabled) + a
  `profiles` row `role='admin', is_owner=false`. Existing email → 409 `EMAIL_EXISTS`.
- `remove { userId }` — refuses the owner (403 `CANNOT_REMOVE_OWNER`); otherwise
  `auth.admin.deleteUser`, whose `on delete cascade` removes the profile.

Server-side is the enforcement; the UI gating below is courtesy, exactly like the
session gate vs RLS (see ARCHITECTURE's "where the actual boundary is").

### Admin UI

Settings tab gains a **Team** section rendered only for the owner (`useSession` now exposes
`profile.isOwner`; `src/lib/auth.js`'s `getProfile` selects the new column): the admin list
with Owner/Admin badges, per-row Remove (confirm; never on the owner row), and an add-admin
form (email + password) via `src/lib/queries/adminTeam.js` → `manage-team`. Non-owners see no
section and are refused server-side regardless.

## Out of scope / kept honest

- No client self-signup anywhere (`enable_signup` stays false); the access code is the
  client credential, admin accounts are owner-created.
- Drive links are the studio's own sharing choice; the portal controls who *finds* a link,
  Google controls who the folder itself admits.
- Roadmap: Phase 6's "client proofing portal" row is superseded by this simpler delivery
  portal — noted in ROADMAP.md; per-photo favourites/downloads are dropped, not deferred.

## Tests & gates

Unit: RPC query module, hook, both rewritten modals, resource config, adminTeam mapping,
admin tab + Team panel wiring (owner and non-owner), seed script owner flag. Live smokes
against the local stack: code lookup (right code / wrong code / draft entry invisible),
manage-team create/list/remove incl. non-owner refusal and owner-removal refusal. The four
repo gates standalone; hosted schema pushed with `supabase db push`.
