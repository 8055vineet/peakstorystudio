# Architecture

This document describes how Peak Story Studio's frontend is put together today. It is the
reference other docs link back to; if you are new to this codebase, start here.

## Overview

Peak Story Studio is a Vite + React 18 single-page application styled with Tailwind CSS.
There is no router. The entire site is one page: a single component tree that renders a fixed
navbar followed by a tall stack of full-width sections, each mounted permanently in the DOM
(nothing is route-based or lazily mounted). "Navigation" is anchor-link scrolling within that
one page.

Since Phase 1b (`v0.2b`) the site reads its content from a Postgres database. As of Phase 3
Task 10 that database is unconditionally authoritative — the static `src/data/weddingData.js`
module remains only as an error fallback, not a configurable second source — see
[Data flow](#data-flow) below and `docs/DATA-MODEL.md`.

Since Phase 1a (`v0.2a`) there is a real test suite (Vitest + React Testing Library) and real
linting (ESLint); `npm run lint` genuinely lints, and `npm test` runs the suite.

## Render flow

The mount chain is:

1. `index.html` — the Vite entry HTML. Its `<body>` contains a single `<div id="root">` and
   loads `<script type="module" src="/src/main.jsx">`.
2. `src/main.jsx` — calls `ReactDOM.createRoot(document.getElementById('root'))` and renders
   `<App />` wrapped in `<React.StrictMode>`.
3. `src/App.jsx` — the default export, and the only stateful component of consequence in the
   tree.

`App.jsx` is the single stateful shell: it owns every piece of cross-cutting state (content,
session, and modal visibility) and passes data and callbacks down as props. Every component it
renders — `Hero`, `FeaturedStories`, `FilmsGallery`, `PhotoGallery`, the modals, etc. — is
presentational with respect to that shared state; the only state those children hold is local
UI state that never needs to escape the component (for example `Navbar`'s own `scrolled` and
`mobileMenuOpen`, or `AuthModal`'s form-field values).

## State ownership

`src/App.jsx` declares 6 `useState` hooks (running `grep -c "useState" src/App.jsx` reports
7 lines, but one of those is the `import { useState, ... } from 'react'` line itself — there
are 6 actual state declarations, listed below). As of Phase 3 Task 10, content itself
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
| `lightboxState` | `{ isOpen, activeUrl, activeIndex, imagesList }` for the fullscreen image viewer | No | `LightboxModal`; opened via `handleOpenLightbox` from `FeaturedStories` and `PhotoGallery` |
| `videoModalUrl` | A video embed URL, or `null` when no video modal is open | No | Renders the inline video-iframe modal defined directly in `App.jsx`; set via the `onOpenFilmModal` (`Hero`), `onOpenVideo` (`FeaturedStories`), and `onOpenVideoModal` (`FilmsGallery`) callbacks |
| `authModalOpen` | Boolean visibility flag for the sign-in modal | No | `AuthModal`; opened from `Navbar` |
| `clientGalleryOpen` | Boolean visibility flag for the private client proofing modal | No | `ClientGalleryModal`; opened from `Navbar`, and set to `true` automatically inside `handleLoginSuccess` when a client (as opposed to admin) logs in |
| `splashDone` | Boolean; `false` until the intro splash animation finishes | No | Gates whether `SplashScreen` renders at all (`{!splashDone && <SplashScreen ... />}`); flipped to `true` by `SplashScreen`'s own `onComplete` callback |

**Modal visibility is 5 independent booleans/booleans-in-disguise with no mutual exclusion:**
`splashDone` (inverted — the splash overlay shows while it's `false`), `lightboxState.isOpen`,
`videoModalUrl` (truthy/falsy), `authModalOpen`, and `clientGalleryOpen`. None of these are
derived from, or reset by, any of the
others, so nothing stops two or more from being open at once — e.g. a user can open the
lightbox and then the client gallery without the first ever closing. Stacking order when that
happens is decided purely by ad hoc z-index values sprinkled across the component files, not by
any shared constant: `LightboxModal`, the inline video modal in `App.jsx`, and
`ClientGalleryModal` all use `z-50`; `AuthModal` uses `z-[100]`; `SplashScreen` uses `z-[999]`,
higher than everything else. If two `z-50` modals were open together, the one mounted later in
the JSX tree would simply win.

## Section order

Inside `<main>` in `src/App.jsx`, sections render in this fixed order, with `SectionDivider`
inserted between several of them:

1. `Hero`
2. `FeaturedStories`
3. `SectionDivider` (`color="#faf9f6"`, `bgColor="#ffffff"`)
4. `FilmsGallery`
5. `ColorGradingSlider`
6. `SectionDivider` (`color="#ffffff"`, `bgColor="#faf9f6"`)
7. `HorizontalGallery`
8. `SectionDivider` (`color="#faf9f6"`, `bgColor="#ffffff"`)
9. `PhotoGallery`
10. `FilmStrip`
11. `AboutSection`
12. `SectionDivider` (`color="#ffffff"`, `bgColor="#faf9f6"`)
13. `Testimonials`
14. `SectionDivider` (`color="#faf9f6"`, `bgColor="#ffffff"`)
15. `BookingForm`

`Footer` renders after `</main>`, outside the section stack. Every `SectionDivider` color prop
is a raw hex string (`#faf9f6` or `#ffffff`) passed inline rather than a Tailwind class or
shared constant. Both values exactly duplicate colors already defined as Tailwind tokens in
`tailwind.config.js` (`offwhite.100` is `#faf9f6`, `offwhite.50` is `#ffffff`), so the same
color exists as both a token and a hardcoded literal with no single source of truth between
them.

## Styling approach

Styling is almost entirely Tailwind utility classes written inline on JSX elements — there are
no CSS Modules and no styled-components; component files are Tailwind class strings plus a
small amount of one-off inline `style={{ ... }}` for computed values (for example the
scroll-driven parallax transform in `src/components/Hero.jsx` and the width-driven progress
bar in `src/components/ScrollProgressBar.jsx`).

`src/index.css` is the one non-Tailwind styling surface. On top of the three `@tailwind`
directives, it defines a custom layer with:

- A fixed, full-viewport paper-grain overlay on `body::before` (an inline SVG fractal-noise
  data URI) for the site's tactile fine-art look.
- Custom `::-webkit-scrollbar` styling (track, thumb, and hover colors).
- Global cursor suppression on desktop (`cursor: none !important` above `1024px`) to make way
  for `CustomCursor`.
- `@keyframes` for the marquee film strip, fade-in, three directional scroll-reveal variants,
  the splash logo pulse and fade-out, and the testimonial progress-fill bar, each paired with
  an `.animate-*` utility class.
- Small helper classes for progressive image blur-up loading, image hover-zoom, the horizontal
  scroll-snap gallery, and SVG section-wave dividers.

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

## Known architectural limits

- **No routing.** There is no router of any kind (no `react-router` or equivalent dependency),
  so the entire site is one URL. Individual sections, galleries, and stories have no shareable
  or indexable address of their own — everything lives behind anchor-link scrolling on `/`.
- **One top-level error boundary, not per-section.** `src/components/ErrorBoundary.jsx` (added
  in Phase 1a, `v0.2a`) implements `getDerivedStateFromError` and `componentDidCatch`, and wraps
  the entire tree at `src/main.jsx:9`, so an unhandled render error shows a recovery screen
  instead of unmounting to a blank page. But it is a single boundary around all of `<App />`,
  not one per section, so a render error in any one section still replaces the whole page with
  the recovery screen rather than degrading just that section.
- **Three independent scroll listeners**, each attaching its own `window.addEventListener('scroll', ...)`
  with no shared coordination: `src/components/Navbar.jsx` (toggles its background/shadow past
  a 40px scroll threshold), `src/components/ScrollProgressBar.jsx` (computes the reading-progress
  fill width), and `src/components/Hero.jsx` (drives the hero's parallax transform). Of the
  three, only `Hero`'s listener is registered as passive (`{ passive: true }`); the other two
  are not, so the browser cannot assume they won't call `preventDefault()` on the scroll event.

See `docs/KNOWN-ISSUES.md` for the fuller catalogue of known issues beyond architecture.
