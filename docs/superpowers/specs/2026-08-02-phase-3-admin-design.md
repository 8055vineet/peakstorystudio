# Phase 3 (v0.4) — Admin: authentication, leads, content, and media

**Status:** approved 2026-08-02. Supersedes nothing; extends
[the end-to-end platform design](2026-07-30-end-to-end-platform-design.md), which deliberately
left Phase 3 sketched and deferred the media-storage decision to it.

## 1. What this phase is for

Phase 2 made booking inquiries real. They now land in Postgres — and the studio has no way to
read them except a raw SQL query. The email notification is a mitigation, not a system: if
Resend has a bad hour or a message is deleted, the lead exists only in a table nobody can see.

Phase 3 closes that, and the equivalent gap on the content side. Today the only way to add a
wedding is to edit `src/data/weddingData.js` and redeploy, because the existing Content Manager
writes to `localStorage` and is a silent no-op against the database. After this phase a wedding
can be published, and a lead worked, without touching code.

**Definition of done:** an admin signs in, sees every inquiry with its status, changes that
status, adds a wedding with real photographs uploaded from a browser, publishes it, and sees it
on the live site — with no code edit and nothing in `localStorage`.

## 2. Scope

### In

- Supabase Auth for admin sign-in; public signup disabled.
- A leads dashboard over `public.inquiries`.
- Content CRUD for weddings, wedding photos, gallery photos, films, and testimonials.
- Image upload to S3-compatible object storage, with the `media` table as the index.
- Removal of `VITE_DATA_SOURCE`: the database becomes authoritative.

### Tracked issues this phase closes

| ID | Why it belongs here |
| --- | --- |
| `PS-004` | Uploaded images are base64 in `localStorage`, exceeding the ~5 MB quota. Real uploads replace it. |
| `PS-005` | "Export Config JSON" sets a "Copied!" label and copies nothing. The button becomes meaningless once the database is authoritative — it is removed, not fixed. |
| `PS-022` | The Content Manager has no date input at all, so every story it publishes is stamped 2025. Resolved by a date picker storing a real `date`. |
| `PS-024` | The Content Manager is a silent no-op on the `supabase` path — it writes local state that nothing renders. |

### Deliberately deferred

`PS-009` (modal focus trap, Escape, scroll lock), `PS-014` (duplicated pill and badge markup),
`PS-016` (unused CSS and palette tokens), `PS-017` (`title` instead of `aria-label`), `PS-018`
(hotlinked Unsplash images), `PS-020` (`SectionDivider` raw hex), `PS-021` (`useScrollReveal`
dependency warnings), and `PS-023` (film strip and editorial gallery have no tables).

The register files all eight under phase 3, but they share nothing with authentication,
uploads, or a leads dashboard except a version number. Bundling them would mix
security-sensitive review with cosmetics and delay a usable admin. They move to a dedicated
polish pass; the register is updated to say so rather than left contradicting this document.

### Out of scope

Client-facing galleries and per-client auth (Phase 6), routing and per-wedding URLs (Phase 5),
hosting (Phase 4), the truthful-content pass (Phase 7), and any change to the public site's
visual design.

## 3. Decisions, and why

### 3.1 Object storage: Cloudflare R2

The platform spec deferred this decision to Phase 3 and named R2 the likely choice. Confirmed,
but not for the reason originally recorded.

The studio uploads sample photographs for the website, not client originals, so total volume
sits comfortably inside either free tier — the 10 GB against Supabase's 1 GB is not what
decides it. **Egress is.** A gallery site serves dozens of images per visitor; at roughly
300 KB an image, a thousand visitors browsing twenty images each is 6 GB in a month, past
Supabase's 5 GB free egress. R2 charges nothing for egress at any volume, and sits on the
platform Phase 4 already chose for hosting.

**Caveat to settle before Phase 4:** Cloudflare requires a payment method on file to activate
R2 even within the free allowance. If that is unacceptable, Supabase Storage is the fallback
and the code does not change — see 3.2.

### 3.2 One storage code path, S3 everywhere

R2 has no local equivalent, which would normally mean one implementation for development and
another for production — precisely the arrangement in which bugs hide until deployment.

They are avoidable here: the local Supabase stack already exposes an S3-compatible endpoint at
`STORAGE_S3_URL` (`http://127.0.0.1:54321/storage/v1/s3`) with its own access key, secret, and
region, and R2 is S3-compatible. **One code path speaks S3**, pointed at local Supabase in
development and R2 in production by configuration alone. Switching to Supabase Storage in
production, should the R2 caveat above bite, becomes a change of environment variables.

### 3.3 The admin is a separate page, not a modal or a route

`admin.html` is a second Vite entry point with its own `src/admin/` tree.

A leads table with filtering and a detail view does not fit a modal, and the current
`ContentManagerModal` is the cautionary example. Adding a router instead would pull Phase 5's
scheduled work into this branch. A second entry point costs one Vite config block and keeps
**admin code out of the public bundle entirely** — a visitor to the marketing site never
downloads the dashboard.

Vite serves it at `/admin.html` in development. Phase 4 adds the `/admin` redirect at the
hosting layer; this phase does not pretend to solve that.

### 3.4 Email and password, signup disabled

`supabase/config.toml` currently has `[auth] enable_signup = true`. It becomes `false`, so the
only accounts that exist are ones created deliberately.

Password beats magic link here because it works with no email delivery configured, which keeps
local development and CI self-contained; a studio of one or two people does not need
passwordless. The `profiles.role` column and the `is_admin()` function built in Phase 1b were
designed for exactly this and need no change.

### 3.5 Dates come from a picker

`PS-022`: the admin picks a calendar date, stored in the existing `date` column. The site
renders it as "November 2024". Free text cannot be sorted or filtered and puts typos on a live
page; deriving it from a linked wedding only works once every story has one.

## 4. Architecture

```
public site (index.html)          admin app (admin.html)
        │                                   │
        │                          src/admin/** components
        │                                   │
        └──────────► src/hooks/ ◄───────────┘
                          │
                    src/lib/queries/          src/lib/auth.js
                          │                         │
                    src/lib/supabase.js ────────────┘
                          │
        ┌─────────────────┴──────────────────┐
   Postgres + RLS                    sign-upload Edge Function
        │                                    │
   content, inquiries,              presigned PUT ──► S3 (local Supabase / R2)
   media, profiles
```

The existing layering rule holds unchanged and applies to the admin exactly as it does to the
public site: **components never import the Supabase client.** Components call hooks, hooks call
`src/lib/queries/`, and only `src/lib/supabase.js` constructs a client. `src/lib/auth.js` is a
sibling of the query modules under the same rule.

## 5. Authentication

### 5.1 The boundary is RLS, not the UI

The admin gate in the browser decides what to *render*. It is not what protects anything.
Postgres does: ten `is_admin()` policies from Phase 1b already govern every write, and
`inquiries` is readable only by an admin. A signed-in non-admin who defeats the client gate
sees an empty dashboard and every write fails, because the database refuses it.

This must be stated in the code, not only here, so nobody later "simplifies" the client check
believing it to be the control.

### 5.2 Shape

- `src/lib/auth.js` — `signIn`, `signOut`, `getSession`, `onAuthStateChange`, `getProfile`.
- `src/hooks/useSession.js` — returns `{ session, profile, status }` where `status` is
  `loading | anonymous | authenticated | forbidden`. `forbidden` is a real session whose
  profile is not an admin, and it renders a refusal rather than a login form, because telling
  someone to sign in again when they are already signed in is a dead end.
- The admin app renders the dashboard only for `authenticated`.

### 5.3 Creating the admin

`scripts/seed-admin.mjs`, run against the local stack with the service-role key: creates an
`auth.users` row and a `profiles` row with `role = 'admin'`, reading credentials from the
environment. It must be **idempotent and repeatable after `npm run db:reset`**, because a
migration that replays from empty leaves no admin behind and an unusable local admin is a dead
end for the next person.

Production account creation is a Phase 4 deploy step, not this phase.

## 6. Media upload

### 6.1 Flow

1. The admin picks a file in the browser.
2. The browser resizes and re-encodes it before anything leaves the machine — longest edge
   capped at 2000px, WebP — and records the resulting width and height.
3. The browser calls the `sign-upload` Edge Function with the intended content type and size.
4. The function verifies the caller's JWT **and** that their profile is an admin, rejects
   anything outside an allowlist of image content types or over a size ceiling, generates a
   storage key, and returns a presigned `PUT` URL.
5. The browser `PUT`s the file directly to storage. Bytes never pass through the function.
6. The browser inserts a `media` row — `storage_path`, `width`, `height`, `alt_text` — which
   RLS permits only for an admin.

Client-side resizing is not a security control; it is a bandwidth and quota measure. The
function's own type and size checks are the control, and the storage key is generated
server-side so a caller cannot choose where a file lands or overwrite another.

### 6.2 What is deliberately not built

`media.blurhash` stays null. The column anticipates placeholder rendering, but nothing in this
phase renders one, and computing a hash the site ignores is work with no reader. Width and
height *are* recorded, because they are free at upload time and they are what a later fix for
layout shift will need.

### 6.3 Alt text

`media.alt_text` is `not null default ''`. The upload form asks for it and explains why. It is
not enforced as required — an admin blocked from publishing by a validation rule will type "x"
— but an empty value is surfaced in the media list so it can be corrected.

## 7. The leads dashboard

A table over `public.inquiries`: name, email, phone, wedding date, venue, submitted date,
status, and **`notification_status`**. That last column is the point of showing it — an inquiry
the studio was never successfully emailed about is visible rather than silent, which is the
failure mode Phase 2 built the column for.

Filter by `status`. A detail view shows the full message and services. Status moves through
`new → contacted → booked → archived`, each an update RLS already permits for an admin.

Deleting a lead is not offered. `archived` is the exit; a booking inquiry is a business record.

## 8. Content management

CRUD over `weddings`, `wedding_photos`, `gallery_photos`, `films`, and `testimonials`, each with
list, create, edit, delete, and a `status` toggle between `draft` and `published`. Ordering uses
the existing `sort_order` columns.

The public site already tolerates an empty collection — `Testimonials` guards, and every content
section must, because an unpublished collection is now a normal state rather than an impossible
one. Any section that indexes into its data needs the same guard.

`src/components/ContentManagerModal.jsx` is deleted, along with its trigger and the
`localStories` / `localPhotos` state in `src/App.jsx`. That is what closes `PS-004`, `PS-005`
and `PS-024`; leaving a half-working duplicate beside a real admin is worse than either alone.

## 9. Making the database authoritative

`VITE_DATA_SOURCE` and `src/lib/dataSource.js` are removed. Content always comes from Postgres.

`src/data/weddingData.js` survives, but only in the role `useContent` already gives it: the
value rendered when a query **fails**. A stale site beats a blank one during an outage, and that
fallback is error handling rather than a configuration switch.

Two consequences to record rather than discover:

- Phase 7's truthful-content pass must clean `weddingData.js` too. It is no longer the site's
  content, but it is still what a visitor sees when the database is unreachable, so the
  fabricated press credentials and testimonials in it remain a live exposure until then.
- `FILM_STRIP_FRAMES` and `EDITORIAL_GALLERY` (`PS-023`) have no tables and are read directly by
  their components, not through the flag. Removing `VITE_DATA_SOURCE` neither fixes nor breaks
  them; they stay static and `PS-023` stays open.

## 10. Error handling

The admin is a tool for one or two people who can retry, so it does not need the public form's
elaborate recovery. It does need to never lie:

- Every mutation reports success only after the database confirms it. No optimistic UI that
  shows a saved state the server rejected — the defect this project already fixed once in
  `BookingForm` and must not reintroduce.
- A failed query renders the error and a retry, never an empty list that reads as "no data".
  An empty leads table and a broken leads table must be visually distinct.
- An upload can fail at three points — signing, the `PUT`, the `media` insert. A file that
  reaches storage but whose row fails leaves an orphan; the admin is told the upload did not
  complete and may retry. Orphan reaping is not built, and is noted as accepted debt.
- Session expiry mid-edit surfaces as a re-authentication prompt, not a silent write failure.

## 11. Quality gates

Everything Phase 2 established continues to apply: `npm run lint`, `npm test`,
`npm run check:docs`, `npm run build`, and `npm run verify:inquiry` in CI.

New for this phase:

| Gate | Covers |
| --- | --- |
| Unit | `auth.js` and the admin query modules against a mocked client; `useSession`'s four states |
| Unit | The image resize helper: dimensions, aspect ratio, and that an already-small image is not upscaled |
| Edge Function | `sign-upload` rejects an anonymous caller, a signed-in non-admin, a disallowed content type, and an oversized file |
| End-to-end | `npm run verify:admin` — sign in, create a wedding, upload a file, publish, read it back through the public query layer, and assert against Postgres |

The end-to-end gate matters for the same reason `verify:inquiry` does: a green unit suite over
mocked storage proves nothing about whether a photograph actually reaches a bucket. It must be
demonstrated capable of failing.

## 12. Security notes

- The service-role key is used by `scripts/seed-admin.mjs` and the `sign-upload` function only.
  It must never appear in a `VITE_`-prefixed variable, the admin bundle, or a committed file.
- S3 credentials live in Edge Function secrets. The browser receives a presigned URL scoped to
  one key and a short expiry, never a credential.
- The storage key is generated server-side. A caller cannot choose the path, so cannot overwrite
  an existing object or escape the prefix.
- The bucket is private. Public read access is configured at Phase 4 via a Cloudflare custom
  domain in front of R2, not by making objects world-writable.
- `enable_signup = false` means a leaked anon key cannot be used to create an account.

## 13. Risks

| Risk | Mitigation |
| --- | --- |
| R2 needs a card on file | Flagged before Phase 4; Supabase Storage is a configuration-level fallback because both speak S3 |
| A large admin surface invites scope creep | The deferred-issues list is explicit; anything not in section 2 waits |
| Deleting `ContentManagerModal` removes a working-looking feature | It only looks like it works — it writes state nothing renders (`PS-024`). Replaced in the same branch, never absent |
| Local S3 and R2 diverge in behaviour despite both being S3 | The end-to-end gate runs against local S3; R2 is exercised for real at Phase 4, before the site is public |

## 14. Relationship to later phases

Phase 4 deploys this: hosted Supabase, the R2 bucket and its public domain, the `/admin`
redirect, and the production admin account. Phase 6's client portal reuses this auth
foundation with `profiles.role = 'client'`, which is why the column already has both values.
