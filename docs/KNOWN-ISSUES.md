# Known Issues

This is the open-issue register for Peak Story Studio's frontend, carried forward from the
code audit described in
[the end-to-end platform design spec](superpowers/specs/2026-07-30-end-to-end-platform-design.md).
Every row in the open table below is currently unresolved; issues that have since been closed
are listed in the Resolved section instead. "Planned phase" refers to the phase table in
[ROADMAP.md](ROADMAP.md) — that is the phase in which each issue is expected to be closed, not
a promise about scheduling within this document.

Locations were re-verified against the source files on 2026-07-30, then again on 2026-08-03 at
the close of Phase 3 (Task 12's documentation pass) — not copied blind from either audit; see the
task reports for the verification evidence. Phase 3b (the multi-page redesign, same date)
re-verified every row it touched: it resolved `PS-013`, `PS-020`, `PS-023`, and `PS-028` (see
Resolved below) and narrowed `PS-002` and `PS-008` to their remaining scope.

**Eight rows were re-filed out of phase 3 in that second pass.** `PS-009`, `PS-014`, `PS-016`,
`PS-017`, `PS-018`, `PS-020`, `PS-021`, and `PS-023` were all originally filed under phase 3 by
the code audit, but
[the phase 3 admin design doc](superpowers/specs/2026-08-02-phase-3-admin-design.md#scope)
explicitly scoped every one of them **out** of that phase before work started: none shares
anything with authentication, image uploads, or a leads dashboard except a version number, and
"bundling them would mix security-sensitive review with cosmetics and delay a usable admin." That
document said the register would be updated to say so rather than left contradicting it — this is
that update. All eight were re-filed to **7**, alongside `v1.0`'s truthful-content, performance,
and accessibility pass. Two of the eight have since been closed outright by Phase 3b's deletions
(`PS-020`, `PS-023` — see Resolved); the other six still read 7 below.

| ID | Issue | Severity | Location | Planned phase |
| --- | --- | --- | --- | --- |
| PS-001 | Any client PIN unlocks every client's photos; no per-client scoping | Critical | `src/components/AuthModal.jsx`, `src/components/ClientGalleryModal.jsx` | 6 |
| PS-002 | **Narrowed by Phase 3b.** The rendered fabrications are gone: the multi-page redesign deleted the component that carried the "AS FEATURED IN" press bar, the "Vogue Fine Art Choice" badge, and the invented "1,000+ weddings / 40+ destinations" statistics, at the owner's direction (recorded in the Phase 3b spec). What remains is the testimonial attributed to "Deepika & Ranveer" — the real names of a real married Bollywood couple — in two places: `src/data/weddingData.js`'s `TESTIMONIALS` (the outage fallback a visitor sees when the database is unreachable) and the seeded row in the `testimonials` table, which the About page renders until the owner replaces it through the admin | Critical (legal) | `src/data/weddingData.js`, `scripts/seed-db.mjs` | 7 |
| PS-007 | "Download ZIP" button is a non-functional stub that fires a browser `alert()` | Medium | `src/components/ClientGalleryModal.jsx:59` | 6 |
| PS-008 | **Narrowed by Phase 3b**, which brought React Router and a real URL per page (`/gallery`, `/films`, `/stories`, `/about`, `/contact`). What remains is the original core: no shareable or indexable per-**wedding** URL — a couple's story still opens in a modal, not at its own address — plus prerendering, sitemap, OG images, and structured data | High | `src/components/FeaturedStories.jsx`, `src/components/StoryDetailModal.jsx` | 5 |
| PS-009 | Modals do not trap focus, lock body scroll, or close on Escape | Medium | all modals except `src/components/LightboxModal.jsx` | 7 |
| PS-012 | No `prefers-reduced-motion` handling | Medium | `src/index.css`, app-wide | 5 |
| PS-014 | Duplicated pill-button and badge markup across many components | Low | app-wide | 7 |
| PS-016 | Unused CSS rules and palette tokens (the audit counted 10 rules and 7 tokens; the counts are stale after Phase 3b deleted ten components and their styles — recount before acting). Phase 3b also left inert `data-cursor` attributes in `FeaturedStories`, `FilmsGallery`, and `PhotoGallery` after deleting the `CustomCursor` that read them; they belong to this cleanup | Low | `src/index.css`, `tailwind.config.js` | 7 |
| PS-017 | Icon-only buttons use `title` instead of `aria-label` | Low | `src/components/PhotoGallery.jsx` and others | 7 |
| PS-018 | Hotlinked Unsplash images with no width/height; layout shift and third-party dependency | Low | `src/data/weddingData.js` | 7 |
| PS-019 | `dist/` build output is committed to git while also listed in `.gitignore`, so every build produces spurious diffs on tracked files | Low | `.gitignore`, `dist/` | 4 |
| PS-021 | Two `react-hooks/exhaustive-deps` warnings in `useScrollReveal`'s effect: the cleanup reads `ref.current`, which may have changed by the time it runs, and the dependency array omits `options`, which the effect body actually reads. Left unfixed deliberately — a correct fix means reworking how the hook takes its options argument, a behaviour-changing refactor, not a mechanical lint fix. Phase 3 shipped the admin without touching this hook, so the refactor is now expected alongside the Phase 7 polish pass instead | Low | `src/hooks/useScrollReveal.js:23`, `src/hooks/useScrollReveal.js:26` | 7 |
| PS-025 | `media` rows are unconditionally world-readable (`media_read_all` has no predicate), regardless of the `status` of the wedding or gallery photo that references them. The parent row is correctly hidden while in `draft`, but its cover image's `storage_path`/`alt_text` is readable by the anon key regardless. Matches the approved spec exactly (spec section 5.3), so this is a design consequence, not a deviation. **Impact is no longer zero as of Phase 3**: the admin can now create a genuine draft wedding or gallery photo with a real uploaded cover image attached before publishing, so a draft's `media` row is real and anon-readable, not merely hypothetical. The practical exposure stays narrow — the storage bucket itself is private with no public read path (`PS-033`), so a leaked `storage_path` is not itself a way to fetch the image bytes — but the metadata (that a photo exists, its dimensions, its alt text) is no longer protected by the parent's draft status. **Re-filed from phase 3 to phase 6**: the phase 3 admin design doc never scoped this predicate fix as in-scope, deferred, or out-of-scope work — it simply wasn't discussed — so the earlier "3" was an unexamined carry-over, not a deliberate schedule, and Phase 3 shipped without touching it. Phase 6's own deliverable (a couple sees only their own photographs) is the first point a status-aware predicate is actually required, so that is where this now belongs | Medium | `supabase/migrations/20260730204126_row_level_security.sql:49-50` | 6 |
| PS-026 | The booking form requires both a firm wedding date and a firm venue before it accepts an inquiry, so a couple who is still choosing either — arguably the most common state for an early inquiry — cannot submit at all | Medium | `supabase/functions/_shared/inquiry-validation.js`, `src/components/BookingForm.jsx` | 7 |
| PS-027 | `ALLOWED_ORIGINS` only constrains which origins a *browser* is willing to hand the response back to; it is enforced client-side by the browser's own CORS check, not by the function refusing the request. A POST from any origin — or from a non-browser client that ignores CORS entirely, such as curl or a script — still reaches validation and still stores a row. Must not be relied on as an access control once the site is deployed | Low | `supabase/functions/submit-inquiry/index.js` | 4 |
| PS-029 | An image upload can fail after its bytes already reached storage: `sign-upload` and the `PUT` can both succeed, then the browser's insert of the `media` row can fail (network blip, a dropped session mid-upload). The object is never referenced by any row and is never cleaned up — an accepted, deliberately unbuilt gap, not an oversight. The admin is told the upload did not complete and may retry, but a retry re-signs a fresh key rather than reusing the failed one, so each failed retry leaves one more orphan | Low | `src/hooks/useMediaUpload.js`, `src/lib/queries/media.js` | Unscheduled — accepted debt; revisit if orphaned storage volume becomes material |
| PS-030 | `Navbar`'s admin badge (a static `<span>` since the Phase 3b header rewrite; before that a static `<div>`, ever since Phase 3 Task 10 removed the public-site Content Manager it used to open) has no link to `admin.html` at all. A signed-in admin browsing the public site has no visible way to reach the admin they are signed into | Low | `src/components/Navbar.jsx` | 4 — Phase 4 adds the `/admin` redirect at the hosting layer; wire the link then |
| PS-031 | `sign-upload`'s content-type allowlist gates who *gets* a presigned URL, not what actually lands in the object it signs: the `PUT` itself is a bare HTTP request the browser controls, so nothing server-side confirms the uploaded bytes are actually of the declared type before Phase 4 configures the bucket for public serving | Low | `supabase/functions/sign-upload/index.js`, `supabase/functions/_shared/s3-presign.js` | 4 |
| PS-032 | `addWeddingPhoto`'s "next `sort_order`" is a read-then-insert with no locking and no unique constraint on `(wedding_id, sort_order)` — two concurrent adds to the same wedding can read the same max and both insert at it. Nothing is destroyed; only the ordering among the colliding rows becomes arbitrary until an admin reorders manually. A single admin adding photos one at a time (the only UI this ships with) cannot trigger it | Low | `src/lib/queries/adminWeddingPhotos.js` | Unscheduled — accepted debt; revisit if the admin ever supports concurrent editors |
| PS-033 | **Narrowed by Task 12b, and — after Task 13 — actually verified rather than merely claimed.** A photograph uploaded and published through the admin still does not display on a real deployment, but no longer because the query layer mishandles it — `src/lib/queries/weddings.js`, `gallery.js` and `films.js` resolve every `media.storage_path` through the shared `publicMediaUrl()` helper in `src/lib/mediaUrl.js` (promoted there from the admin-only module the admin's own previews used), which joins a real upload's bucket-relative key (e.g. `uploads/<uuid>.webp`) against `VITE_MEDIA_BASE_URL` and passes a seeded row's already-absolute URL through unchanged. Task 12b's claim that this code gap was closed was itself correct, but it shipped without re-running `npm run verify:admin` — the one gate that could have proven it — and that gate turned out to still assert raw `storage_path` equality rather than a resolved URL, passing vacuously because CI never set `VITE_MEDIA_BASE_URL` at all (both sides of the comparison collapsed to the same empty value). Task 13 fixed both halves: the assertion now expects a resolved URL, and CI sets the variable, so the gate genuinely exercises resolution rather than passing by coincidence. What remains, exactly as before, is what the phase 3 admin design doc always deferred to Phase 4: the storage bucket is still **private** with no public read path, and no environment outside CI's test run has `VITE_MEDIA_BASE_URL` pointed at a real public host yet, so a genuine upload still resolves to `''` until Phase 4 makes the bucket publicly readable and sets that variable — rendered today as a broken-image/alt-text box, not as no `<img>` at all, since nothing in the affected components guards against it (see `PS-036`). Pre-existing seeded media (`scripts/seed-db.mjs` writes each seeded row's original full URL — an `images.unsplash.com` link or a local `/images/...` path — into `storage_path` directly, not a bucket key) is unaffected either way and keeps rendering exactly as it does today | Medium | `src/lib/mediaUrl.js`, `src/lib/queries/weddings.js`, `src/lib/queries/gallery.js`, `src/lib/queries/films.js` | 4 |
| PS-036 | `FeaturedStories`, `PhotoGallery`, `StoryDetailModal`, and `FilmsGallery` all render their `coverImage`/`url`/`thumbnail` field straight into `<img src={...}>` with no guard for an empty string — which is exactly what `publicMediaUrl()` (`src/lib/mediaUrl.js`) returns today for any admin-uploaded photo, since no environment yet has `VITE_MEDIA_BASE_URL` pointed at a real public host (`PS-033`). A visitor sees a browser's broken-image / alt-text box wherever that photo is used, not simply the absence of one — `src/lib/mediaUrl.js`'s own module comment previously claimed otherwise, corrected in Task 13 | Medium | `src/components/FeaturedStories.jsx`, `src/components/PhotoGallery.jsx`, `src/components/StoryDetailModal.jsx`, `src/components/FilmsGallery.jsx` | 4 — same phase that closes `PS-033`; add the guard alongside making the bucket genuinely servable |

### Notes on selected rows

**PS-001 — no per-client scoping.** `AuthModal.jsx`'s `handleClientLogin` accepts any non-empty
PIN of up to 4 characters and does not check it against a per-couple value; it always logs the
visitor in as a client. `ClientGalleryModal.jsx` then renders whatever `photos` array `App.jsx`
passes it — the entire shared photo collection, with no filter keyed on the logged-in user. Any
visitor who reaches the client tab sees every couple's private photographs, not just their own.

**PS-002 — fabricated credentials.** This is a legal-risk row, not a cosmetic one. The
component that rendered the "AS FEATURED IN LEADING LUXURY PUBLICATIONS" press bar (VOGUE,
HARPER'S BAZAAR, FILMFARE, WEDMEGOOD), the floating "Vogue Fine Art Choice" badge, and the
invented statistics was deleted by Phase 3b's redesign, so none of that renders anywhere
anymore. What remains is the quote attributed to "Deepika & Ranveer" — the real names of a
well-known Bollywood actress and actor who are themselves a real married couple — presented as
a genuine client testimonial, in `weddingData.js`'s `TESTIMONIALS` (the outage fallback) and in
the seeded `testimonials` table row the About page renders. Neither is sourced or substantiated
anywhere in the repository. On a live commercial site this is a false-endorsement exposure,
independent of whether the underlying photography claims are true. The owner replaces the
database row through the admin; Phase 7 cleans the fallback file.

**PS-025 — `media` is world-readable regardless of its parent's status.** Filed from the Phase
1b final review. `supabase/migrations/20260730204126_row_level_security.sql`'s
`media_read_all` policy is `for select using (true)` — no predicate — so while a draft
wedding's own row and its `wedding_photos` join row are correctly hidden from the anon key, the
`media` row holding its cover image's `storage_path` and `alt_text` is not. This matches the
approved spec exactly (section 5.3's grant table gives `media` | anon | `SELECT` with no
predicate), so it is a spec-level design consequence, not an implementer deviation. As the table
above now says, Phase 3 is what turned this from a hypothetical into a real, if narrow, gap —
draft weddings and gallery photos with real uploaded media now exist — and the row is now
re-filed to Phase 6, the phase whose own deliverable actually requires fixing it.
`docs/DATA-MODEL.md` carries the corresponding caveat next to its policy summary.

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

Four more issues were closed by Phase 3b, the multi-page redesign (`v0.4b`) — three of them by
deleting the code they lived in rather than by fixing it in place:

- **PS-013 — three scroll listeners** — all three owners are gone: `ScrollProgressBar` and
  `Hero` were deleted outright, and the rewritten `Navbar` has no scroll listener at all (the
  scroll-condensing behavior went with the redesign).
- **PS-020 — `SectionDivider`'s raw hex props** — the component and every call site were
  deleted; the new design has no wave dividers. The no-raw-hex rule itself stands, now with no
  standing violation.
- **PS-023 — `FILM_STRIP_FRAMES`/`EDITORIAL_GALLERY` had no database path** — `FilmStrip` and
  `HorizontalGallery` were deleted and both arrays removed from `src/data/weddingData.js`;
  there is no longer any decorative strip content to migrate.
- **PS-028 — unconfirmed contact details** — the owner confirmed the real details on
  2026-08-03: 2/231 Vastu Khand, Gomtinagar, Lucknow, UP · peakstorystudio@gmail.com ·
  +91 8881621021. `src/data/contact.js` now carries them (WhatsApp as a constant, no longer
  env-gated), and the old Mumbai placeholders are gone from the repository.

Two more issues were found and closed in Phase 3 Task 13, the whole-branch review that returned
DO NOT SHIP for the two rows below (both sit at a seam between Tasks 7–9, which is why twelve
per-task reviews missed them) — see that task's report for the live-database proof:

- **PS-034 — a blank optional field made the admin's headline capability, creating a record,
  fail outright.** `ResourceForm.buildPayload` (`src/admin/ResourceForm.jsx`) emitted `''` for a
  blank `media`/`date`/`text` field and `null` for a blank `number` field, regardless of what the
  underlying Postgres column actually accepted — so a minimally-filled *Add Wedding* or *Add
  Testimonial* was rejected: a blank Cover Photo raised `22P02 invalid input syntax for type
  uuid: ""`, a blank Date raised `22007 invalid input syntax for type date: ""`, and a blank
  Order raised `23502 null value in column "sort_order" violates not-null constraint` — and
  `sort_order` is optional on all four content resources. Every resource config now declares an
  explicit `emptyValue` per optional field (`null` for a nullable column, `0` for `sort_order`,
  which is `int not null default 0`) rather than having `ResourceForm` guess one from `field.type`
  — the guess was provably wrong, since `sortOrder` and `durationSeconds` share `type: 'number'`
  but need opposite answers. A config that omits `emptyValue` on an optional field now fails
  loudly (a thrown error) rather than silently guessing. Unit-tested via
  `src/admin/__tests__/ResourceForm.test.jsx` and proved against a live Postgres instance for all
  four resources: create with only required fields filled, then update clearing every optional
  field, for weddings, testimonials, gallery photos, and films alike.
- **PS-035 — every create went live immediately for three of the four content types.**
  `makeResourceQueries.create()` (`src/lib/queries/adminContent.js`) never set `status`, since
  `ResourceForm` deliberately never includes it in `fields` (see that file's own module comment).
  Left alone, a new row fell through to its table's own column default — `draft` for `weddings`,
  but `published` for `gallery_photos`, `films`, and `testimonials`
  (`supabase/migrations/20260730203451_initial_schema.sql`) — so a half-finished gallery photo,
  film, or testimonial was published the instant "Create" was clicked, before an admin ever
  touched `ResourceList`'s publish toggle. `create()` now forces `status: 'draft'`
  unconditionally for every resource, so publishing stays the deliberate, separate act the
  toggle already required it to be.
