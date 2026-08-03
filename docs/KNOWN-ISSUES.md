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
| PS-020 | `SectionDivider` receives `color`/`bgColor` as raw hex strings (default `'#faf9f6'`/`'#ffffff'`, and the same two values passed explicitly from every call site) instead of Tailwind palette classes, even though both values exactly duplicate existing tokens (`offwhite-100`, `offwhite-50`) | Low | `src/components/SectionDivider.jsx:3`, `src/App.jsx:128,137,141,152,156` | 3 |
| PS-021 | Two `react-hooks/exhaustive-deps` warnings in `useScrollReveal`'s effect: the cleanup reads `ref.current`, which may have changed by the time it runs, and the dependency array omits `options`, which the effect body actually reads. Left unfixed deliberately — a correct fix means reworking how the hook takes its options argument, a behaviour-changing refactor that belongs with the component work in Phase 3, not a mechanical lint fix | Low | `src/hooks/useScrollReveal.js:23`, `src/hooks/useScrollReveal.js:26` | 3 |
| PS-023 | `FILM_STRIP_FRAMES` (6 entries) and `EDITORIAL_GALLERY` (5 entries) stay static after the Phase 1b migration — they have no table in the approved schema, so the site still reads them from the JavaScript file while every other collection comes from Postgres. Migrating them needs a schema decision the approved spec does not cover: the film-strip entries carry a camera/film-stock label rather than a wedding, so they are not simply more `gallery_photos`. Both are decorative strips whose editing story only matters once the CMS exists — and it now does (Phase 3's admin), but neither array has a table for that CMS to write to yet. | Low | `src/data/weddingData.js`, `src/components/FilmStrip.jsx`, `src/components/HorizontalGallery.jsx` | 3 |
| PS-025 | `media` rows are unconditionally world-readable (`media_read_all` has no predicate), regardless of the `status` of the wedding or gallery photo that references them. The parent row is correctly hidden while in `draft`, but its cover image's `storage_path`/`alt_text` is readable by the anon key regardless. Matches the approved spec exactly (spec section 5.3), so this is a design consequence, not a deviation, and impact today is zero — every seeded row is `status='published'`. Becomes real once Phase 3 introduces a real `draft` state and Phase 3/4 make `storage_path` a real Supabase Storage URL, and matters most by Phase 6, whose deliverable is that a couple sees only their own photographs. | Medium | `supabase/migrations/20260730204126_row_level_security.sql:49-50` | 3 |
| PS-026 | The booking form requires both a firm wedding date and a firm venue before it accepts an inquiry, so a couple who is still choosing either — arguably the most common state for an early inquiry — cannot submit at all | Medium | `supabase/functions/_shared/inquiry-validation.js`, `src/components/BookingForm.jsx` | 7 |
| PS-027 | `ALLOWED_ORIGINS` only constrains which origins a *browser* is willing to hand the response back to; it is enforced client-side by the browser's own CORS check, not by the function refusing the request. A POST from any origin — or from a non-browser client that ignores CORS entirely, such as curl or a script — still reaches validation and still stores a row. Must not be relied on as an access control once the site is deployed | Low | `supabase/functions/submit-inquiry/index.js` | 4 |
| PS-028 | The studio's phone number, email address, and postal address are unconfirmed — inherited unchanged from the seeded template rather than supplied by the studio | Medium | `src/data/contact.js` | 7 |

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

**PS-025 — `media` is world-readable regardless of its parent's status.** Filed from the Phase
1b final review. `supabase/migrations/20260730204126_row_level_security.sql`'s
`media_read_all` policy is `for select using (true)` — no predicate — so while a draft
wedding's own row and its `wedding_photos` join row are correctly hidden from the anon key, the
`media` row holding its cover image's `storage_path` and `alt_text` is not. This matches the
approved spec exactly (section 5.3's grant table gives `media` | anon | `SELECT` with no
predicate), so it is a spec-level design consequence, not an implementer deviation, and impact
today is zero — every seeded row is `status='published'`. It becomes real once Phase 3/4 make
`storage_path` a real Supabase Storage URL and drafts become a normal state, and matters most by
Phase 6, whose deliverable is that a couple sees only their own photographs. `docs/DATA-MODEL.md`
carries the corresponding caveat next to its policy summary.

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

One issue was closed in Phase 2 (inquiries real):

- **PS-003 — booking form reported success unconditionally; submissions were discarded** —
  `BookingForm` now calls a real Edge Function (`supabase/functions/submit-inquiry`) that
  validates the payload against the same rules the form applies, inserts it into
  `public.inquiries` under the service-role key (the only role with insert privilege on that
  table), and only then reports success back to the couple. A failed insert now surfaces as an
  error state with a way to reach the studio directly instead of a false confirmation.
  `npm run verify:inquiry` asserts against Postgres directly that a submission actually lands a
  row, and the same check runs in CI.

Four more issues were closed in Phase 3 Task 10 (the Content Manager cutover — the database
became unconditionally authoritative, `VITE_DATA_SOURCE` and its `dataSource.js` resolver
(formerly under `src/lib`) were deleted, and `ContentManagerModal.jsx` was deleted along with
every prop that wired it into
`App.jsx`, `Navbar`, `Footer`, and `PhotoGallery`):

- **PS-004 — base64 uploads exceeded the localStorage quota** — closed by deleting the only two
  things that ever put a photo there: `ContentManagerModal.jsx`'s `handleFileUpload` (which
  produced the oversized base64 data URL) and the `peak_story_photos` `localStorage` key
  `App.jsx` wrote it into. Photos the admin uploads now go through Supabase Storage via
  `src/admin/UploadField.jsx` and `src/hooks/useMediaUpload.js`, not through the browser's
  per-origin `localStorage` quota at all.
- **PS-005 — Export Config JSON button copied nothing** — removed along with the rest of
  `ContentManagerModal.jsx`, not fixed in place: a "paste this into `weddingData.js`" export flow
  has nothing to do once the database, not that file, is authoritative.
- **PS-022 — story date input silently stuck at `''`, defaulting every published story to
  "2025"** — the file the bug lived in (`ContentManagerModal.jsx`) is deleted, and separately
  (Phase 3 Task 8) the admin's real wedding-story form already replaced the underlying product
  decision this row was tracking with a genuine `type: 'date'` input (`src/admin/resources/weddings.js`)
  bound to `weddings.event_date`, an ISO date column — not a guess, and not a second copy of the
  old free-text fallback.
- **PS-024 — Content Manager was a silent no-op on the `supabase` path** — moot once the modal
  that no-opped is deleted. Real content now goes through the admin app's CRUD (`src/admin/`),
  built across Phase 3 Tasks 1–9, which writes straight to Postgres and reports success only
  when a write actually lands.
