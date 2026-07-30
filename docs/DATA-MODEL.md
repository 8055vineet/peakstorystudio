# Data Model

This document describes the data Peak Story Studio actually holds today — the shapes defined
in `src/data/weddingData.js`, the browser storage layer in `src/App.jsx`, and the write path in
`src/components/ContentManagerModal.jsx`. There is no backend and no database: everything here
is a JavaScript module seeding React state, optionally overridden by `localStorage`. This is the
reference Phase 1's migration work reads before designing the real schema (see
[Target schema](#target-schema) below); it deliberately does not duplicate that schema.

## Content modules

`src/data/weddingData.js` has exactly four exports. Counts below were obtained by reading the
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

## Field-level problems

These are the shapes Phase 1 must correct. Each is a real value taken from
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
story galleries can go blank without any code change on this side. The same risk also applies
outside the content modules entirely: `src/components/FilmStrip.jsx:9-11` and
`src/components/HorizontalGallery.jsx:25,31` hardcode their own `images.unsplash.com` hotlinks
independent of `weddingData.js` (see `PS-015` in `docs/KNOWN-ISSUES.md`), so the real surface
Phase 1's migration needs to account for is larger than the content modules alone.

## Target schema

The tables, columns, and constraints Phase 1 should migrate this data to are specified in
[the platform design spec](./superpowers/specs/2026-07-30-end-to-end-platform-design.md), section
5.2 ("Schema"). That document is the source of truth for the target shape; this document only
describes what exists today so the two can be diffed.
