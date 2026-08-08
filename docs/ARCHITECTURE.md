# Architecture

This document describes how Peak Story Studio's frontend is put together today. It is the
reference other docs link back to; if you are new to this codebase, start here.

## Overview

Peak Story Studio is a Vite + React 18 single-page application styled with Tailwind CSS,
routed with **react-router-dom v6** since Phase 3b (`v0.4b`): each navbar option is its own
page at its own URL — `/`, `/gallery`, `/films`, `/stories`, `/about`, `/contact`, plus
`/more/:slug` since Phase 3e for the admin-created collection pages (`CollectionPage`, listed
in the navbar's **More** dropdown; the menu hides entirely while no page is published) —
sharing one header/footer frame (`src/components/Layout.jsx`), with an unknown URL rendering
`NotFoundPage`. Before 3b the entire site was one scrolling page navigated by anchor links;
documents and commits that describe it that way predate `v0.4b`. The visual design is the
owner's approved Phase 3b redesign: a centered Cormorant Garamond wordmark, quiet cream
surfaces, and the deep-maroon `pitch` accents.

Since Phase 3g (`v0.4g`) the public type roles (`font-garamond` headings, `font-sans` body, and — since Phase 3j —
the `font-script` Home quote) are CSS-variable-driven and set by `App` from the `site_settings` row, so the owner picks
the fonts from the admin's Settings → Typography section; the custom cursor was removed (the
native pointer is used everywhere); and the Home video block autoplays its YouTube embed
(muted — the only autoplay browsers permit) at full content width. Since Phase 3h (`v0.4h`)
that video is a **full-width, chromeless, looping ambient hero** (its wordmark/mountain/tagline
overlay was removed in Phase 3j); the Home quote font is admin-chosen (Quicksand by default); and the navbar
shows the admin-uploaded logo (`site_settings.logo_media_id`) as a circular badge before the
wordmark. Since Phase 3i (`v0.4i`) the cream **surface** tokens (`offwhite-*`) are
CSS-variable-driven too: `App` sets `--offwhite-50..400` from `settings.appearance.warmth` via
`surfaceRamp()` (`src/data/surfaceTint.js`), so an admin **Appearance** slider warms or cools
every surface from white to ivory (`0.5` = the shipped palette); and the Home route plays a
once-per-session `IntroSplash` — the logo fills the screen, then collapses into the navbar badge.

Since Phase 1b (`v0.2b`) the site reads its content from a Postgres database. Since Phase 3c
the site's singular content (Home quote, Brand Story, Home image slots, contact details,
social links) is database-driven too: `useSiteSettings` (the fifth `useContent` wrapper) reads
the one-row `site_settings` table, `src/App.jsx` passes slices down as props, and
`src/data/siteSettingsFallback.js` (built from the shipped constants) is what renders when the
database is unreachable — components keep those constants as prop defaults. As of Phase 3
Task 10 that database is unconditionally authoritative — the static `src/data/weddingData.js`
module remains only as an error fallback, not a configurable second source — see
[Data flow](#data-flow) below and `docs/DATA-MODEL.md`.

Since Phase 1a (`v0.2a`) there is a real test suite (Vitest + React Testing Library) and real
linting (ESLint); `npm run lint` genuinely lints, and `npm test` runs the suite.

Since Phase 3 (`v0.4`) a second, separate application exists for the studio's own use: a
sign-in-gated admin at `admin.html`, covering booking inquiries and content management (weddings,
their photographs, the standalone gallery, films, testimonials, and — since Phase 3e — the
"More" pages, the gallery's category vocabulary, and the contact form's bookable services). It
shares no bundle, no routing, and no component with the public site described above — see
[The admin app](#the-admin-app) below for its own render flow, auth model, and upload pipeline.
The admin has no React Router of its own — it is a separate Vite entry reached by filename
(`/admin.html`), unaffected by the public site's routes.

## Render flow

The mount chain is:

1. `index.html` — the Vite entry HTML. Its `<body>` contains a single `<div id="root">` and
   loads `<script type="module" src="/src/main.jsx">`.
2. `src/main.jsx` — calls `ReactDOM.createRoot(document.getElementById('root'))` and renders
   `<App />` wrapped in `<React.StrictMode>` → `<ErrorBoundary>` → `<BrowserRouter>`.
   `BrowserRouter` lives here rather than in `App` so tests can wrap `App` in `MemoryRouter`.
3. `src/App.jsx` — the default export, and the only stateful component of consequence in the
   tree. It renders the route table: a layout route (`Layout` — `ScrollToTop` + `Navbar` +
   `<main><Outlet /></main>` + `Footer`) containing one route per page
   (`src/pages/*.jsx`), plus the shared modals after the routes so they work from every page.

`App.jsx` is the single stateful shell: it owns every piece of cross-cutting state (session
and modal visibility) and passes data and callbacks down as props — pages receive their
content and handlers as props from `App`, never fetching in the page body. Every component it
renders is presentational with respect to that shared state; the only state children hold is
local UI state that never needs to escape the component (for example `Navbar`'s
`mobileMenuOpen`, or `AuthModal`'s form-field values).

## State ownership

`src/App.jsx` declares 5 `useState` hooks, listed below. As of Phase 3 Task 10, content itself
(`stories`, `photos`, `films`, `testimonials`) is no longer state `App.jsx` owns at all — it is
read directly from `useWeddings()`/`useGalleryPhotos()`/`useFilms()`/`useTestimonials()`
(`src/hooks/useContent.js`), each of which manages its own loading/error state internally and
always queries the database (see [Data flow](#data-flow) below). There is no more
`VITE_DATA_SOURCE`-driven fork, no `localStories`/`localPhotos`, and no
`peak_story_stories`/`peak_story_photos` `localStorage` keys — the old Content Manager modal
that wrote them was deleted in the same change.

| State | Holds | Persists to localStorage? | Consumed by |
| --- | --- | --- | --- |
| `user` | `null`, or an object such as `{ role, name, ... }` set by a successful login | Yes — key `peak_story_user` (the key is removed with `localStorage.removeItem` when the user logs out) | `Navbar` (renders the admin/client badge and sign-out control); `ClientGalleryModal` (gates its content on `user` being present); set via `handleLoginSuccess` from `AuthModal`, cleared via `handleLogout` |
| `lightboxState` | `{ isOpen, activeUrl, activeIndex, imagesList }` for the fullscreen image viewer | No | `LightboxModal`; opened via `handleOpenLightbox` from `HomePage`'s images grid, `PhotoGallery` (Gallery page), and `FeaturedStories` (Stories page) |
| `videoModalUrl` | A video embed URL, or `null` when no video modal is open | No | Renders the inline video-iframe modal defined directly in `App.jsx`; set via `onOpenVideo` (`HomePage`, `FeaturedStories`) and `onOpenVideoModal` (`FilmsGallery`) callbacks |
| `authModalOpen` | Boolean visibility flag for the sign-in modal | No | `AuthModal`; opened from `Navbar` |
| `clientGalleryOpen` | Boolean visibility flag for the private client proofing modal | No | `ClientGalleryModal`; opened from `Navbar`, and set to `true` automatically inside `handleLoginSuccess` when a client (as opposed to admin) logs in |

**Modal visibility is 4 independent booleans/booleans-in-disguise with no mutual exclusion:**
`lightboxState.isOpen`, `videoModalUrl` (truthy/falsy), `authModalOpen`, and
`clientGalleryOpen`. None of these are derived from, or reset by, any of the others, so nothing
stops two or more from being open at once. Stacking order when that happens is decided purely
by ad hoc z-index values sprinkled across the component files, not by any shared constant:
`LightboxModal`, the inline video modal in `App.jsx`, and `ClientGalleryModal` all use `z-50`;
`AuthModal` uses `z-[100]`. If two `z-50` modals were open together, the one mounted later in
the JSX tree would simply win. The modals are rendered after the route table, so all of them
work identically from every page.

## Routes and pages

`src/App.jsx` renders one layout route wrapping seven child routes. Each page in `src/pages/`
is a thin composition over the section components (see `docs/COMPONENTS.md` for the page
table): `HomePage` is the owner's approved design section-for-section; the other pages open
with the shared `PageHeader` and mount their section component. `ScrollToTop` (inside
`Layout`) scrolls to the top on every route change.

Two supporting conventions arrived with routing:

- **Owner-swappable image slots.** Home's hero, Brand Story portrait, and closing image are
  static page furniture, not database content. `src/data/homeContent.js` holds the quote, the
  Brand Story copy, and the three slot paths; the files live in `public/images/home/`
  (`hero.jpg`, `brand-story.jpg`, `closing.jpg`). **The owner changes an image by overwriting
  the file — no code edit.**
- **`public/_redirects`** (`/* /index.html 200`) ships now so the Phase 4 Cloudflare Pages
  deploy serves deep links like `/gallery` correctly; static assets take precedence over
  redirects on Pages, so `/admin.html` is unaffected. The Vite dev server already falls back
  to `index.html` for unknown paths.

## Styling approach

Styling is almost entirely Tailwind utility classes written inline on JSX elements — there are
no CSS Modules and no styled-components; component files are Tailwind class strings plus a
small amount of one-off inline `style={{ ... }}` for computed values (for example
`ScrollReveal`'s stagger delay and `Testimonials`' progress bar).

The Phase 3b type roles: **Cormorant Garamond** (`font-garamond`) for the wordmark and all
headings, **Great Vibes** (`font-script`) for the Home quote only, **Plus Jakarta Sans**
(`font-sans`) for body and UI text. The `cinzel` token remains in `tailwind.config.js` but no
public component uses it. The screenshot's deep-maroon accents are the existing `pitch-600`/
`pitch-700` tokens — the redesign added no new colors, and no component carries a raw hex
value.

`src/index.css` is the one non-Tailwind styling surface. On top of the three `@tailwind`
directives, it defines a custom layer with:

- A fixed, full-viewport paper-grain overlay on `body::before` (an inline SVG fractal-noise
  data URI) for the site's tactile fine-art look.
- Custom `::-webkit-scrollbar` styling (track, thumb, and hover colors).
- `@keyframes` for fade-in, three directional scroll-reveal variants, and the testimonial
  progress-fill bar, each paired with an `.animate-*` utility class.
- Small helper classes for progressive image blur-up loading, image hover-zoom, and glass/card
  panels.

For the full color, type, and animation token catalogue, see `docs/DESIGN-SYSTEM.md`.

## Data flow

As of Phase 3 Task 10, the database is unconditionally authoritative — there is no more
`VITE_DATA_SOURCE` switch and no `dataSource.js` resolver module (formerly under `src/lib`);
both were temporary migration
scaffolding, removed once the database no longer needed a fallback mode to switch away from.

**The layering:** components call hooks, hooks call queries, queries call Supabase. No component
imports the Supabase client; `src/lib/supabase.js` is the only module that constructs one. This
keeps components testable against mocked hooks and confines a future migration to a single
layer.

```
src/components/*   ->  src/hooks/useContent.js  ->  src/lib/queries/*  ->  src/lib/supabase.js
```

`useWeddings`/`useGalleryPhotos`/`useFilms`/`useTestimonials` (`src/hooks/useContent.js`) always
query the query layer, which reads from Postgres. `src/data/weddingData.js` plays two remaining
roles, both narrower than before Task 10: it is the seed source (`scripts/seed-db.mjs` copies it
into Postgres), and it is the *error fallback* each hook returns synchronously on first render
(before its query has resolved) and again from that query's `catch` if it fails outright — never
something a component reads directly, and never a second data source a flag can select. That is
resilience, not configuration: a stale site beats a blank one when the database is briefly
unreachable. Because of that, `weddingData.js` is still what a visitor sees during an outage,
which is exactly why Phase 7's truthful-content pass still has to clean it — see `PS-002` in
`docs/KNOWN-ISSUES.md`.

There is no longer any `localStorage`-backed content path at all. The old Content Manager modal
that wrote `peak_story_stories`/`peak_story_photos` on the pre-Task-10 static path was deleted in
the same change that removed the flag — see "Resolved" in `docs/KNOWN-ISSUES.md` (`PS-004`,
`PS-005`, `PS-022`, `PS-024`). Real content is now written through the separate admin app under
`src/admin/` (Phase 3 Tasks 1–9: sign-in, a leads dashboard, image upload via Supabase Storage,
and CRUD for weddings, gallery photos, films, and testimonials), straight into Postgres.

Row Level Security, not client code, is what makes it safe to ship the Supabase anon key in the
browser bundle: Postgres refuses anything the policies do not permit. See
`supabase/migrations/*_row_level_security.sql` and `npm run db:verify`.

## The inquiry write path

Since Phase 2 (`v0.3`), `BookingForm` is a real write path, not a form that only ever reads. Even
before Task 10 removed `VITE_DATA_SOURCE` entirely, `BookingForm` ran independently of it — a
submission always reached the database, regardless of which source the rest of the page read
from — because the booking form was never one of the content collections that flag switched
between; it always writes.

A submission travels:

```
BookingForm (browser)
  -> useInquirySubmission -> src/lib/queries/inquiries.js -> supabase.functions.invoke(...)
  -> Edge Function: supabase/functions/submit-inquiry
  -> Postgres: insert into public.inquiries
  -> Resend (email), best-effort, after the insert
```

**The Edge Function is the only door.** `anon` *does* hold an `insert` grant on
`public.inquiries` — what stops it is Row Level Security: the table has RLS enabled and no
`insert` policy, so a direct `POST /rest/v1/inquiries` with the anon key is refused with
`42501 new row violates row-level security policy`. Be precise about which layer is doing the
work here, because the two tables this phase touches are defended differently: `inquiries`
relies on RLS with the grant present, while `inquiry_rate_limits` withholds the grant from
`anon` entirely. Anyone adding a narrow `insert` policy to `inquiries` should know there is no
grant-level backstop underneath it. `submit-inquiry` holds the service-role key, which bypasses
RLS, and is consequently the single place that inserts. Client-side validation
(`BookingForm` calling the same `validateInquiry` the function calls) exists to give a couple
immediate, specific feedback; it is not itself a control, because nothing stops a request from
skipping the browser entirely. Every rule is re-checked inside the function against whatever
arrived on the wire, and the function also runs the checks a browser cannot be trusted to run at
all: a body-size cap, a honeypot field, an origin-blind rate limit keyed on a hashed IP, and
Cloudflare Turnstile verification of the submission's captcha token.

Email is separate from the write. `sendInquiryEmails` (`supabase/functions/_shared/email.js`)
runs only after the insert has already succeeded, and its outcome — `sent`, `failed`, or
`skipped` (no `RESEND_API_KEY` configured, the default in local development) — is recorded on the
row's `notification_status` column rather than surfaced as the request's own success or failure.
A couple who submits a valid inquiry always sees success once the row is saved; an outage at
Resend costs the studio a notification, not a couple's booking.

**The `@shared` alias.** `vite.config.js` and `supabase/functions/submit-inquiry/index.js` both
need the same validation rules — what counts as a valid name, email, phone, wedding date, venue,
and service list — because the client-side check and the server-side check must never quietly
disagree about what a valid inquiry looks like. Rather than maintain that logic twice, both sides
import the single module `supabase/functions/_shared/inquiry-validation.js`: the Edge Function
directly (Supabase's own convention for code a function depends on lives under `_shared/`), and
the browser bundle via the `@shared` alias `vite.config.js` points at that same directory. One
file, one set of rules, so the two layers cannot drift apart.

## The admin app

Since Phase 3 (`v0.4`) a second, separate application exists for managing content and booking
inquiries: `admin.html`, a second Vite entry point with its own `src/admin/` component tree.
Since Phase 3c (`v0.4c`) it is a complete CMS: eight tabs — **Dashboard** (the landing screen:
new-lead count with a callout, published/draft counts per content type, each card a shortcut),
Leads, Media Library (whose cards offer **Add to Gallery**, jumping straight into a pre-filled
Add Gallery Photo form), Weddings, Gallery, Films, Testimonials, and **Settings** (the site's
singular content: quote, Brand Story, the three Home images, contact details, social links —
backed by the one-row `site_settings` table). Since Phase 3e (`v0.4e`) it is also
extensible: a **Pages** tab creates the public More pages (title + description through the
resource form; photographs attach in batches and videos by embed URL through
`CollectionItems`), the Gallery tab carries a **Manage categories** panel (add/rename/reorder/
delete the photo vocabulary — rename is atomic via the `rename_gallery_category` RPC, the
photo form's Category select tracks the list), and Settings carries a **Booking services**
panel (the contact form's offerings; historical inquiries keep their wording). All three list
managers are one shared `ManagedList` component. Every create lands as a draft and announces
itself with a publish-now banner; the header carries a **View website** link. Since Phase 3d
(`v0.4d`), choosing a photograph anywhere in the admin goes through `MediaSlot` (a compact
thumbnail control) opening `MediaPickerDialog` (a full-screen, searchable picker with upload
built in) rather than an inline grid of the whole library; the Gallery/Weddings/Films lists
render a leading photo column from a server-side-joined `thumbnailPath`; every navigation
scrolls back to the top; and the open tab is kept in the URL hash (`admin.html#gallery`), so a
refresh restores it. Since Phase 3f (`v0.4f`), `UploadField` accepts **many images or a whole
folder** and runs the existing one-file-at-a-time pipeline as a resilient queue (per-file
progress, Stop, and a failure summary with Retry-failed that never aborts the run); single-photo
slots (`MediaSlot`) stay single-file, while the Media Library and the attach dialogs go bulk. The
Gallery tab's **Bulk add to Gallery** panel turns a folder + a chosen category into draft
gallery photos (titled from each file name) with a **Publish all** step. It is mounted the same
way the public site is —

```
admin.html -> src/admin/main.jsx -> ReactDOM.createRoot(...).render(<ErrorBoundary><App/></ErrorBoundary>)
```

— reusing the same `ErrorBoundary` and the same `src/index.css`, but never `src/App.jsx` or
anything under `src/components/`. `vite.config.js`'s `build.rollupOptions.input` names both
`index.html` and `admin.html` as separate build inputs, so Vite/Rollup code-splits each entry's
own imports into its own bundle. Task 2 confirmed this holds in the actual built output, not just
in configuration: every admin-only string is confined to a 6.6 kB `admin-*.js` chunk, and the
public entry's chunk carries none of it. **A visitor to the marketing site never downloads the
dashboard.** `admin.html` also carries `<meta name="robots" content="noindex">` — an admin
login page has no reason to appear in search results, and every reason not to advertise its own
existence to a crawler.

### Why a second entry point, not a route

A leads table with filtering and a detail view does not fit inside a modal — the deleted
`ContentManagerModal` (see "Resolved" in `docs/KNOWN-ISSUES.md`) is the cautionary example of
trying to force a content-management surface into one. The alternative, adding a client-side
router to the public site so `/admin` could be a route within the same app, was rejected for a
different reason: this site has no router today (see "Known architectural limits" below), and
introducing one just to host the admin would have pulled Phase 5's scheduled routing work
(`PS-008`) forward into Phase 3, entangling two unrelated deliverables. A second Vite entry costs
one config block and keeps the two concerns — and the two bundles — completely separate. Vite
serves it at `/admin.html` in local development; Phase 4 adds a `/admin` redirect at the hosting
layer, which is also what will finally give `Navbar`'s (currently inert) admin badge somewhere to
link to — see `PS-030` in `docs/KNOWN-ISSUES.md`.

### Authentication, and where the actual boundary is

The admin app gates its own dashboard behind Supabase Auth: `src/hooks/useSession.js` resolves to
one of four statuses — `loading`, `anonymous` (renders `SignInForm`), `authenticated` (a real
session whose `profiles.role` is `'admin'`; renders the dashboard), or `forbidden` (a real
session that is *not* an admin; renders a refusal screen with a sign-out button, rather than the
sign-in form again — telling someone already signed in to sign in is a dead end). `src/lib/auth.js`
is the only module under `src/lib/` this hook calls, and it is a sibling of `src/lib/queries/`
under the same existing rule: **components never import the Supabase client directly.**
`admin/App.jsx` -> `useSession` -> `src/lib/auth.js` -> `src/lib/supabase.js`, same layering the
public site's hooks and query modules already follow.

**This client-side gate decides only what the signed-in browser is shown. It is not what protects
anything, and must never be described or relied on as though it were.** Row Level Security —
the ten `is_admin()` policies from Phase 1b (`supabase/migrations/*_row_level_security.sql`) — is
the actual boundary, exactly as it already is for the public site's anon key (see
[Data flow](#data-flow) above). Task 1 verified this independently against the running database,
not just by reading the policies: a signed-in `client`-role user got `[]` reading `inquiries`
where an admin got the real row; every write to `weddings`, `testimonials`, `media`,
`gallery_photos`, `films`, and `inquiries` was refused (`42501` on insert, a no-op on update or
delete); and role escalation was blocked (`PATCH profiles role=admin` returned `[]`, and
`rpc/is_admin` stayed `false`). A signed-in non-admin who defeats the `useSession` check entirely
— for instance by editing the client bundle — still sees an empty dashboard and still cannot write
anything, because Postgres refuses it regardless of what any component renders. Do not "simplify"
this gate later on the theory that RLS makes it redundant: it is redundant by design, and that is
the entire point — the gate is a UX courtesy, RLS is the control.

Public signup is disabled (`supabase/config.toml`'s `[auth] enable_signup = false`), so the only
accounts that exist are ones created deliberately. Authentication is email and password, not a
magic link — password sign-in needs no email delivery configured, which keeps local development
and CI self-contained. `scripts/seed-admin.mjs` creates (or repairs) the local admin idempotently
against `ADMIN_EMAIL`/`ADMIN_PASSWORD`, using the service-role key to write directly to
`auth.users` and `public.profiles` — there is no signed-in session for RLS to check yet at that
point, which is exactly why this script, uniquely, needs that key. It is safe to run after
`npm run db:reset` wipes the database, and safe to run again with the same email, which is what
makes the local admin survive a schema replay instead of leaving the next person locked out.

### The upload flow

An admin adding a photograph triggers a four-stage pipeline, driven by `src/hooks/useMediaUpload.js`
and shown stage-by-stage so a failure is always attributable to a specific step
(`error.stage` ∈ `resizing | signing | uploading | recording`):

1. **Resize, in the browser** (`src/lib/images.js`) — the file is re-encoded to WebP with its
   longest edge capped at 2000px before anything leaves the machine, and the resulting width and
   height are recorded (an already-small image is never upscaled). This is a bandwidth and quota
   measure, not a security control.
2. **Sign** — the browser calls the `sign-upload` Edge Function
   (`supabase/functions/sign-upload/index.js`) with the resized file's content type and byte size.
   The function is the actual authorization point: it asks Supabase Auth who the caller's token
   really belongs to (`getUser`, never trusting a role claim the token merely carries), then looks
   up that user's `profiles.role` directly with the service-role key, bypassing RLS — the one
   place in this codebase besides `seed-admin.mjs` that key is used. A non-admin or unauthenticated
   caller is refused before anything about the file is even considered. Only then does it check the
   content type against an allowlist (`image/jpeg`, `image/png`, `image/webp`) and the size against
   a ceiling, generate a storage key server-side (a fixed `uploads/` prefix plus a fresh UUID —
   **never** the client-supplied file name, so a caller cannot choose where a file lands or
   overwrite another object), and return a presigned `PUT` URL that expires in five minutes.
3. **`PUT`, straight from the browser to storage** — the presigned URL is used directly; the file's
   bytes never pass through the Edge Function or any server this project runs. `sign-upload` never
   sees them.
4. **Record** — the browser inserts a `media` row (`storage_path`, `width`, `height`, `alt_text`),
   which RLS permits only for an admin. This is the one stage that can fail *after* the object is
   already sitting in storage; see `PS-029` in `docs/KNOWN-ISSUES.md` for the orphaned-object
   consequence, which is accepted debt, not an oversight.

No optimistic UI: `useMediaUpload`'s status only reaches `'done'` once the `media` row insert is
confirmed. A failure at any stage — including the fourth — surfaces as `'error'`, never a false
`'done'`.

**What a real upload does not yet do:** it does not make the photograph visible on the public
site — but the reason changed as of Task 12b, and it is narrower than it used to be. The public
read path (`src/lib/queries/weddings.js`/`gallery.js`/`films.js`) now resolves every
`media.storage_path` through the shared `publicMediaUrl()` helper (`src/lib/mediaUrl.js`,
promoted there from the admin-only module the admin's own previews used): it joins a real
upload's bucket-relative key (e.g. `uploads/<uuid>.webp`) against `VITE_MEDIA_BASE_URL` and
passes a seeded row's already-absolute URL through unchanged. What remains is that the storage
bucket itself is still **private**, with no public read path, and no environment has
`VITE_MEDIA_BASE_URL` pointed at a real public host yet — so a genuine upload still resolves to
`''` (no `<img>` shown, but see the caveat on that below) until Phase 4 makes the bucket publicly
readable and sets that variable. Only pre-existing seeded media renders today, because
`scripts/seed-db.mjs` writes each seeded row's original full URL directly into `storage_path`
rather than a bucket key. Public read access is deliberately Phase 4 scope (a Cloudflare custom
domain in front of R2) — see `PS-033` in `docs/KNOWN-ISSUES.md` for the full explanation. This is
the single most important nuance for whoever wires that up: the pipeline above, the database
schema, and the admin UI are already real and are tested end to end (`npm run verify:admin`,
which signs in, uploads, publishes a wedding, and asserts the public query layer's `coverImage`
and `fullGallery` resolve `storage_path` all the way to a real URL against a `VITE_MEDIA_BASE_URL`
CI sets for exactly this purpose — not merely that the raw key round-trips unresolved, which is
what this gate asserted before Task 13 caught it silently passing vacuously against an unset
variable); only the last mile — making the bucket itself servable to an anonymous visitor —
remains.

### One S3 code path, local storage and Cloudflare R2 alike

`supabase/functions/_shared/s3-presign.js` (`presignPut`, built on `aws4fetch`) is the only code
that ever signs a storage request, and it is written to speak plain S3 — nothing Supabase- or
R2-specific. The local Supabase stack already exposes an S3-compatible endpoint
(`STORAGE_S3_URL`) with its own access key, secret, and region; Cloudflare R2 is S3-compatible
too. Pointing the same function at one or the other is a matter of which endpoint, region, and
credentials its Edge Function secrets name (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` — see `supabase/functions/.env.example`), never a code
change. This is deliberate, not incidental: R2 has no local equivalent, and a separate storage
implementation for development versus production is exactly the arrangement in which a bug hides
until deployment — the local end-to-end gate (`npm run verify:admin`) would prove nothing about
whether the code path production actually uses works at all. One code path, exercised locally by
that gate today and by R2 for real once Phase 4 configures it, closes that gap entirely.

## Known architectural limits

- **Pages, but not per-wedding pages.** Phase 3b gave every navbar option its own URL, but an
  individual wedding story still opens in `StoryDetailModal` rather than at a shareable,
  indexable address of its own. Per-wedding URLs, prerendering, sitemap, and OG images are
  Phase 5 scope (`PS-008`).
- **One top-level error boundary, not per-page.** `src/components/ErrorBoundary.jsx` (added
  in Phase 1a, `v0.2a`) implements `getDerivedStateFromError` and `componentDidCatch`, and
  wraps the entire tree in `src/main.jsx` (outside `BrowserRouter`), so an unhandled render
  error shows a recovery screen instead of unmounting to a blank page. But it is a single
  boundary around all of `<App />`, not one per page or section, so a render error anywhere
  still replaces the whole page with the recovery screen.

See `docs/KNOWN-ISSUES.md` for the fuller catalogue of known issues beyond architecture.
