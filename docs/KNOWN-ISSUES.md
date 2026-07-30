# Known Issues

This is the open-issue register for Peak Story Studio's frontend, carried forward from the
code audit described in
[the end-to-end platform design spec](superpowers/specs/2026-07-30-end-to-end-platform-design.md).
Every row in the open table below is currently unresolved; issues that have since been closed
are listed in the Resolved section instead. "Planned phase" refers to the phase table in
[ROADMAP.md](ROADMAP.md) — that is the phase in which each issue is expected to be closed, not
a promise about scheduling within this document.

All locations were re-verified against the source files on 2026-07-30, not copied blind from
the audit; see the task report for the verification evidence.

| ID | Issue | Severity | Location | Planned phase |
| --- | --- | --- | --- | --- |
| PS-001 | Any client PIN unlocks every client's photos; no per-client scoping | Critical | `src/components/AuthModal.jsx`, `src/components/ClientGalleryModal.jsx` | 6 |
| PS-002 | Fabricated press credentials ("AS FEATURED IN" Vogue, Harper's Bazaar, Filmfare, WedMeGood; "Vogue Fine Art Choice" badge) and real Bollywood celebrities named as clients | Critical (legal) | `src/components/AboutSection.jsx`, `src/data/weddingData.js` | 7 |
| PS-003 | Booking form reports success unconditionally; submissions are discarded | High | `src/components/BookingForm.jsx` | 2 |
| PS-004 | Uploaded images stored as base64 in localStorage; exceeds the ~5 MB quota | High | `src/components/ContentManagerModal.jsx` (base64 conversion), `src/App.jsx:50` (oversized write) | 3 |
| PS-005 | Export Config JSON button sets a "Copied!" label but copies nothing | High | `src/components/ContentManagerModal.jsx` | 3 |
| PS-007 | "Download ZIP" button is a non-functional stub that fires a browser `alert()` | Medium | `src/components/ClientGalleryModal.jsx:59` | 6 |
| PS-008 | No routing; no shareable or indexable per-wedding URLs | High | app-wide | 5 |
| PS-009 | Modals do not trap focus, lock body scroll, or close on Escape | Medium | all modals except `src/components/LightboxModal.jsx` | 3 |
| PS-012 | No `prefers-reduced-motion` handling | Medium | `src/index.css`, app-wide | 5 |
| PS-013 | Three scroll listeners; only Hero's is passive | Low | `src/components/Navbar.jsx`, `src/components/ScrollProgressBar.jsx`, `src/components/Hero.jsx` | 5 |
| PS-014 | Duplicated pill-button and badge markup across many components | Low | app-wide | 3 |
| PS-016 | 10 unused CSS rules and 7 unused palette tokens | Low | `src/index.css`, `tailwind.config.js` | 3 |
| PS-017 | Icon-only buttons use `title` instead of `aria-label` | Low | `src/components/PhotoGallery.jsx` and others | 3 |
| PS-018 | Hotlinked Unsplash images with no width/height; layout shift and third-party dependency | Low | `src/data/weddingData.js` | 3 |
| PS-019 | `dist/` build output is committed to git while also listed in `.gitignore`, so every build produces spurious diffs on tracked files | Low | `.gitignore`, `dist/` | 4 |
| PS-020 | `SectionDivider` receives `color`/`bgColor` as raw hex strings (default `'#faf9f6'`/`'#ffffff'`, and the same two values passed explicitly from every call site) instead of Tailwind palette classes, even though both values exactly duplicate existing tokens (`offwhite-100`, `offwhite-50`) | Low | `src/components/SectionDivider.jsx:3`, `src/App.jsx:160,169,173,185,189` | 3 |
| PS-021 | Two `react-hooks/exhaustive-deps` warnings in `useScrollReveal`'s effect: the cleanup reads `ref.current`, which may have changed by the time it runs, and the dependency array omits `options`, which the effect body actually reads. Left unfixed deliberately — a correct fix means reworking how the hook takes its options argument, a behaviour-changing refactor that belongs with the component work in Phase 3, not a mechanical lint fix | Low | `src/hooks/useScrollReveal.js:23`, `src/hooks/useScrollReveal.js:26` | 3 |
| PS-022 | `ContentManagerModal`'s "Add Wedding Story" tab has no date input at all — `storyDate` is declared with `const [storyDate] = useState('');` and its setter is never called, so the value is permanently `''`. Every story published through the Content Manager therefore falls through to the hardcoded `date: storyDate \|\| '2025'` fallback, so all user-published stories are dated "2025" regardless of when they actually happened. | Medium | `src/components/ContentManagerModal.jsx:20`, `src/components/ContentManagerModal.jsx:78` | 3 |

### Notes on selected rows

**PS-001 — no per-client scoping.** `AuthModal.jsx`'s `handleClientLogin` accepts any non-empty
PIN of up to 4 characters and does not check it against a per-couple value; it always logs the
visitor in as a client. `ClientGalleryModal.jsx` then renders whatever `photos` array `App.jsx`
passes it — the entire shared photo collection, with no filter keyed on the logged-in user. Any
visitor who reaches the client tab sees every couple's private photographs, not just their own.

**PS-002 — fabricated credentials.** This is a legal-risk row, not a cosmetic one.
`AboutSection.jsx` renders a "AS FEATURED IN LEADING LUXURY PUBLICATIONS" press bar naming
VOGUE, HARPER'S BAZAAR, FILMFARE, and WEDMEGOOD, plus a floating "Vogue Fine Art Choice" badge
claiming the studio was "Recognized worldwide for cinema quality framing." `weddingData.js`'s
`TESTIMONIALS` array attributes a quote to "Deepika & Ranveer" — the real names of a well-known
Bollywood actress and actor who are themselves a real married couple — presented as a genuine
client testimonial. None of this is sourced or substantiated anywhere in the repository. On a
live commercial site this is a false-endorsement and false-advertising exposure, independent of
whether the underlying photography claims are true.

**PS-004 — base64 uploads exceed the localStorage quota.** The two files play distinct roles.
`ContentManagerModal.jsx`'s `handleFileUpload` reads the chosen file with
`FileReader.readAsDataURL`, producing a full base64 data URL that is stored directly on the new
photo object — that file contains no `localStorage` reference itself. `App.jsx` is where the
quota is actually at risk: its `photos` state (seeded from `INITIAL_PHOTOS` plus anything added
through the Content Manager) is written to `localStorage` on every change via
`localStorage.setItem('peak_story_photos', JSON.stringify(photos))` at `src/App.jsx:50`. A
handful of base64-encoded photos is enough to approach or exceed the ~5 MB per-origin quota,
at which point that `setItem` call throws and silently stops persisting new photos. An engineer
fixing this needs both files: the upload path that creates the oversized string, and the
storage path that fails to hold it.

## Resolved

Four bugs found in the same audit were fixed in commit `8ef6d5e`, before this documentation
baseline, and are not open issues:

- **Doubled custom cursor** — the custom cursor was rendering twice.
- **Client-gallery favourites ID mismatch** — favourited photo IDs did not match the ID format
  of the actual photo records, so the favourites filter silently matched nothing.
- **Unguarded `JSON.parse` of localStorage** — reading `peak_story_stories`, `peak_story_photos`,
  or `peak_story_user` from localStorage with malformed contents would throw uncaught.
- **Colour-slider resize drift** — the before/after comparison slider's handle position drifted
  out of sync with the pointer on window resize.

**Caveat carried forward from the cursor fix:** the fix hides the native text-input caret at
viewport widths of 1024px and above (the breakpoint at which the custom cursor is shown instead
of the system cursor), and there is a brief window with no visible cursor at all — neither the
system arrow nor the custom cursor — before the first mouse movement is detected. Both are
accepted trade-offs of the current implementation, not regressions to re-open as new issues.

Four more issues were closed in Phase 1a (quality foundation):

- **PS-006 — Rules of Hooks violation** — `LightboxModal.jsx` and `StoryDetailModal.jsx` now call
  all their hooks unconditionally before the early `return null`, so hook order is stable across
  renders regardless of how the parent renders the component.
- **PS-010 — no error boundary** — `src/components/ErrorBoundary.jsx` now exists and wraps
  `<App />` in `src/main.jsx`, so a render throw shows a recovery screen instead of blanking the
  page.
- **PS-011 — `npm run lint` lints nothing; no tests exist** — `lint` now runs real ESLint
  (`eslint .`) and a Vitest suite now exists and runs via `npm test`.
- **PS-015 — `FilmStrip` and `HorizontalGallery` hardcode their own image arrays** — both now
  import their image data (`FILM_STRIP_FRAMES`, `EDITORIAL_GALLERY`) from
  `src/data/weddingData.js` instead of defining it locally.
