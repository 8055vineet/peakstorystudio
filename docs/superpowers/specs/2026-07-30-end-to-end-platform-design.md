# Peak Story Studio — End-to-End Platform Design

- **Date:** 2026-07-30
- **Status:** Approved
- **Scope:** Documentation baseline for the existing frontend, plus the phased backend
  implementation that turns it into a working commercial website.

---

## 1. Context

Peak Story Studio is a wedding photography and cinematography studio. The repository
currently contains a frontend only: a Vite + React 18 + Tailwind single-page application
of roughly 3,200 lines across 26 files, at commit `588cbbd` ("Initial commit").

There is no backend. All content is hardcoded in `src/data/weddingData.js`. All mutable
state is persisted to `localStorage` under three keys (`peak_story_stories`,
`peak_story_photos`, `peak_story_user`). The booking form discards submissions. The client
"portal" accepts any PIN and shows every photo to whoever logs in.

This is a **real business with real clients**, not a portfolio piece. Private client
photographs therefore require genuine access control, storage, and backups.

### Constraints

| Constraint | Source | Consequence |
| --- | --- | --- |
| Minimum cost, prefer free tiers | Stated requirement | Free-tier-first architecture; only the domain costs money |
| Load is low | Stated requirement | No need for scaling infrastructure, caching layers, or queues |
| Solo-maintained | Inferred and confirmed | Prefer managed services over self-hosted; low ops burden |
| Local first, deploy later, domain last | Stated requirement | Phases 0–3 local; Phase 4 deploys; Phase 7 attaches domain |
| Phased with proper documentation | Stated requirement | One spec → plan → build → review cycle per phase, tagged per version |

---

## 2. Decisions

Each of these is recorded as an ADR under `docs/adr/` during Phase 0.

| Decision | Choice | Rejected alternatives | Rationale |
| --- | --- | --- | --- |
| Backend platform | **Supabase** | Firebase, hand-rolled Express + Postgres | Managed Postgres, Auth, Storage, and Row Level Security on a free tier; lowest ops burden for a solo maintainer |
| Frontend strategy | **Keep the Vite SPA; add backend additively** | Migrate to Next.js now; separate Express API | Fastest path to the stated priority (live site taking inquiries). Next.js migration is deferred, not discarded |
| Hosting | **Cloudflare Pages** | Vercel Hobby, Vercel Pro, Netlify | Vercel's Hobby tier forbids commercial use, and this is a commercial site; Cloudflare Pages permits commercial use on its free tier with unlimited bandwidth, which matters for an image-heavy site |
| Inquiry notification | **Email (Resend) + admin dashboard + `wa.me` link** | WhatsApp Business API, SMS | WhatsApp Business API requires Meta business verification, template approval, and per-message fees. A `wa.me` click-to-chat link delivers most of the value at zero cost |
| Media storage | **Deferred to Phase 3** | Decide now | Supabase's free tier provides 1 GB, insufficient for high-res galleries. Cloudflare R2 (10 GB free, zero egress fees) is the likely choice. The decision is not needed before Phase 3 |

### Why shipping the Supabase key in the browser is safe

Row Level Security is enforced by Postgres itself, not by the client. The anonymous key
grants only what RLS policies permit. With the policies in section 5, the anon key can read
published content and nothing else — it cannot write anywhere, and it cannot read the
`inquiries` table at all. The service-role key, which bypasses RLS, never leaves the Edge
Function environment.

---

## 3. Phase and version roadmap

Each phase is a branch, reviewed and merged, then tagged. No phase boundary is crossed with
work half-finished.

| Version | Phase | Deliverable | Definition of done | Runs on |
| --- | --- | --- | --- | --- |
| **v0.1** | 0 — Documentation baseline | Document the frontend as it exists. No behaviour changes. | A new engineer can run and understand the app from the docs alone | local |
| **v0.2** | 1 — Backend foundation | Local Supabase, schema, migrations, content moved to Postgres, data-access layer | App renders identically but from the database; static fallback still works | local |
| **v0.3** | 2 — Inquiries real | Booking form persists; Edge Function emails studio and couple; `wa.me` button; spam protection | A submitted inquiry is in the database, in the studio inbox, and acknowledged to the couple | local |
| **v0.4** | 3 — Admin: auth, CMS, media | Supabase Auth for admin; real CRUD; image uploads; leads dashboard | A wedding can be added and photos uploaded with no code edit and no `localStorage` | local |
| **v0.5** | 4 — First deploy | Hosted Supabase project; Cloudflare Pages deploy; CI/CD; preview deploys | Site reachable on `*.pages.dev`, `noindex` set, deploys on merge | Cloudflare Pages |
| **v0.6** | 5 — SEO and shareable pages | Routing, per-wedding URLs, prerendering, sitemap, OG images, structured data | Every wedding has its own indexable, shareable URL | Cloudflare Pages |
| **v0.7** | 6 — Client proofing portal | Per-client galleries, magic-link auth, persisted favourites, high-res downloads | A couple signs in and sees only their own photographs | Cloudflare Pages |
| **v1.0** | 7 — Domain cutover and go-live | Truthful-content pass, domain, DNS, SSL, backups, privacy policy, analytics, monitoring, performance and accessibility pass; `noindex` removed | Site live on the studio domain, monitored, backed up, nothing fabricated | studio domain |

### Ordering rationale

Phase 1 precedes Phase 2 because inquiries need the database and migration tooling anyway.
Phase 3 precedes deployment so content is never edited by changing code on a live site.
Phase 5 follows deployment because search authority accrues to a domain that exists. Phase 6
is last by the owner's priority call, and it is the phase that incurs real storage cost, so
it lands once the site is already producing enquiries.

### Domain timing

The domain is attached last, as requested. To avoid wasting search authority on a throwaway
URL, Phase 4 sets `noindex` on the `*.pages.dev` deployment; Phase 7 removes it at cutover.

---

## 4. Phase 0 — Documentation baseline

Zero code changes except the `.gitignore` fix in section 4.2.

### 4.1 Deliverables

```
README.md              what it is, quickstart, scripts, stack, project layout
CLAUDE.md              conventions for future agent sessions
docs/
  ARCHITECTURE.md      app shell, render flow, state ownership, section order, styling
  COMPONENTS.md        all 23 components: purpose, props, local state, dependencies
  DATA-MODEL.md        current shape of content plus the three localStorage keys
  DESIGN-SYSTEM.md     palette tokens, type pairing, animation catalogue, radius/spacing
  ROADMAP.md           the table in section 3
  KNOWN-ISSUES.md      audit findings not yet fixed, with severity
  adr/
    0001-record-architecture-decisions.md
    0002-supabase-as-backend.md
    0003-cloudflare-pages-hosting.md
    0004-keep-vite-spa-defer-nextjs.md
    0005-client-state-in-localstorage.md
  superpowers/specs/   this document and future phase specs
```

Deliberately excluded: a `CONTRIBUTING.md` (the maintainer is solo; setup belongs in the
README) and per-component documentation files (a single `COMPONENTS.md` is sufficient at this
size). Both would add ceremony without payoff.

### 4.2 `.gitignore` fix

`.gitignore` currently lists `.env` exactly, which does not match `.env.local` — the file
that will hold Supabase keys in Phase 1. This becomes `.env*` before any key exists.

### 4.3 Known issues to record

Carried forward from the code audit, unresolved as of v0.1:

| Issue | Severity | Location |
| --- | --- | --- |
| Any client PIN unlocks every client's photos | Critical | `AuthModal.jsx`, `ClientGalleryModal.jsx` |
| Fabricated press credentials and real celebrities named as clients | Critical (legal) | `AboutSection.jsx`, `weddingData.js` |
| Booking form reports success unconditionally; submissions discarded | High | `BookingForm.jsx` |
| Base64 uploads in `localStorage` will exceed the ~5 MB quota | High | `ContentManagerModal.jsx` |
| No routing; no shareable or indexable per-wedding URLs | High | app-wide |
| Modals do not trap focus, lock scroll, or close on Escape | Medium | all modals except `LightboxModal` |
| No error boundary | Medium | `App.jsx` |
| `npm run lint` runs `vite build` and lints nothing; no tests exist | Medium | `package.json` |
| Duplicated button and badge markup across ~15 files | Low | app-wide |
| `FilmStrip` and `HorizontalGallery` hardcode their own image arrays | Low | those files |
| Unused `gold-*` palette tokens used only for two icon tints | Low | `tailwind.config.js` |

Four bugs found in the same audit were fixed before this spec and are **not** open issues:
the doubled custom cursor, the client-gallery favourites ID mismatch, unguarded
`JSON.parse` of `localStorage`, and colour-slider resize drift.

---

## 5. Phase 1 — Backend foundation

### 5.1 Local environment

Supabase CLI with Docker provides local Postgres, Auth, Storage, and Studio. Schema changes
are made only through migration files under `supabase/migrations/`, never by editing the
database directly, so local and hosted environments stay reproducible.

### 5.2 Schema

```sql
media
  id uuid pk, storage_path text not null, width int, height int,
  alt_text text not null default '', blurhash text, created_at timestamptz

weddings
  id uuid pk, slug text unique not null, title text not null, couple text not null,
  location text not null, event_date date, summary text,
  cover_media_id uuid references media(id), video_url text, tags text[] default '{}',
  status text not null default 'draft' check (status in ('draft','published')),
  sort_order int default 0, created_at timestamptz, updated_at timestamptz

wedding_photos
  wedding_id uuid references weddings(id) on delete cascade,
  media_id uuid references media(id) on delete restrict,
  sort_order int default 0, primary key (wedding_id, media_id)

gallery_photos
  id uuid pk, media_id uuid not null references media(id), title text not null,
  category text not null, couple text, location text, grid_span text,
  status text not null default 'published', sort_order int default 0

films
  id uuid pk, title text not null, couple text, location text,
  duration_seconds int, thumbnail_media_id uuid references media(id),
  video_embed_url text not null,
  status text not null default 'published', sort_order int default 0

testimonials
  id uuid pk, quote text not null, couple text not null, event text,
  status text not null default 'published', sort_order int default 0

profiles
  user_id uuid pk references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('admin','client')),
  display_name text, created_at timestamptz

inquiries
  id uuid pk, name text not null, email text not null, phone text not null,
  wedding_date date, venue text, services text[] default '{}', message text,
  status text not null default 'new'
    check (status in ('new','contacted','booked','archived')),
  source text default 'website', created_at timestamptz
```

Changes from the current JavaScript shapes, with reasons:

- **`slug`** on `weddings` — Phase 5 needs per-wedding URLs; adding the column now is free.
- **`event_date` as `date`** rather than `"November 2024"` — sortable and locale-formattable.
- **`duration_seconds` as `int`** rather than `"4:32 mins"` — a number, formatted at render.
- **`status`** — allows staging a wedding before it is publicly visible.
- **`sort_order`** — ordering is currently array position in a source file; it must be data.
- **`media` table** — one row per image. `width` and `height` eliminate the layout shift
  identified in the audit. `alt_text` is an accessibility requirement; today `alt` is merely
  the title. `blurhash` supplies the `.img-blur-up` CSS in `src/index.css` that is defined
  but never used. `blurhash` is nullable and populated from Phase 3, when uploads exist.

### 5.3 Row Level Security

RLS is enabled on every table. Policies:

| Table | anon | admin |
| --- | --- | --- |
| `weddings`, `gallery_photos`, `films`, `testimonials` | `SELECT` where `status = 'published'` | full CRUD |
| `media` | `SELECT` | full CRUD |
| `wedding_photos` | `SELECT` where parent wedding is published | full CRUD |
| `inquiries` | none — no read, no write | `SELECT`, `UPDATE` |

`inquiries` grants anon nothing at all. Writes arrive only through the Edge Function in
section 6, which uses the service-role key. This prevents both lead scraping and direct
spam inserts.

**"Admin" must be an explicit role, not merely an authenticated session.** Phase 6 introduces
client sign-in, at which point every couple is also an authenticated user. Policies that test
only for authentication would hand couples full CRUD over site content. Admin policies
therefore key off an explicit role: a `profiles` table holding `user_id` and
`role in ('admin','client')`, with policies testing that role. This table is created in
Phase 1, before any second role exists, so the correct check is in place from the start
rather than retrofitted under pressure in Phase 6.

### 5.4 Frontend data-access layer

```
src/lib/supabase.js         client singleton
src/lib/queries/*.js        getPublishedWeddings(), getWeddingBySlug(), createInquiry(), …
src/hooks/use*.js           expose { data, loading, error }
```

Components call hooks; hooks call queries; queries call Supabase. No component imports the
Supabase client directly. This keeps components testable against mocked hooks and confines a
future Next.js migration or API swap to a single layer.

### 5.5 Migration and rollback

Content in `src/data/weddingData.js` is seeded into the database by a checked-in seed script.
An environment variable `VITE_DATA_SOURCE` (`static` | `supabase`) selects the source, so the
site still renders from the static file if the database misbehaves during migration.

This flag is temporary scaffolding. It is **removed in Phase 3**, once the database is
authoritative, so it does not calcify into permanent complexity.

---

## 6. Phase 2 — Inquiries

### 6.1 Flow

1. `BookingForm` validates input client-side and submits.
2. The browser calls the `submit-inquiry` Edge Function — the only write path.
3. The function re-validates server-side, because client validation is not a control.
4. It inserts the row using the service-role key.
5. It calls Resend twice: a notification to the studio, and an acknowledgement to the couple.
6. It returns success or a typed error to the browser.

Secrets (`RESEND_API_KEY`, service-role key, `STUDIO_NOTIFY_EMAIL`) live in Edge Function
secrets and never reach the browser bundle.

A single Edge Function is preferred over a database webhook because it gives one entry point,
server-side validation before any write, and no dependency on webhook delivery.

### 6.2 Spam protection

All free: a honeypot field, Cloudflare Turnstile, and per-IP rate limiting inside the
function. Turnstile is free and works independently of where the site is hosted, so it can be
wired in Phase 2 while the site is still local; it also aligns with the Cloudflare Pages
hosting chosen for Phase 4.

### 6.3 WhatsApp

A `wa.me` click-to-chat button, which requires no API, no approval, and no fee. The WhatsApp
Business API is explicitly out of scope unless the free path proves insufficient.

### 6.4 Error handling

`BookingForm` currently sets `submitted` to `true` unconditionally, so a failure would still
show success and the lead would be lost silently. Replacement behaviour:

- Inline field-level validation messages.
- A pending state; the submit button is disabled while the request is in flight.
- On failure, an explicit error that offers the studio email address and the `wa.me` link, so
  an inquiry is never silently swallowed.

Content sections get loading skeletons rather than spinners, matching the editorial design,
and an error state that falls back to the last known content rather than rendering blank. A
React error boundary is added at the application root; the app currently has none.

### 6.5 Implementation decisions (added 2026-07-31, before Phase 2 began)

Sections 6.1–6.4 settle the shape of the inquiry pipeline. These are the choices that shape
left open, each verified against the local stack rather than assumed.

**The Edge Function is written in plain JavaScript, not TypeScript.** Supabase's convention is
`index.ts`, but the repo's standing rule is that this project has no TypeScript. Registering
`entrypoint = "./functions/submit-inquiry/index.js"` under `[functions.submit-inquiry]` in
`supabase/config.toml` makes the CLI serve a `.js` entrypoint; this was confirmed working
against edge-runtime v1.74.2 before the plan was written, as were `npm:` import specifiers,
the automatically injected `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and service-role
database access from inside the function. The rule about TypeScript survives Phase 2 intact.

**Validation rules have one home, shared by both sides.**
`supabase/functions/_shared/inquiry-validation.js` is the single source; the function imports
it relatively and the browser imports it through a `@shared` Vite alias. Two copies of the same
rules drift, and drift here shows the couple an inline message the server then contradicts.
`_shared` is Supabase's documented convention for code a function depends on, so this costs
nothing at deploy time.

**Testing uses Vitest, not Deno's test runner.** Section 7 named `deno test` as the Edge
Function gate. Deno is not installed on the development machine and a second test runner plus a
CI toolchain is real cost, so the validation, Turnstile, and email modules are written as pure
modules with injectable `fetch`, and Vitest — which already transpiles and runs them — covers
them. The response contract is covered instead by an end-to-end check that posts to the running
function and asserts the row reached Postgres, which tests the real runtime rather than a
simulation of it.

**Rate limiting is a Postgres ledger keyed by a salted hash of the IP.** Edge Functions are
stateless, so the counter needs storage; `inquiry_rate_limits` holds a SHA-256 of
`salt:ip`, never the address, so the table carries nothing directly identifying. A single
`consume_inquiry_rate_limit()` function does the read, window roll, and increment in one
atomic upsert, so two simultaneous requests cannot both pass a limit that admits one.

**Rate limiting fails open; the captcha fails closed.** If no client IP can be determined from
the request headers, the function skips the rate-limit check and logs it, rather than hashing a
constant and dropping every visitor into one shared bucket — that failure mode blocks paying
customers, which is worse than admitting spam. Turnstile is the actual spam control and takes
the opposite stance: a missing `TURNSTILE_SECRET_KEY` is a server error, not a bypass.
Cloudflare publishes always-pass test keys that need no account, so local development runs with
the captcha genuinely enabled rather than switched off.

**Email degrades; the row never does.** A lead is persisted before any email is attempted, and
a Resend failure or a missing `RESEND_API_KEY` never turns a saved inquiry into an error for
the couple. The outcome is recorded on the row as `notification_status`, so Phase 3's admin
view can show which inquiries the studio was never actually told about. Without that column a
silent Resend outage is indistinguishable from no inquiries at all.

**Anything unconfirmed stays out of the bundle.** The WhatsApp number comes from
`VITE_WHATSAPP_NUMBER` and the button does not render when it is unset, so Phase 2 ships
without hard-coding a contact number the studio has not yet confirmed. The same applies to the
studio notification address.

---

## 7. Quality gates

Applied from Phase 1 onward; every later phase must pass them.

| Gate | Tool | Covers |
| --- | --- | --- |
| Lint | ESLint with a real config | `npm run lint` currently runs `vite build` and lints nothing |
| Unit | Vitest + React Testing Library | query layer against a mocked client, form validation, hooks |
| Edge Function | Deno test | validation logic and response contract |
| End-to-end | Playwright | submit an inquiry, assert the row reaches the local database |
| CI | GitHub Actions | lint, test, and build on every pull request |

The Playwright inquiry test is the highest-value test in the project: it exercises the one
path where a failure costs the business money.

### Secrets handling

- `.env.local`, git-ignored, holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `.env.example`, committed, documents required variables without values.
- `.gitignore` uses `.env*` (see section 4.2).
- The service-role key exists only in Edge Function secrets.

---

## 8. Out of scope

Recorded so these are decisions rather than omissions:

- Payments, invoicing, and contracts.
- Multi-user studio accounts and per-photographer roles; admin is a single account.
- Automated image watermarking (revisit in Phase 6).
- WhatsApp Business API notifications.
- Next.js migration (Phase 5 will reassess; static prerendering with `vite-react-ssg` is the
  lighter candidate).
- Internationalisation.
- A TypeScript migration. The codebase is plain JavaScript and stays that way for now;
  converting mid-project costs more than it returns at this size. Revisit if the data-access
  layer or schema starts producing shape-mismatch bugs.

---

## 9. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Free-tier storage insufficient for client galleries | Blocks Phase 6 | Storage decision deferred to Phase 3; Cloudflare R2 (10 GB, zero egress) is the leading candidate |
| Fabricated press claims and celebrity names on a live commercial site | Legal and reputational | Truthful-content pass is a blocking task in Phase 7, before the domain goes live |
| Supabase free-tier projects pause after inactivity | Site content fails to load | Site is in active use once live; monitoring added in Phase 7 |
| SPA has no server rendering, weakening search visibility | Slower client acquisition | Phase 5 adds prerendering; `noindex` on the temporary URL prevents wasted indexing |
| Client photographs are sensitive personal data | Privacy breach | RLS from Phase 1; magic-link auth replaces the shared PIN in Phase 6; privacy policy in Phase 7 |

---

## 10. How this document relates to later phases

This document is the umbrella design. It settles the roadmap, the platform decisions, and the
detailed design for Phases 0, 1, and 2 — enough to implement through v0.3.

Phases 3 through 7 are deliberately sketched rather than specified. Each gets its own spec at
the time it is started, because decisions taken then depend on what the earlier phases reveal:
the storage choice in Phase 3 depends on real image sizes, and the Phase 5 rendering decision
depends on measured search performance. Specifying them now would be guessing in detail.

## 11. Immediate next step

Phase 0. Its implementation plan is written separately by the planning skill and lands in
`docs/superpowers/plans/`.
