# Admin Extensibility (Phase 3e, `v0.4e`) — Design

**Date:** 2026-08-07
**Status:** Approved by owner (layout choice "photo grid + playable videos" and the overall design chosen explicitly)
**Branch:** `phase-3e/admin-extensibility`

## 1. Context

Three things a growing studio will keep adding are hard-coded today:

1. **Site sections.** The navbar's six pages are fixed. The owner wants a **More** menu whose
   entries — "Travels", and whatever comes later — are pages the admin creates, each holding
   photographs and/or videos, laid out like the Gallery page.
2. **Gallery categories.** `gallery_photos.category` is free text in Postgres, but the admin
   form offers a fixed four-item select (`CATEGORY_OPTIONS` in `src/admin/resources/gallery.js`)
   and the public section order is a hard-coded array (`SECTION_ORDER` in
   `src/components/PhotoGallery.jsx`). The owner wants to add categories.
3. **Booking services.** The contact form's service checkboxes come from the `SERVICES`
   constant in `supabase/functions/_shared/inquiry-validation.js`, which the Edge Function also
   enforces as a hard allowlist. The owner wants to add services later.

Standing constraints all still apply: plain JS, Tailwind tokens, components-call-hooks layering,
schema changes only in `supabase/migrations/`, migrations applied incrementally
(`supabase migration up` — never `db:reset`, the database holds real inquiries), content
sections tolerate empty lists, no fabricated content.

## 2. Data model (one migration)

`supabase/migrations/<timestamp>_admin_extensibility.sql` creates four things, following the
grant/RLS patterns of `20260730203451_initial_schema.sql` and
`20260730204126_row_level_security.sql`:

- **`collections`** — the admin-created pages. `id uuid pk default gen_random_uuid()`,
  `slug text unique not null`, `title text not null`, `description text` (nullable),
  `sort_order int not null default 0`, `status text not null default 'draft'`
  (check `in ('draft','published')`), `created_at timestamptz not null default now()`.
- **`collection_items`** — a page's content. `id uuid pk`, `collection_id uuid not null
  references collections(id) on delete cascade`, `media_id uuid references media(id)`
  (nullable), `video_embed_url text` (nullable), `caption text` (nullable),
  `sort_order int not null default 0`, `created_at timestamptz`, plus
  `check (media_id is not null or video_embed_url is not null)`. An item is a **photograph**
  (media only), a **video** (embed URL, with `media_id` as its optional poster), never neither.
- **`gallery_categories`** — `id uuid pk`, `name text unique not null`,
  `sort_order int not null default 0`. Seeded with the current four in their current order:
  Pre-Wedding, Wedding, Engagement, Haldi & Mehendi.
- **`booking_services`** — same shape as `gallery_categories`. Seeded with the current four:
  Cinematic Film, Fine Art Photography, Drone Aerials, Pre-Wedding Shoot.

**RLS.** `collections`: anon reads `status = 'published'`, admins read and write everything —
same split as `weddings`. `collection_items`: anon reads items whose parent collection is
published (`exists` subquery), admins everything. `gallery_categories` and `booking_services`:
`select using (true)` (the public site renders from both), write only via `public.is_admin()`.
No delete policy is granted anywhere it isn't needed.

**Rename RPC.** `public.rename_gallery_category(p_old text, p_new text)` — `security definer`,
refuses unless `public.is_admin()`, then in one transaction updates
`gallery_categories.name` and every `gallery_photos.category = p_old` row to `p_new`.
A rename can never leave photos pointing at a name that no longer exists. Unique-name
collisions surface as the Postgres error. `grant execute to authenticated` only.

Category **delete** has no RPC: the admin layer refuses when any photo still uses the name
(it counts first and reports the count); the public site would tolerate a stranded name anyway
(unknown categories append after known ones — existing behaviour, kept).

## 3. Public site

**Read path** (`src/lib/queries/` + `src/hooks/useContent.js` wrappers, all with
stale-beats-blank fallbacks):

- `collections.js` → `getCollections()`: published collections ordered by `sort_order`, each
  with its items embedded and ordered (`collection_items` nested select, foreign-table order).
  Item shape: `{ id, url (publicMediaUrl of media, '' when none), videoEmbedUrl, caption }`.
  Hook `useCollections()`, fallback `[]` — during an outage the More menu simply hides.
- `getGalleryCategories()` (added to `gallery.js`): ordered category names. Hook fallback: the
  current four (a new pure-data constant in `src/data/`, replacing PhotoGallery's private
  `SECTION_ORDER`).
- `bookingServices.js` → `getBookingServices()`: ordered service names. Hook fallback: the
  existing `SERVICES` constant from the shared validation file (pure, so importable).

**Navbar** gains a `morePages = []` prop (`{ title, slug }` list, threaded
App → Layout → Navbar). Non-empty: a **More** item renders after Contact — a button
(`aria-expanded`, highlighted whenever the route starts with `/more/`) toggling a small
dropdown of `NavLink`s; closes on selection, outside click, and Escape. In the mobile drawer
the pages render as a "More" labelled group of plain links. Empty list: no More item at all.

**Route** `more/:slug` joins the route table, rendering the new **`CollectionPage`**
(`src/pages/CollectionPage.jsx`): finds its collection by slug from the `collections` prop;
while `useCollections` is still `loading` and the slug is unknown it renders nothing (no
NotFound flash on a direct link); once settled, an unknown slug renders the NotFound content.
Layout per the owner's choice: `PageHeader` (title), the description paragraph when present,
then the Gallery-style two-up sharp-cornered grid — photo items open the existing lightbox
(over the collection's photo URLs), video items render their poster (or a quiet placeholder
block) with a play overlay and open the existing video modal via `onOpenVideo`.

**PhotoGallery** gains `categoryOrder` (default: the extracted constant) and orders sections
by it — unknown names still append. **BookingForm** gains `services` (default: shared
`SERVICES`) and renders its checkboxes from it. `GalleryPage`/`ContactPage` thread the new
props from App's hooks.

**Validator change** (`supabase/functions/_shared/inquiry-validation.js`, used by browser and
Edge Function alike): the services allowlist check is replaced by shape rules — must be an
array of at most 12 entries; each entry text-cleaned, non-empty, at most 80 characters;
duplicates dropped, submitted order kept. Error copy unchanged. `SERVICES` stays exported as
the fallback list. Stored inquiries are historical records: renaming or removing a service
never rewrites them.

## 4. Admin

- **Pages tab** (`DASHBOARD_TABS` key `pages`, hash-persisted like every tab): a
  `collectionsResource` config (title required; description optional textarea) through the
  existing ResourceList/ResourceForm — list shows title, slug, status, with the usual
  publish toggle, reorder, delete (confirm names the cascade: the page's items go with it,
  photographs stay in the library). `create()` derives the slug: `slugify(title)`, and on a
  unique-violation retries once with a short random suffix — clean URLs normally, no
  collision ever. Editing an existing page also renders **`CollectionItems`**
  (`src/admin/CollectionItems.jsx`, the WeddingPhotos pattern): the item grid (photo thumbnail
  or poster with a ▶ badge; caption beneath when set) with ↑/↓/Remove, an **Add photographs**
  button opening `MediaPickerDialog` in stay-open multi-attach mode (`selectedIds` = already
  attached photo items), and an **Add video** button revealing an inline mini-form — embed URL
  (required, must start with `http(s)://`, same warning copy as films about embed-vs-watch
  URLs), optional poster (a `MediaSlot`), optional caption. Queries in
  `src/lib/queries/adminCollectionItems.js` (list/addPhoto/addVideo/remove/reorder), hand-written
  like `adminWeddingPhotos.js` (composite content, no status column).
- **`ManagedList`** (`src/admin/ManagedList.jsx`, new, presentational): the one
  list-manager UI used for both categories and services — rows with inline rename
  (Edit → input → Save/Cancel), ↑/↓ reorder, Delete (confirm), and an add-new input+button at
  the bottom; loading/error/empty states per the admin's existing conventions; all mutations
  are callback props.
- **Gallery tab** grows a "Manage categories" section above the list, backed by
  `src/lib/queries/adminGalleryCategories.js` (list/add/rename-via-RPC/reorder/remove;
  remove first counts `gallery_photos` rows using the name and refuses with the count).
  The photo form's Category select goes dynamic: `GalleryDashboard` owns the categories
  resource and memo-builds the form config's `options` from it — `ResourceForm` unchanged.
- **Settings tab** grows a "Booking services" section (same `ManagedList`) after the settings
  form, backed by `src/lib/queries/adminBookingServices.js` (plain CRUD + reorder; rename is
  a simple update — historical inquiries deliberately untouched).
- **Dashboard tab**: `getOverviewCounts()` adds the collections published/draft pair and the
  landing screen adds a Pages card.

## 5. Error handling

Every new query module throws prefixed errors like its siblings. Admin mutations surface
through the existing `written`-aware error copy. The public site's three new reads sit behind
`useContent` fallbacks: More hides, categories fall back to the four, services fall back to
the constant. `CollectionPage` distinguishes loading / found / not-found. A video item with no
poster renders the placeholder block, never a broken image.

## 6. Testing and verification

- Unit: new query modules (mapping, errors, the slug-retry, the remove-refusal count);
  validator's new services shape rules; `ManagedList`; `CollectionItems` (add photo via
  dialog stays open, add video validates URL, remove confirms, reorder); `Navbar` dropdown
  (renders only when pages exist, opens/closes, mobile group); `CollectionPage`
  (loading vs not-found vs grid, photo→lightbox, video→modal); `PhotoGallery` order-prop;
  `BookingForm` services-prop; admin `App.test.jsx` Pages-tab wiring + overview card;
  `App.routes.test.jsx` More menu + `/more/:slug`.
- **`verify:admin` gains three legs** (each with crash-safe cleanup, like the settings leg):
  a collection round-trip (create draft + photo item + video item → publish → anon sees it
  with both items → delete, cascade verified); a category round-trip (add probe → rename via
  RPC → anon list shows the new name → delete); a services round-trip (add probe → anon list
  shows it → delete).
- Docs: DATA-MODEL.md (three tables + RPC), ARCHITECTURE.md (routes + admin tabs),
  COMPONENTS.md (Navbar/Layout/PhotoGallery/BookingForm prop rows; CollectionPage page row),
  ROADMAP.md (`v0.4e` row + paragraph). `npm run check:docs` enforces.

## 7. Out of scope (deliberate)

- Footer's three service marks stay fixed (brand statements, not the bookable list).
- The six built-in pages' titles/headers stay fixed.
- No per-item pages, no story-style cards for collections (owner chose the flat grid).
- No category merge tooling; delete is refuse-while-used.
- Films/testimonials/weddings resource configs untouched.

## 8. Phase mechanics

Branch `phase-3e/admin-extensibility`; Conventional Commits; migration applied with
`supabase migration up`; full gates (`npm test`, `npm run lint`, `npm run check:docs`,
`npm run build`, `verify:inquiry`, `verify:admin`) before merge; merge to `main` locally and
tag `v0.4e`.
