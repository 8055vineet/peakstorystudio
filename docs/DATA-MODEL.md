# Data Model

This document describes the data Peak Story Studio holds. As of Phase 1b (`v0.2b`) there are two
sources, and exactly one is authoritative at runtime, chosen by the `VITE_DATA_SOURCE`
environment variable (`src/lib/dataSource.js`):

- **`static`** — the default, and what any unconfigured environment falls back to regardless of
  what `.env.local` says. Content lives entirely in `src/data/weddingData.js`, a JavaScript module
  seeding React state, optionally overridden by `localStorage`, with writes going through
  `src/components/ContentManagerModal.jsx`. Everything below up to
  [The database](#the-database) describes this shape, unchanged since Phase 0.
- **`supabase`** — content is read from a local Postgres database instead, through
  `src/lib/queries/` and the hooks in `src/hooks/useContent.js` (see
  [The database](#the-database)). In this mode `weddingData.js` is no longer the source of
  truth: it is only the seed source (`scripts/seed-db.mjs` copies it into Postgres) and the
  fallback a hook returns before its first query resolves or if that query throws — never
  something a component reads directly.

The static shapes below are exactly what `src/data/weddingData.js` exports today, in either mode.

## Content modules

`src/data/weddingData.js` has exactly six exports. Counts below were obtained by reading the
file directly and counting object literals in each array (not by trusting any prior estimate).

### `INITIAL_STORIES` — 3 entries (`story-1`, `story-2`, `story-3`)

Fields present on every entry: `id`, `title`, `couple`, `location`, `date`, `coverImage`, `tags`
(array of strings), `summary`, `fullGallery` (array of image URL strings).

One field is not universal: `videoUrl` is present only on `story-1`; `story-2` and `story-3` omit
it entirely (not `null` — the key is absent). Any consumer that assumes `videoUrl` always exists
will crash or silently render `undefined` for two of the three stories.

### `INITIAL_PHOTOS` — 8 entries (`photo-1` through `photo-8`)

Fields present on every entry: `id`, `title`, `url`, `category`, `couple`, `location`, `span`.

Seed entries have 7 fields. Photos created at runtime through the Content Manager (see below)
add an eighth field, `isFeatured`, that none of the seed entries have — so the photo shape is not
even consistent within a single running session, let alone across the codebase.

### `INITIAL_FILMS` — 3 entries (`film-1`, `film-2`, `film-3`)

Fields present on every entry: `id`, `title`, `couple`, `location`, `duration`, `thumbnail`,
`videoEmbedUrl`.

### `TESTIMONIALS` — 3 entries (ids `1`, `2`, `3`)

Fields present on every entry: `id`, `quote`, `couple`, `event`.

### `FILM_STRIP_FRAMES` — 6 entries

Fields present on every entry: `title`, `location`, `img`. Consumed by
`src/components/FilmStrip.jsx`, the "behind the lens" marquee. Moved here from a `const`
declared inside the component body (see `PS-015` below and in `docs/KNOWN-ISSUES.md`).

### `EDITORIAL_GALLERY` — 5 entries

Fields present on every entry: `id` (number), `image`, `title`, `location`. Consumed by
`src/components/HorizontalGallery.jsx`, the horizontal-scroll "editorial showcase" carousel.
Moved here from a module-scope `const` in that component file (see `PS-015` below and in
`docs/KNOWN-ISSUES.md`).

## Field-level problems

These are the shapes the static file still holds, and the problems each causes whenever
`VITE_DATA_SOURCE=static` (the default) is in effect. The schema in
[The database](#the-database) below fixes several of them for the `supabase` path — a real
`date` column and an integer seconds column instead of the two display strings below, a `slug`
column, a uniform `uuid` id everywhere, and `alt_text` plus `width`/`height` columns on `media`
— but not all: `gallery_photos.grid_span` still stores the same literal Tailwind utility-class
string that `span` does here. `weddingData.js` itself is untouched either way, so every problem
below is still real whenever the static path is in effect. Each is a real value taken from
`src/data/weddingData.js`, not a hypothetical.

- **`date: "November 2024"`** (`INITIAL_STORIES`) is a free-text display string, not a sortable
  or filterable date type. `"June 2025"`, `"February 2025"`, and `"November 2024"` cannot be
  ordered chronologically without re-parsing English month names, and the Content Manager's
  story-creation path (`ContentManagerModal.jsx`) defaults an empty date field to the literal
  string `"2025"`, compounding the inconsistency.
- **`duration: "4:32 mins"`** (`INITIAL_FILMS`) is a display string, not a number. There is no
  numeric seconds/minutes field, so sorting films by length or validating input requires parsing
  this string first.
- **`span: "col-span-1 md:col-span-2 row-span-2"`** (`INITIAL_PHOTOS`) embeds literal Tailwind
  utility classes inside the data layer, coupling content to a specific CSS framework and a
  specific grid layout. Changing the visual grid means editing data records, and the data cannot
  be consumed by anything that doesn't share this exact Tailwind configuration.
- **`id` types are inconsistent across and within collections.** Seed photo ids are strings like
  `"photo-1"` through `"photo-8"`. Photos created through the Content Manager get ids of the
  shape `` `photo-user-${Date.now()}` `` (also a string, but never colliding with the seed
  numbering scheme). Seed stories follow the same pattern (`"story-1"`, `"story-2"`,
  `"story-3"`), and Content-Manager-created stories get `` `story-user-${Date.now()}` ``.
  Testimonial ids, however, are plain **numbers** (`1`, `2`, `3`) — a different type from every
  other collection's id. This inconsistency already caused a real bug, fixed in commit
  `8ef6d5e`: the client gallery seeded a client's favourites using ids that didn't match the
  string-typed photo ids the gallery actually renders, so seeded favourites could never match.
- **No `slug` field exists anywhere.** Stories, photos, and films are identified only by their
  `id`; there is no human-readable, URL-safe identifier. Per-wedding or per-story shareable URLs
  (e.g. `/stories/royal-palace-symphony`) are impossible to build without adding one.
- **`alt` text is not stored.** Nothing in `weddingData.js` has an `alt` field. Components that
  render these images (e.g. the gallery and lightbox) pass the record's `title` as the `alt`
  attribute instead of real accessibility-authored alt text, so decorative or non-descriptive
  titles end up as screen-reader alt text by accident.
- **Image dimensions are not stored.** No entry carries `width`/`height` (or an aspect ratio) for
  any image (`coverImage`, `fullGallery` entries, `url`, `thumbnail`). Without intrinsic
  dimensions, the browser cannot reserve layout space before the image loads, so layout shift is
  unavoidable on every image-bearing section.

## localStorage contract

`src/App.jsx` maintains three `localStorage` keys, each written by its own `useEffect` and read
by its own lazy `useState` initializer:

| Key | Written by (effect) | Read by (initializer) |
| --- | --- | --- |
| `peak_story_stories` | The `useEffect` at lines 45–47 of `src/App.jsx`, which runs `localStorage.setItem('peak_story_stories', JSON.stringify(stories))` whenever `stories` changes. | The `useState(() => …)` initializer at lines 27–34, which reads and `JSON.parse`s the key, falling back to `INITIAL_STORIES` if the key is absent or parsing throws. |
| `peak_story_photos` | The `useEffect` at lines 49–51, which runs `localStorage.setItem('peak_story_photos', JSON.stringify(photos))` whenever `photos` changes. | The `useState(() => …)` initializer at lines 36–43, falling back to `INITIAL_PHOTOS`. |
| `peak_story_user` | The `useEffect` at lines 62–68: if `user` is truthy it calls `localStorage.setItem('peak_story_user', JSON.stringify(user))`; if `user` is falsy (logout) it calls `localStorage.removeItem('peak_story_user')` instead of writing `null`. | The `useState(() => …)` initializer at lines 53–60, falling back to `null`. |

**Quota risk.** `src/components/ContentManagerModal.jsx` reads user-selected image files with
`FileReader.readAsDataURL` (`handleFileUpload`, lines 28–38) and stores the resulting base64
data URL directly as the photo's `url` field (or the story's `coverImage` field). That value then
flows into `peak_story_photos` / `peak_story_stories` via the effects above. Base64-encoded image
data is roughly a third larger than the original binary, and browsers cap an origin's total
`localStorage` at roughly 5 MB. A handful of full-resolution photo uploads is enough to exhaust
that quota, at which point `localStorage.setItem` throws and — because neither effect above
wraps its call in a `try`/`catch` — the failure is unhandled.

## Image sources

Image data mixes two origins: local files served from `public/images/` and hotlinked images on
`images.unsplash.com`.

Local files present in `public/images/` (verified with `ls`):

- `bridal_portrait.jpg`
- `destination_wedding.jpg`
- `hero_royal.jpg`
- `luxury_camera.jpg`

Only three of these four are referenced by the content modules. `INITIAL_STORIES`,
`INITIAL_PHOTOS`, and `INITIAL_FILMS` reference `bridal_portrait.jpg`, `destination_wedding.jpg`,
and `hero_royal.jpg` repeatedly (e.g. `/images/hero_royal.jpg` is reused as `story-1`'s cover,
`photo-1`'s image, and `film-1`'s thumbnail). `INITIAL_STORIES` and `INITIAL_PHOTOS` otherwise
point at `https://images.unsplash.com/photo-...` URLs for every other image, but `INITIAL_FILMS`
(`src/data/weddingData.js:131-159`) does not — all three of its `thumbnail` values are local
`/images/...` paths, with zero Unsplash URLs. `luxury_camera.jpg` is **not**
referenced anywhere in `src/data/weddingData.js` — it is a UI asset used only by
`src/components/SplashScreen.jsx` (the branded splash screen shown on load), entirely outside the
content-module data described in this document. Phase 1 should not treat it as content requiring
migration into a story/photo/film row. **Third-party dependency risk:** every hotlinked Unsplash
URL is outside this project's control — Unsplash can rate-limit, deprecate, or 404 any of these
URLs at any time, and the site has no fallback or caching layer, so a portion of the gallery and
story galleries can go blank without any code change on this side. `FILM_STRIP_FRAMES` and
`EDITORIAL_GALLERY` (both in `src/data/weddingData.js`, described above) each hotlink several
more `images.unsplash.com` URLs of their own — until `PS-015` was resolved these lived hardcoded
inside `src/components/FilmStrip.jsx` and `src/components/HorizontalGallery.jsx` respectively,
independent of this data module; they have since been moved here, so the full set of Unsplash
hotlinks Phase 1's migration needs to account for is now entirely contained in the content
modules described in this document (see `PS-015` in `docs/KNOWN-ISSUES.md`).

## The database

When `VITE_DATA_SOURCE=supabase`, content is read from a local Postgres database (run via
`supabase start`), not from this file. The schema — eight tables — lives in
`supabase/migrations/`:

- `20260730203451_initial_schema.sql` creates `media` (image records: storage path, width,
  height, `alt_text`, `blurhash`), `weddings` (one row per wedding story, with a `slug`), the
  `wedding_photos` join table (links a wedding to its ordered gallery images), `gallery_photos`
  (the standalone photo grid), `films`, `testimonials`, `profiles` (admin/client role, keyed to
  `auth.users`), and `inquiries` (booking-form submissions — not yet written to; that starts in
  Phase 2).
- `20260730204126_row_level_security.sql` enables Row Level Security on all eight and defines the
  read/write policies (published content is world-readable; only an admin profile can write; the
  anon key gets no access at all to `inquiries`). One exception: `media` has no `status` column of
  its own and its `media_read_all` policy has no predicate, so a `media` row is world-readable
  regardless of whether the wedding or gallery photo that references it is published or draft —
  tracked as `PS-025` in [KNOWN-ISSUES.md](KNOWN-ISSUES.md).
- `20260731090000_inquiry_pipeline.sql` (Phase 2, Task 1) adds `inquiries.notification_status`
  and creates `inquiry_rate_limits` and `consume_inquiry_rate_limit()` — the groundwork the
  Phase 2 submit-inquiry Edge Function needs before it can write a row. See
  [Inquiry rate limiting](#inquiry-rate-limiting) below.

`inquiries.notification_status` is a text column, defaulting to `pending`, constrained to four
values: `pending` (the row was written but no notification attempt has happened yet), `sent` (the
studio's notification email was accepted by Resend), `failed` (Resend rejected or errored on the
send), and `skipped` (no notification was attempted because email was never configured in this
environment). The inquiry row is written regardless of which of the last three applies — a lead
is saved even if the email step fails outright — so this column is the only record of whether the
studio was actually told about it.

`scripts/seed-db.mjs` copies the four content arrays this document describes
(`INITIAL_STORIES`, `INITIAL_PHOTOS`, `INITIAL_FILMS`, `TESTIMONIALS`) into these tables. Two
fields change type in that copy, because the target columns are typed rather than display
strings:

- **`date: "November 2024"`** (`INITIAL_STORIES`) becomes `weddings.event_date`, a real Postgres
  `date` (`2024-11-01`). `src/lib/queries/weddings.js` formats it back to `"November 2024"` as
  the `date` field components already read, and also returns the raw ISO value as `eventDate`.
- **`duration: "4:32 mins"`** (`INITIAL_FILMS`) becomes `films.duration_seconds`, an integer
  (`272`). `src/lib/queries/films.js` rebuilds the `"4:32 mins"` string as the `duration` field
  components already read.

`FILM_STRIP_FRAMES` and `EDITORIAL_GALLERY` — described above — have no table; see `PS-023` in
[KNOWN-ISSUES.md](KNOWN-ISSUES.md).

### Inquiry rate limiting

`inquiry_rate_limits` is a per-visitor counter, keyed on `ip_hash` — a salted SHA-256 hash of the
submitter's IP address, never the address itself, so the table holds nothing that identifies a
person on its own. It has no RLS policies at all (not "world-readable" restricted to admin, but
*none*): anon and authenticated get nothing, and the only grant is `select, insert, update,
delete` to `service_role`. The Phase 2 submit-inquiry Edge Function is the only writer, and it
reaches this table with the service-role key, which bypasses RLS entirely — the grant still has
to exist regardless, because Postgres checks table privileges before it ever evaluates a policy.

`consume_inquiry_rate_limit(p_ip_hash text, p_max_requests integer, p_window interval)` is how
the Edge Function touches that table — it never writes to it directly. Called by RPC, it does the
window roll, the increment, and the read in one statement (so two simultaneous requests from the
same visitor cannot both pass a limit that admits only one), and returns exactly one row of
`(allowed boolean, retry_after_seconds integer)`. If the visitor's current window has expired
(older than `p_window`), it starts a new one at a count of 1 and allows the request. Otherwise it
increments the existing window's count; if that count now exceeds `p_max_requests`, it returns
`false` with a `retry_after_seconds` counting down to when the window resets, and does not count
the rejected attempt again toward a future window. The function also opportunistically deletes
rows older than `greatest(p_window, interval '1 day')` on every call, so the table never grows
without bound at this traffic — the cutoff is never shorter than the caller's own window, because
a bare one-day cutoff would delete a still-live counter out from under any caller using a
day-or-longer window, silently defeating that caller's limit. It is `security definer` and
`execute` is granted only to `service_role` — anon cannot call it any more than it can read the
table directly.

For the exact columns, constraints, indexes, and RLS policies, the migration files themselves are
the source of truth. [The platform design spec](./superpowers/specs/2026-07-30-end-to-end-platform-design.md),
section 5.2 ("Schema") and 5.3 ("Row Level Security"), records the rationale behind that shape.
