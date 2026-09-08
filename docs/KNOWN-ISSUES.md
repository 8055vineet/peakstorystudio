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
Resolved below) and narrowed `PS-002` and `PS-008` to their remaining scope. A whole-site flow review on 2026-09-07
(three read-only code reviews plus a browser drive of every public route, the contact form, the
client access-code flow, and the admin) filed `PS-037`–`PS-052` below and closed the rows listed
under "Phase 6 flow review" in Resolved.

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
| PS-009 | Modals do not trap focus, lock body scroll, or close on Escape | Medium | all modals except `src/components/LightboxModal.jsx` | 7 |
| PS-012 | No `prefers-reduced-motion` handling | Medium | `src/index.css`, app-wide | 5 |
| PS-014 | Duplicated pill-button and badge markup across many components | Low | app-wide | 7 |
| PS-016 | Unused CSS rules and palette tokens (the audit counted 10 rules and 7 tokens; the counts are stale after Phase 3b deleted ten components and their styles — recount before acting). Phase 3b also left inert `data-cursor` attributes in `FeaturedStories`, `FilmsGallery`, and `PhotoGallery` after deleting the `CustomCursor` that read them; they belong to this cleanup | Low | `src/index.css`, `tailwind.config.js` | 7 |
| PS-017 | Icon-only buttons use `title` instead of `aria-label` | Low | `src/components/PhotoGallery.jsx` and others | 7 |
| PS-018 | Hotlinked Unsplash images with no width/height; layout shift and third-party dependency | Low | `src/data/weddingData.js` | 7 |
| PS-021 | Two `react-hooks/exhaustive-deps` warnings in `useScrollReveal`'s effect: the cleanup reads `ref.current`, which may have changed by the time it runs, and the dependency array omits `options`, which the effect body actually reads. Left unfixed deliberately — a correct fix means reworking how the hook takes its options argument, a behaviour-changing refactor, not a mechanical lint fix. Phase 3 shipped the admin without touching this hook, so the refactor is now expected alongside the Phase 7 polish pass instead | Low | `src/hooks/useScrollReveal.js:23`, `src/hooks/useScrollReveal.js:26` | 7 |
| PS-025 | `media` rows are unconditionally world-readable (`media_read_all` has no predicate), regardless of the `status` of the wedding or gallery photo that references them. The parent row is correctly hidden while in `draft`, but its cover image's `storage_path`/`alt_text` is readable by the anon key regardless. Matches the approved spec exactly (spec section 5.3), so this is a design consequence, not a deviation. **Impact is no longer zero as of Phase 3**: the admin can now create a genuine draft wedding or gallery photo with a real uploaded cover image attached before publishing, so a draft's `media` row is real and anon-readable, not merely hypothetical. The practical exposure stays narrow — the storage bucket itself is private with no public read path (`PS-033`), so a leaked `storage_path` is not itself a way to fetch the image bytes — but the metadata (that a photo exists, its dimensions, its alt text) is no longer protected by the parent's draft status. **Re-filed from phase 3 to phase 6**: the phase 3 admin design doc never scoped this predicate fix as in-scope, deferred, or out-of-scope work — it simply wasn't discussed — so the earlier "3" was an unexamined carry-over, not a deliberate schedule, and Phase 3 shipped without touching it. Phase 6's own deliverable (a couple sees only their own photographs) is the first point a status-aware predicate is actually required, so that is where this now belongs. **2026-09-07 note:** the exposure actually lands in Phase 4, not 6 — the moment Stage 3 makes the bucket public, every draft upload's `storage_path` listed via `/rest/v1/media` is a working URL — so the predicate fix should be pulled forward to the deploy | Medium | `supabase/migrations/20260730204126_row_level_security.sql:49-50` | 6 |
| PS-026 | The booking form requires both a firm wedding date and a firm venue before it accepts an inquiry, so a couple who is still choosing either — arguably the most common state for an early inquiry — cannot submit at all | Medium | `supabase/functions/_shared/inquiry-validation.js`, `src/components/BookingForm.jsx` | 7 |
| PS-027 | `ALLOWED_ORIGINS` only constrains which origins a *browser* is willing to hand the response back to; it is enforced client-side by the browser's own CORS check, not by the function refusing the request. A POST from any origin — or from a non-browser client that ignores CORS entirely, such as curl or a script — still reaches validation and still stores a row. Must not be relied on as an access control once the site is deployed | Low | `supabase/functions/submit-inquiry/index.js` | 4 |
| PS-029 | An image upload can fail after its bytes already reached storage: `sign-upload` and the `PUT` can both succeed, then the browser's insert of the `media` row can fail (network blip, a dropped session mid-upload). The object is never referenced by any row and is never cleaned up — an accepted, deliberately unbuilt gap, not an oversight. The admin is told the upload did not complete and may retry, but a retry re-signs a fresh key rather than reusing the failed one, so each failed retry leaves one more orphan | Low | `src/hooks/useMediaUpload.js`, `src/lib/queries/media.js` | Unscheduled — accepted debt; revisit if orphaned storage volume becomes material |
| PS-031 | `sign-upload`'s content-type allowlist gates who *gets* a presigned URL, not what actually lands in the object it signs: the `PUT` itself is a bare HTTP request the browser controls, so nothing server-side confirms the uploaded bytes are actually of the declared type before Phase 4 configures the bucket for public serving | Low | `supabase/functions/sign-upload/index.js`, `supabase/functions/_shared/s3-presign.js` | 4 |
| PS-032 | `addWeddingPhoto`'s "next `sort_order`" is a read-then-insert with no locking and no unique constraint on `(wedding_id, sort_order)` — two concurrent adds to the same wedding can read the same max and both insert at it. Nothing is destroyed; only the ordering among the colliding rows becomes arbitrary until an admin reorders manually. A single admin adding photos one at a time (the only UI this ships with) cannot trigger it | Low | `src/lib/queries/adminWeddingPhotos.js` | Unscheduled — accepted debt; revisit if the admin ever supports concurrent editors |
| PS-033 | **Narrowed by Task 12b, and — after Task 13 — actually verified rather than merely claimed.** A photograph uploaded and published through the admin still does not display on a real deployment, but no longer because the query layer mishandles it — `src/lib/queries/weddings.js`, `gallery.js` and `films.js` resolve every `media.storage_path` through the shared `publicMediaUrl()` helper in `src/lib/mediaUrl.js` (promoted there from the admin-only module the admin's own previews used), which joins a real upload's bucket-relative key (e.g. `uploads/<uuid>.webp`) against `VITE_MEDIA_BASE_URL` and passes a seeded row's already-absolute URL through unchanged. Task 12b's claim that this code gap was closed was itself correct, but it shipped without re-running `npm run verify:admin` — the one gate that could have proven it — and that gate turned out to still assert raw `storage_path` equality rather than a resolved URL, passing vacuously because CI never set `VITE_MEDIA_BASE_URL` at all (both sides of the comparison collapsed to the same empty value). Task 13 fixed both halves: the assertion now expects a resolved URL, and CI sets the variable, so the gate genuinely exercises resolution rather than passing by coincidence. What remains, exactly as before, is what the phase 3 admin design doc always deferred to Phase 4: the storage bucket is still **private** with no public read path, and no environment outside CI's test run has `VITE_MEDIA_BASE_URL` pointed at a real public host yet, so a genuine upload still resolves to `''` until Phase 4 makes the bucket publicly readable and sets that variable — rendered today as a quiet placeholder block rather than a broken-image box, since Phase 4 routed every such render through `Photo` (`PS-036`, resolved). Pre-existing seeded media (`scripts/seed-db.mjs` writes each seeded row's original full URL — an `images.unsplash.com` link or a local `/images/...` path — into `storage_path` directly, not a bucket key) is unaffected either way and keeps rendering exactly as it does today | Medium | `src/lib/mediaUrl.js`, `src/lib/queries/weddings.js`, `src/lib/queries/gallery.js`, `src/lib/queries/films.js` | 4 |
| PS-037 | **Hosted project accepts public sign-ups.** `supabase/config.toml` sets `enable_signup = false`, but that file governs only the local stack: on 2026-09-07 the hosted project's `/auth/v1/settings` still reported `"disable_signup": false`. Anyone holding the (public) anon key can register an account. Under current RLS such an account has no `profiles` row and can write nothing, but it can squat an email address the owner later tries to add through `manage-team` (which then answers `EMAIL_EXISTS`), and it consumes the project's email quota. Dashboard setting, not code: Authentication → Sign In / Providers → "Allow new users to sign up" off, then add a `curl /auth/v1/settings` assertion to the runbook | High | hosted Supabase project (dashboard); `docs/DEPLOYMENT.md` | 4 — before Pages is connected |
| PS-038 | **Stage 2 of the runbook is unfinished on the hosted project**: none of the four Edge Functions is deployed (`/functions/v1/*` → 404) and the `media` bucket does not exist (`NoSuchBucket`), while migrations are applied. Connecting Cloudflare Pages before this is done would make every booking submission fail silently — a lost lead on a commercial site — and uploads/deletes/team management 404. A `verify-hosted` script asserting OPTIONS 204 from each function, the bucket, `disable_signup: true`, and a non-`*` CORS origin would make the ordering mechanical | High | `docs/DEPLOYMENT.md` Stage 2 steps 4 and 6 | 4 — before Pages is connected |
| PS-039 | **A client access code is the only thing guarding a couple's Drive folder, and nothing limits guessing it.** `client_galleries_for_code` is an anon-callable RPC with no attempt ledger or lockout (PostgREST has no per-IP rate limit), the admin form enforces only a 6-character minimum (`PS-001`'s replacement), and the accepted code is kept in plain text in `localStorage` with no expiry. A surname-plus-year code is dictionary-guessable at API speed. Fix: generate 8+ random characters in the admin, add an attempt ledger keyed on hashed IP (reuse the `consume_inquiry_rate_limit` pattern) or move the lookup behind an Edge Function, prefer `sessionStorage` | Medium | `supabase/migrations/20260812120000_client_galleries_and_owner.sql`, `src/admin/resources/clientGalleries.js`, `src/App.jsx` | 7 |
| PS-040 | **Every admin list query is unbounded and silently truncated at PostgREST's `max_rows = 1000`** (`listMedia`, the resource lists, inquiries; no `.range()` anywhere). Past 1,000 media rows — one season with the bulk uploader — the Media Library and every picker show only the newest 1,000, older photographs become unselectable and undeletable from the UI, and `reorder()` rewrites `sort_order` for the visible subset only. Each `ResourceForm` with a media field also fetches the full media list independently | Medium | `src/lib/queries/media.js`, `src/lib/queries/adminContent.js`, `src/lib/queries/adminInquiries.js` | 7 |
| PS-041 | **Reorder is N parallel, non-transactional `UPDATE`s** — one per row per arrow click, across every reorderable table. A partial failure leaves duplicate `sort_order` values (no unique constraint) and the public ordering becomes undefined; 300 gallery photos means 300 PATCHes per click. Distinct from `PS-032` (the append race). Fix: one plpgsql `reorder_<table>(ids uuid[])` using `unnest ... with ordinality` in a single statement | Low | `src/lib/queries/adminContent.js`, `adminWeddingPhotos.js`, `adminCollectionItems.js`, `adminGalleryCategories.js`, `adminBookingServices.js` | 7 |
| PS-042 | **A non-YouTube video URL goes straight into the iframe.** `youtubeEmbedUrl()` returns the raw value when it cannot parse an id, so a Vimeo link or a malformed YouTube URL renders a "refused to connect" frame — on Home, as the full-width autoplaying hero. The admin film form and the collection video field validate only `https://`. Fix: parse Vimeo (`player.vimeo.com/video/<id>`) and reject anything else in the admin | Medium | `src/lib/youtube.js`, `src/admin/resources/films.js`, `src/admin/CollectionItems.jsx` | 7 |
| PS-043 | **Two different response promises.** The booking form's success panel says the studio will "reach out within 24 hours"; the confirmation email says "personally within two working days". Same couple, two answers. Owner's call which is true | Low | `src/components/BookingForm.jsx`, `supabase/functions/_shared/email.js` | 7 |
| PS-044 | Raw hex in a public component: the confetti burst hardcodes `#0a0a0a`, `#262626`, `#d5cfc2`, `#ffffff` (`#0a0a0a` is not even a palette token). The no-raw-hex rule was recorded as having no standing violation when `PS-020` closed | Low | `src/components/BookingForm.jsx` | 7 |
| PS-046 | **The example function config is an always-pass config.** `supabase/functions/.env.example` ships Cloudflare's published test Turnstile secret (accepts any token), a placeholder `RATE_LIMIT_SALT`, and blank `ALLOWED_ORIGINS` (→ `*`). `supabase secrets set --env-file` of that file would silently disable the only real spam control on the live form, and nothing at runtime detects it. Fix: treat Cloudflare's test secrets as `NOT_CONFIGURED` unless `ALLOW_TURNSTILE_TEST_KEYS=true` (CI sets it); refuse the placeholder salt outside local | Medium | `supabase/functions/_shared/turnstile.js`, `supabase/functions/.env.example` | 4 |
| PS-048 | No index on the media foreign keys (`weddings.cover_media_id`, `gallery_photos.media_id`, `films.thumbnail_media_id`, `collection_items.media_id`, the four `site_settings.*_media_id`), nor on `inquiries (status, created_at)`, `media (created_at)`, `collections (status, sort_order)`, `client_galleries (status)`. Every `delete-media` runs eight sequential-scan FK checks. Harmless at hundreds of rows | Low | `supabase/migrations/` | 7 |
| PS-049 | **The attach dialogs allow a double insert**: `WeddingPhotos` and `CollectionItems` keep the picker open and never disable Select while an add is in flight, so a second click before the reload inserts again — a raw `duplicate key` message for weddings, a silent duplicate row for pages (no unique constraint on `(collection_id, media_id)`). Their bulk uploader also fires one add per file without awaiting, which is the concurrent read-max-then-insert `PS-032` says the shipped UI cannot reach — that sentence is now stale | Low | `src/admin/WeddingPhotos.jsx`, `src/admin/CollectionItems.jsx`, `src/admin/UploadField.jsx` | 7 |
| PS-050 | `sign-upload`'s size ceiling checks only the client-declared `byteSize`; the presigned PUT signs the host alone, so the browser can PUT any size. Same shape as `PS-031` (content type), admin-only | Low | `supabase/functions/sign-upload/index.js`, `supabase/functions/_shared/s3-presign.js` | 4 |
| PS-051 | `manage-team` maps every GoTrue 422 to `EMAIL_EXISTS`, so a hosted password-policy rejection reads "That email already has an account"; `listMembers` is an N+1 of `getUserById` | Low | `supabase/functions/manage-team/index.js` | 7 |
| PS-052 | Bulk gallery rows take the camera file name as their title, and "Publish all" pushes it live as the public `alt`/`aria-label` ("IMG_4532") with an empty `alt_text` | Low | `src/admin/App.jsx`, `src/components/PhotoGallery.jsx` | 7 |

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

### Phase 4 (first deploy) — resolved in the deploy preparation commit

- **PS-019 — `dist/` both committed and gitignored** — `dist/` is no longer tracked
  (`git rm -r --cached dist/`); `.gitignore` already listed it, so the contradiction is gone.
  Cloudflare Pages builds from source on every push, which removed the last reason to commit
  build output at all. `npm run build` no longer dirties the working tree, so the
  `git checkout -- dist/ && git clean -fx dist/` dance in `CLAUDE.md` is retired with it.
- **PS-030 — inert admin badge** — `Navbar`'s admin badge is now an `<a href="/admin.html">` (and, since the 2026-09-07 review, `/admin` and `/admin/` both reach it in production via `public/_redirects` and in the dev server via the `adminEntryRewrite` plugin in `vite.config.js`),
  and `public/_redirects` rewrites `/admin` to it, so a signed-in admin browsing the public
  site can reach the dashboard in one click.
- **PS-036 — unguarded `<img src="">`** — every affected render (`FeaturedStories`,
  `PhotoGallery`, `StoryDetailModal` ×2, `FilmsGallery`) now goes through the new
  `Photo` component (`src/components/Photo.jsx`), which renders a same-sized quiet block
  instead of the browser's broken-image glyph when a source cannot be resolved. This is
  independent of `PS-033`: the guard holds whatever the storage configuration does.

### Phase 6 flow review (2026-09-07) — resolved on `phase-6/flow-review-fixes`

Found by the whole-site review described in the preamble and fixed in the same pass, each with a
failing test first:

- **Stories lightbox opened the wrong photograph.** `StoryDetailModal` forwarded only the clicked
  URL; `App` then fell back to `activeIndex: 0` over the site-wide gallery, so every album thumbnail
  opened the first Gallery photo with a "(1 / N)" counter. The modal now passes the URL, its index,
  and the album, and `FeaturedStories`/`App` pass them through unchanged.
- **"Submit Another Inquiry" led to a permanently disabled form.** The success panel unmounted the
  Turnstile container; `useTurnstile` rendered its widget once per site key and never followed the
  new container, so the second form never received a token and stayed on "Just a moment…" forever.
  The hook now takes a mount `generation` the form bumps in `startOver`.
- **A Turnstile that could not load was a silent dead end** — the spinner ran indefinitely and the
  direct-contact panel only appeared on a *submission* error. The button now says "Verification
  unavailable" and the email/WhatsApp panel renders.
- **Tablet widths (768–1023 px) had no Sign In, no Book Date, and no hamburger** — the corner
  controls are `hidden lg:flex` while the hamburger and drawer were `md:hidden`. Both now switch at
  `lg`.
- **The outage fallback painted on every visit, not only during outages.** `useContent` returned the
  static module synchronously until each query resolved, so every load briefly showed Unsplash stock
  photographs, a placeholder YouTube iframe, and — on About, Stories, and Films — the fabricated
  celebrity attribution `PS-002` tracks. The four content collections now start empty while loading;
  the static module is returned only from the `catch`. The fallback story's "example teaser" URL,
  which pointed at a well-known prank video, now points at the studio's own published film — a
  one-line change adjacent to `PS-002`, whose remaining scope (the celebrity testimonial in the
  fallback and the seeded row) is untouched and still Phase 7's.
- **The intro splash mounted late, over an already-visible page.** `settings.logo` is `null` in the
  fallback, so Home painted first and the splash covered it when the settings row arrived. The Home
  route now waits for the settings query before rendering either.
- **`PS-036`'s claim of "every affected render" had a gap**: the Home grid, hero, portrait, and
  closing images and the More pages still rendered bare `<img>`s. All go through `Photo` now.
- **Film and story cards and album thumbnails were `<div onClick>`s** — unreachable from a keyboard
  or screen reader. They are `role="button"`, focusable, and activate on Enter/Space (the
  `title`-vs-`aria-label` half stays `PS-017`).
- **A route change smooth-scrolled to the top and clobbered back/forward.** `ScrollToTop` now jumps
  instantly and leaves `POP` navigation to the browser's own restoration.
- **The footer WhatsApp icon became a dead `https://wa.me/` link when the number was blank.** It now
  renders unlinked, like the other unset social icons.
- **The form preselected two service names by string** regardless of the admin-managed list, so a
  renamed service was submitted invisibly. The preselection is now filtered by what is offered.
- **No per-route `<title>`.** `DocumentTitle` (new, in `Layout`) names each page; the rest of the SEO
  gap is `PS-045`/`PS-008`.

- **Any admin could make themself owner, or demote or delete the owner.** `profiles_admin_all`
  granted every admin full write access to `public.profiles`, and `is_owner` — the only thing
  `manage-team` checks — was just another column in it: one `PATCH /rest/v1/profiles` with an
  admin's own JWT passed the owner-only gate. `supabase/migrations/20260907120000_profiles_write_lockdown.sql`
  replaces the policy with a select-only `profiles_admin_read` and revokes `insert`/`update`/`delete`
  from `anon` and `authenticated` outright (the browser never wrote `profiles`; `seed-admin`,
  `verify-admin`, and `manage-team` all use the service role). `npm run db:verify` now proves an
  admin cannot set `is_owner` or delete another profile and a client cannot self-promote. The same
  migration adds `client_galleries_access_code_check` (trimmed, 6+ characters) so an admin can no
  longer publish a code the couple can never type.
- **The destructive scripts had no idea whether they were pointed at production.** `seed-db`,
  `load-real-content`, `verify-inquiry`, `verify-admin`, and `verify-db` now refuse unless
  `SUPABASE_URL` is local or `ALLOW_REMOTE_DB=yes` is set (`scripts/lib/assert-local-target.mjs`),
  and `verify-admin` uses a random per-run password and email instead of one committed to the repo.
- **The rate-limit bucket trusted `x-real-ip`**, a header Cloudflare never sets and a client can
  send freely, ahead of the last `x-forwarded-for` hop. `supabase/functions/_shared/client-ip.js`
  now trusts `cf-connecting-ip`, then the last forwarded hop, and nothing else.
- **`manage-team remove` would delete any account with a profile**, not only admins — moot today,
  wrong the day client accounts exist. It now answers `NOT_FOUND` for anything that is not an admin.
- **`/admin/` (and, locally, `/admin`) showed the public site's 404 page.** `public/_redirects`
  rewrote only `/admin`, and the dev server rewrote nothing, so the URL an owner naturally types
  landed on "This page does not exist". Both variants now reach `admin.html` in production and in
  `npm run dev`/`vite preview` (`adminEntryRewrite` in `vite.config.js`).
- **A network blip during a token refresh kicked a signed-in admin to "Admin access required"**
  and unmounted whatever they were editing: every auth event re-ran the profile lookup, and a
  lookup that *threw* was treated like a lookup that *answered* "not an admin". `useSession` now
  keeps an already-authenticated session for the same user when the lookup fails, and still fails
  closed on first sign-in, for a different user, or on a definitive non-admin answer.
- **Bulk "Publish all" had no error handling** — a failure mid-loop was an unhandled rejection that
  left some photographs live and some draft while the summary still read "N draft photos created".
  It now reports "Published X of N — the rest are still drafts" and retries only the remainder; the
  bulk uploader also refreshes the list once per run instead of once per file.
- **Uploads dropped EXIF orientation** on browsers that do not apply it by default —
  `createImageBitmap` now asks for `imageOrientation: 'from-image'` (the same class of bug as the
  26 sideways photographs fixed in commit `d9ccb53`).
- **The client-gallery Retry button leaked an unhandled promise rejection** when the retry failed
  too. Caught; the error state was already rendered by the hook.
- **"Add to Gallery" from the Media Library labelled its create button "Save Changes"** because the
  form treated any prefill as an edit; it now keys on the row having an `id`.
- **The admin could publish an access code the couple could never type** — a 5-character code, or
  one pasted with a trailing space, passed the form's only check (`required`) while the lookup
  requires six trimmed characters. Text fields are now trimmed on submit, `minLength` is enforced in
  the form, and the migration above enforces it in the database too.
- **Reorder, publish, and delete controls stayed live while a reorder was in flight**, so two quick
  clicks launched two interleaving, non-transactional batches computed from a stale order.
  `ResourceList` now takes a `pending` prop every dashboard sets during a list action.
- **Inputs were cleared before the write was confirmed** in the collection video form and the
  category/service managers, losing what the admin typed when the add failed. They now clear only on
  success.

### Phase 5 (SEO) — resolved on `phase-5/seo`

- **`public/_redirects` carried a `/* /index.html 200` catch-all that would have broken the
  first Cloudflare Pages deploy.** The line was written on the belief that static assets take
  precedence over `_redirects` on Pages; Cloudflare's rule is the reverse
  ([developers.cloudflare.com/pages/configuration/redirects](https://developers.cloudflare.com/pages/configuration/redirects/)):
  a matching rule is applied *before* the asset lookup, so every hashed JS/CSS chunk, every
  image, and `robots.txt` itself would have been answered with `index.html`'s bytes — a blank
  page with console errors. The catch-all was never needed: with no `404.html` in the build,
  Pages already serves `index.html` for any unknown path, which is the SPA fallback the
  react-router deep links rely on. The file now holds only the two `/admin` rewrites, and
  `src/test/hostingFiles.test.js` fails if a `/*` rule ever returns. Latent until the first
  deploy, so no visitor was affected.
- **PS-008 — no shareable, indexable per-wedding URL; no prerendering, sitemap, OG images, or
  structured data.** Closed. Every published wedding renders at `/stories/<slug>`
  (`src/pages/StoryPage.jsx` over `src/components/StoryAlbum.jsx`; the cards in
  `FeaturedStories` are real links; `StoryDetailModal` is gone). `npm run build` now runs
  `scripts/prerender.mjs` after `vite build`, which writes a flat `dist/<route>.html` per public
  route — including one per wedding and per More page — carrying its own title, description,
  canonical, Open Graph/Twitter card with the real cover photograph, and JSON-LD
  (`LocalBusiness` + `WebSite` on Home, `ImageGallery` + `BreadcrumbList` on a wedding), a
  visible shell React replaces on mount, plus `sitemap.xml` and `build-info.json`. Design and
  rationale: [the Phase 5 spec](superpowers/specs/2026-09-08-seo-design.md) and
  [ADR 0006](adr/0006-build-time-prerender.md). Proven by `npm run verify:prerender` in CI and
  a browser run against `vite preview`.
- **PS-045 — SEO basics.** Closed: Home has a visible `<h1>` naming the studio and Lucknow, the
  favicon is the studio logo (`public/favicon-32.png`, `favicon-192.png`,
  `apple-touch-icon.png`), every prerendered page carries a canonical link, and
  `index.html`'s meta description is the Lucknow copy in `src/data/seo.js` (a test fails if
  they drift). The `X-Robots-Tag: noindex` header in `public/_headers` is not an issue but the
  deliberate Phase 7 cutover step, and stays.
- **PS-047 — `updated_at` never maintained.** Closed ahead of its planned Phase 7, because the
  sitemap's `lastmod` and the admin's "is this wedding live yet" cue both depend on it:
  `supabase/migrations/20260908130000_site_publish.sql` installs `moddatetime` triggers on
  `weddings`, `site_settings`, and the new `site_publish` table (the only tables that carry
  the column).
- **Content published in the admin could never reach crawlers without a manual deploy.** The
  same migration adds a `site_publish` dirty flag set by triggers on every public content
  table (published rows only), the `request-rebuild` Edge Function fires the Cloudflare Deploy
  Hook it holds as a secret under a 90-second floor with one follow-up build, and the admin's
  Overview shows publish status, dispatches automatically after a 20-second quiet window, and
  offers Rebuild now. Verified end to end against a fake hook.
