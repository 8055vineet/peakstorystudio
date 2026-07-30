# Architecture

This document describes how Peak Story Studio's frontend is put together today. It is the
reference other docs link back to; if you are new to this codebase, start here.

## Overview

Peak Story Studio is a Vite + React 18 single-page application styled with Tailwind CSS.
There is no router, no backend, and no automated test suite — `package.json` declares
`playwright` as a dev dependency, but no test files or Playwright config exist in the repo.
The entire site is one page: a single component tree that renders a fixed navbar followed by
a tall stack of full-width sections, each mounted permanently in the DOM (nothing is
route-based or lazily mounted). "Navigation" is anchor-link scrolling within that one page.

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

`src/App.jsx` declares 9 `useState` hooks (running `grep -c "useState" src/App.jsx` reports
10 lines, but one of those is the `import { useState, ... } from 'react'` line itself — there
are 9 actual state declarations, listed below):

| State | Holds | Persists to localStorage? | Consumed by |
| --- | --- | --- | --- |
| `stories` | Array of story objects, seeded from `INITIAL_STORIES` in `src/data/weddingData.js` | Yes — key `peak_story_stories` | `FeaturedStories` (read); `ContentManagerModal` appends new entries via `handleAddStory` |
| `photos` | Array of photo objects, seeded from `INITIAL_PHOTOS` in `src/data/weddingData.js` | Yes — key `peak_story_photos` | `PhotoGallery` and `ClientGalleryModal` (read); default `imagesList` for the lightbox when none is supplied; `ContentManagerModal` appends new entries via `handleAddPhoto` |
| `user` | `null`, or an object such as `{ role, name, ... }` set by a successful login | Yes — key `peak_story_user` (the key is removed with `localStorage.removeItem` when the user logs out) | `Navbar` (renders the admin/client badge and sign-out control); `ClientGalleryModal` (gates its content on `user` being present); set via `handleLoginSuccess` from `AuthModal`, cleared via `handleLogout` |
| `lightboxState` | `{ isOpen, activeUrl, activeIndex, imagesList }` for the fullscreen image viewer | No | `LightboxModal`; opened via `handleOpenLightbox` from `FeaturedStories` and `PhotoGallery` |
| `videoModalUrl` | A video embed URL, or `null` when no video modal is open | No | Renders the inline video-iframe modal defined directly in `App.jsx`; set via `onOpenFilmModal`/`onOpenVideo` callbacks from `Hero`, `FeaturedStories`, and `FilmsGallery` |
| `contentManagerOpen` | Boolean visibility flag for the "add your own content" modal | No | `ContentManagerModal`; opened from `Navbar`, `PhotoGallery`, and `Footer` |
| `authModalOpen` | Boolean visibility flag for the sign-in modal | No | `AuthModal`; opened from `Navbar` |
| `clientGalleryOpen` | Boolean visibility flag for the private client proofing modal | No | `ClientGalleryModal`; opened from `Navbar`, and set to `true` automatically inside `handleLoginSuccess` when a client (as opposed to admin) logs in |
| `splashDone` | Boolean; `false` until the intro splash animation finishes | No | Gates whether `SplashScreen` renders at all (`{!splashDone && <SplashScreen ... />}`); flipped to `true` by `SplashScreen`'s own `onComplete` callback |

**Modal visibility is 6 independent booleans/booleans-in-disguise with no mutual exclusion:**
`splashDone` (inverted — the splash overlay shows while it's `false`), `lightboxState.isOpen`,
`videoModalUrl` (truthy/falsy), `contentManagerOpen`, `authModalOpen`, and `clientGalleryOpen`.
None of these six are derived from, or reset by, any of the others, so nothing stops two or
more from being open at once — e.g. a user can open the content manager and then the lightbox
without the first ever closing. Stacking order when that happens is decided purely by ad hoc
z-index values sprinkled across the component files, not by any shared constant: `LightboxModal`,
the inline video modal in `App.jsx`, `ContentManagerModal`, and `ClientGalleryModal` all use
`z-50`; `AuthModal` uses `z-[100]`; `SplashScreen` uses `z-[999]`, higher than everything else.
If two `z-50` modals were open together, the one mounted later in the JSX tree would simply win.

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

## Data flow today

All content is static data imported directly from `src/data/weddingData.js` (`INITIAL_STORIES`,
`INITIAL_PHOTOS`, `INITIAL_FILMS`, `TESTIMONIALS`) — there is no CMS and no API call involved
in populating the page on load. User-added content (photos and stories submitted through
`ContentManagerModal`) is written to the `stories` and `photos` state in `App.jsx`, which is
then persisted to `localStorage` (`peak_story_stories`, `peak_story_photos`) and merged in
ahead of the static seed data on next load — it never leaves the browser. There is no network
layer anywhere in the app: no `fetch`, no API client, no server. For where this is going, see
the backend and hosting plan in
`docs/superpowers/specs/2026-07-30-end-to-end-platform-design.md`.

## Known architectural limits

- **No routing.** There is no router of any kind (no `react-router` or equivalent dependency),
  so the entire site is one URL. Individual sections, galleries, and stories have no shareable
  or indexable address of their own — everything lives behind anchor-link scrolling on `/`.
- **No error boundary.** No component in the tree implements `componentDidCatch` or an
  equivalent boundary, so an unhandled render error anywhere in the tree takes down the whole
  page rather than degrading one section.
- **Three independent scroll listeners**, each attaching its own `window.addEventListener('scroll', ...)`
  with no shared coordination: `src/components/Navbar.jsx` (toggles its background/shadow past
  a 40px scroll threshold), `src/components/ScrollProgressBar.jsx` (computes the reading-progress
  fill width), and `src/components/Hero.jsx` (drives the hero's parallax transform). Of the
  three, only `Hero`'s listener is registered as passive (`{ passive: true }`); the other two
  are not, so the browser cannot assume they won't call `preventDefault()` on the scroll event.

See `docs/KNOWN-ISSUES.md` for the fuller catalogue of known issues beyond architecture.
