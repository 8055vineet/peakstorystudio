# Data Model

This document describes the data Peak Story Studio holds. Since Phase 1b (`v0.2b`) a local
Postgres database exists alongside the original static `src/data/weddingData.js` module, and as
of Phase 3 Task 10 the database is unconditionally authoritative — there is no more
`VITE_DATA_SOURCE` environment variable and no `dataSource.js` resolver module (formerly under
`src/lib`) to choose between them.
Content is read through `src/lib/queries/` and the hooks in `src/hooks/useContent.js` (see
[The database](#the-database) below).

`weddingData.js` still exists, but only in two narrower roles: it is the seed source
(`scripts/seed-db.mjs` copies it into Postgres), and it is the *error fallback* each
`useContent.js` hook returns synchronously on first render (before its query has resolved) and
again from that query's `catch` if the query fails outright — never something a component reads
directly, and never a second source a flag can select. That is resilience, not configuration: a
stale site beats a blank one when the database is briefly unreachable. Because of that,
`weddingData.js` is still exactly what a visitor sees during an outage, which is why Phase 7's
truthful-content pass still has to clean it — see `PS-002` in `docs/KNOWN-ISSUES.md`. There is
also no longer any `localStorage`-backed override of it: the old Content Manager modal that wrote
`peak_story_stories`/`peak_story_photos` was deleted in the same Task 10 change (see "Resolved" in
`docs/KNOWN-ISSUES.md`); real content is now written through the separate admin app under
`src/admin/`, straight into Postgres.

The static shapes below are exactly what `src/data/weddingData.js` exports today.

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

Seed entries have 7 fields. Before Phase 3 Task 10, photos added at runtime through the (since
deleted) Content Manager modal added an eighth field, `isFeatured`, that none of the seed entries
have. That runtime path no longer exists — real photos are now written through the admin's
`gallery_photos` CRUD (`src/admin/resources/gallery.js`), whose schema has no `isFeatured`
column — but the seven-field static shape below is unchanged.

### `INITIAL_FILMS` — 3 entries (`film-1`, `film-2`, `film-3`)

Fields present on every entry: `id`, `title`, `couple`, `location`, `duration`, `thumbnail`,
`videoEmbedUrl`.

### `TESTIMONIALS` — 3 entries (ids `1`, `2`, `3`)

Fields present on every entry: `id`, `quote`, `couple`, `event`.

### `FILM_STRIP_FRAMES` and `EDITORIAL_GALLERY` — removed in Phase 3b

Both arrays (6 film-strip frames; 5 editorial-carousel entries) were deleted along with the
two decorative components that consumed them — the "behind the lens" marquee and the
horizontal "editorial showcase" carousel — when the multi-page redesign dropped those
sections. This closed `PS-023` (neither array ever had a database table for the admin to write
to); see Resolved in `docs/KNOWN-ISSUES.md`.

## Field-level problems

These are the shapes the static file still holds, and the problems each causes whenever it is
what a visitor actually sees — the error-fallback case described above, now that the database is
otherwise unconditionally authoritative. The schema in [The database](#the-database) below fixes
several of them for real, database-backed content — a real `date` column and an integer seconds
column instead of the two display strings below, a `slug` column, a uniform `uuid` id everywhere,
and `alt_text` plus `width`/`height` columns on `media` — but not all: `gallery_photos.grid_span`
still stores the same literal Tailwind utility-class string that `span` does here. `weddingData.js`
itself is untouched either way, so every problem below is still real whenever a visitor is
looking at it. Each is a real value taken from `src/data/weddingData.js`, not a hypothetical.

- **`date: "November 2024"`** (`INITIAL_STORIES`) is a free-text display string, not a sortable
  or filterable date type. `"June 2025"`, `"February 2025"`, and `"November 2024"` cannot be
  ordered chronologically without re-parsing English month names. (Before Phase 3 Task 10, the
  now-deleted Content Manager modal made this worse by defaulting every empty date field to the
  literal string `"2025"` — `PS-022`, resolved in `docs/KNOWN-ISSUES.md`. The admin's own
  wedding-story form, built in Task 8, uses a real `type: 'date'` input bound to the database's
  `event_date` column instead, so this specific compounding no longer happens for new content —
  the string-typed static shape below is what's left.)
- **`duration: "4:32 mins"`** (`INITIAL_FILMS`) is a display string, not a number. There is no
  numeric seconds/minutes field, so sorting films by length or validating input requires parsing
  this string first.
- **`span: "col-span-1 md:col-span-2 row-span-2"`** (`INITIAL_PHOTOS`) embeds literal Tailwind
  utility classes inside the data layer, coupling content to a specific CSS framework and a
  specific grid layout. Changing the visual grid means editing data records, and the data cannot
  be consumed by anything that doesn't share this exact Tailwind configuration.
- **`id` types are inconsistent across and within collections.** Seed photo ids are strings like
  `"photo-1"` through `"photo-8"`; seed stories follow the same pattern (`"story-1"`, `"story-2"`,
  `"story-3"`). (Before Phase 3 Task 10, the now-deleted Content Manager modal minted its own ids
  of the shape `` `photo-user-${Date.now()}` `` / `` `story-user-${Date.now()}` `` for anything
  added through it — also strings, never colliding with the seed numbering scheme, but that path
  no longer exists; real rows now get a database `uuid` from `src/admin/`'s CRUD instead.)
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

`src/App.jsx` maintains exactly one `localStorage` key today: `peak_story_user`, written by a
`useEffect` and read by a lazy `useState` initializer — if `user` is truthy the effect calls
`localStorage.setItem('peak_story_user', JSON.stringify(user))`; if `user` is falsy (logout) it
calls `localStorage.removeItem('peak_story_user')` instead of writing `null`. The initializer
reads and `JSON.parse`s the key, falling back to `null` if it is absent or parsing throws.

Before Phase 3 Task 10 there were two more keys, `peak_story_stories` and `peak_story_photos`,
written by the now-deleted Content Manager modal's `App.jsx` state and read back the same way.
Both keys, their effects, and their initializers were removed in that change along with the
modal — there is no longer any `localStorage`-backed content override, and no quota risk from
base64-encoded uploads written into it (`PS-004`, resolved in `docs/KNOWN-ISSUES.md`): the admin
now uploads straight to Supabase Storage through `src/hooks/useMediaUpload.js`.

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
referenced anywhere in `src/data/weddingData.js` — it was a UI asset of the splash screen,
which Phase 3b deleted; the file may still sit in `public/images/` unreferenced. Phase 3b also
added three content-adjacent static files of its own: `public/images/home/hero.jpg`,
`brand-story.jpg`, and `closing.jpg`, the owner-swappable Home image slots described in
`docs/ARCHITECTURE.md` — page furniture referenced by `src/data/homeContent.js`, deliberately
outside both the database and this module. **Third-party dependency risk:** every hotlinked
Unsplash URL is outside this project's control — Unsplash can rate-limit, deprecate, or 404
any of these URLs at any time, and the site has no fallback or caching layer, so a portion of
the gallery and story galleries can go blank without any code change on this side. (The two
decorative arrays that once added more Unsplash hotlinks of their own were removed in Phase 3b
— see above.)

## The database

Content is read from a local Postgres database (run via `supabase start`), not from
`weddingData.js` — the one exception being the error-fallback role described above. The schema —
eight tables — lives in `supabase/migrations/`:

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

### `media`, and the two different ways a row gets there

Every image `weddings`, `gallery_photos`, and `films` render is a foreign key into `media` —
`weddings.cover_media_id`, `wedding_photos.media_id`, `gallery_photos.media_id`, and
`films.thumbnail_media_id` — never a URL stored on the row itself. No component ever reads
`media` directly; each query module's `SELECT` embeds it (e.g. `cover:cover_media_id
(storage_path)` in `src/lib/queries/weddings.js`) and flattens it into the field a component
already expects (`coverImage`, `url`, `thumbnail`).

A `media` row is written by exactly one of two paths, and its `storage_path` means something
different depending on which:

- **`scripts/seed-db.mjs`** (used by `npm run db:seed`) writes each seed content item's *original*
  URL directly into `storage_path` — an `images.unsplash.com` link or a local `/images/...` path,
  copied verbatim from `src/data/weddingData.js`. It is already a complete, renderable URL.
- **A real admin upload** (Phase 3; `src/hooks/useMediaUpload.js` -> `sign-upload` -> the
  browser's own `PUT` -> `src/lib/queries/media.js`'s `createMedia`) writes a **bucket-relative
  key** generated server-side by `sign-upload`, of the shape `uploads/<uuid>.<ext>` — never a full
  URL, and never anything the client supplied.

Nothing in the schema distinguishes these two shapes; `storage_path` is a `text` column that
happens to hold a full URL for every seeded row and a bucket key for every uploaded one. The
query layer does distinguish them: `src/lib/mediaUrl.js`'s `publicMediaUrl()` — called from
`src/lib/queries/weddings.js`, `gallery.js`, and `films.js` — passes an already-absolute URL
through unchanged and joins a bare bucket key against `VITE_MEDIA_BASE_URL`. That still leaves a
genuinely uploaded, published photograph unable to display on the public site today, because the
storage bucket itself is private with no public read path yet — see `PS-033` in
[KNOWN-ISSUES.md](KNOWN-ISSUES.md) for the remaining configuration gap.

**`blurhash` stays null, deliberately.** The column's own migration comment
(`supabase/migrations/20260730203451_initial_schema.sql`) anticipated it being "populated from
Phase 3, when uploads exist," but Phase 3 made a deliberate call not to: nothing in this phase
renders a placeholder blur, so computing a hash nothing reads would be work with no reader. `width`
and `height` *are* recorded on every real upload (`src/hooks/useMediaUpload.js` reads them off the
canvas it just resized, so they always match the bytes actually stored) precisely because they are
free at upload time and are what a later fix for layout shift (`PS-018`) will need. Do not treat
the migration comment as still describing intent — this paragraph supersedes it.

**How `wedding_photos` joins weddings to media.** A wedding's *cover* photo and its *full gallery*
are two independent relationships, not one: `weddings.cover_media_id` is a single, nullable
foreign key straight to `media`, while `wedding_photos` is a separate join table — composite
primary key `(wedding_id, media_id)`, **no `id` column of its own** — recording every photo
attached to that wedding's gallery, ordered by its own `sort_order`. A wedding's cover image need
not be one of the photos in `wedding_photos` at all (though in practice an admin usually attaches
it to both). `src/lib/queries/weddings.js`'s `getWeddingBySlug`/`getPublishedWeddings` select both
in one query and flatten `wedding_photos` (sorted client-side by `sort_order`) into
`fullGallery`, an array of `storage_path` strings.

The admin's write side cannot reuse the generic resource factory
(`src/lib/queries/adminContent.js`'s `makeResourceQueries`) for `wedding_photos`, for three
reasons verified directly against the schema before `src/lib/queries/adminWeddingPhotos.js` was
hand-written instead: the composite primary key has no `id` for the factory's functions to key
off; there is no `status` column for a publish toggle to act on; and the factory's `list()` has no
per-wedding filter, so pointed at this table it would return every wedding's photos globally
interleaved under one `sort_order` rather than one wedding's own ordered set. One invariant holds
throughout that hand-written module: removing a `wedding_photos` row **never** deletes the
underlying `media` row — the same photograph may be attached to another wedding, the standalone
gallery, or nothing at all, and is deleted (if ever) only from the Media Library itself.

### Inquiry rate limiting

`inquiry_rate_limits` is a per-visitor counter, keyed on `ip_hash` — a salted SHA-256 hash of the
submitter's IP address, never the address itself, so the table holds nothing that identifies a
person on its own. It has no RLS policies at all (not "world-readable" restricted to admin, but
*none*): anon and authenticated get nothing, and the only grant is `select, insert, update,
delete` to `service_role`. The Phase 2 submit-inquiry Edge Function is the only writer, and it
reaches this table with the service-role key, which bypasses RLS entirely — the grant still has
to exist regardless, because Postgres checks table privileges before it ever evaluates a policy.

`consume_inquiry_rate_limit(p_ip_hash text, p_max_requests integer, p_window interval)` is how
the Edge Function touches that table — it never writes to it directly. `p_window` must be
strictly positive and no greater than 30 days; a call outside that range raises an exception
(caught by the Edge Function's fail-open handling around this RPC call, so an out-of-range window
degrades to "no rate limiting on this request" rather than blocking a submission). Called by RPC,
it does the window roll, the increment, and the read in one statement (so two simultaneous
requests from the same visitor cannot both pass a limit that admits only one), and returns exactly
one row of `(allowed boolean, retry_after_seconds integer)`. If the visitor's current window has
expired (older than `p_window`), it starts a new one at a count of 1 and allows the request.
Otherwise it increments the existing window's count; if that count now exceeds `p_max_requests`,
it returns `false` with a `retry_after_seconds` counting down to when the window resets, and does
not count the rejected attempt again toward a future window. The function also opportunistically
deletes rows older than a fixed 30-day retention on every call, so the table never grows without
bound at this traffic. That retention is a constant, not derived from the current caller's
`p_window` — the prune has no `ip_hash` scoping, so it sweeps the whole table on every call, and
an earlier version of this function computed the cutoff from whichever `p_window` the *current*
caller happened to pass, which let one caller's shorter window delete a different `ip_hash`'s
still-live row under a longer window. The 30-day upper bound on `p_window` is what keeps the fixed
retention honest: without it, a caller could raise its window past 30 days and silently reintroduce
the same problem. It is `security definer` and `execute` is granted only to `service_role` — anon
cannot call it any more than it can read the table directly.

For the exact columns, constraints, indexes, and RLS policies, the migration files themselves are
the source of truth. [The platform design spec](./superpowers/specs/2026-07-30-end-to-end-platform-design.md),
section 5.2 ("Schema") and 5.3 ("Row Level Security"), records the rationale behind that shape.
