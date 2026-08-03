# Admin CMS Completion (Phase 3c, v0.4c) — Design

**Date:** 2026-08-04
**Phase:** 3c — Admin CMS completion · branch `phase-3c/admin-cms` · tag `v0.4c`
**Status:** Approved in conversation; this document records the decisions.

## 1. What and why

The admin can already CRUD every *collection* (weddings, gallery photos, films, testimonials,
leads), but the site's *singular* content — the Home quote, the Brand Story, the three Home
images, the contact details, the social links — lives hardcoded in the repo
(`src/data/homeContent.js`, `src/data/contact.js`, `public/images/home/*`). The owner wants a
standard premium arrangement: **everything a visitor sees is editable through the admin**, and
the admin workflow smoothed where it confused them in practice (uploading a photo did not lead
anywhere; created records sat as invisible drafts; selection gave no feedback — the last is
already fixed).

Everything stays local-only; nothing here depends on Phase 4, and all of it deploys unchanged.

## 2. Decision: a `site_settings` table

One typed row in Postgres, read by the public site like all other content, edited through a
new admin Settings tab.

Rejected alternatives: the admin writing to the code files (no security boundary, drifts from
git, needs server-side file access the stack doesn't have) and a key-value JSONB blob (loses
the per-field typing and explicit empty-value handling that the `PS-034` class of bug proved
this admin needs).

### Schema (new migration in `supabase/migrations/`)

```sql
create table public.site_settings (
  id int primary key default 1 check (id = 1),   -- exactly one row, forever
  quote_text text not null,
  quote_credit text not null,
  brand_story_heading text not null,
  brand_story_p1 text not null,
  brand_story_p2 text not null,
  hero_media_id uuid references public.media(id),
  brand_story_media_id uuid references public.media(id),
  closing_media_id uuid references public.media(id),
  studio_address text not null,
  studio_email text not null,
  studio_phone text not null,
  whatsapp_number text not null default '',      -- digits only; '' hides the button
  instagram_url text not null default '',        -- '' renders the icon unlinked
  youtube_url text not null default '',
  updated_at timestamptz not null default now()
);
```

- The migration **seeds the row with the current real values** (the confirmed Lucknow contact
  details, the approved quote and Brand Story text) so `npm run db:reset` reproduces a working
  site with no extra step. The three `*_media_id` columns seed as `null`.
- **RLS:** `select` for everyone (the public site reads with the anon key); `update` only for
  authenticated admins, using the same admin-profile predicate the content tables already use;
  no `insert`/`delete` policies at all — the row is created by the migration and the
  `check (id = 1)` keeps it singular.
- `scripts/load-real-content.mjs` gains a step: register the three existing Home images
  (`/images/home/hero.jpg`, `brand-story.jpg`, `closing.jpg`) as `media` rows (with the
  current alt text) and point the three `*_media_id` columns at them, so the Settings form
  shows real selections from day one and the site looks identical until the owner changes
  something.

## 3. Public read path

- `src/lib/queries/siteSettings.js` — `getSiteSettings()` selects the row (joining the three
  media references) and maps it to the shape components consume:

```js
{
  quote: { text, credit },
  brandStory: { heading, paragraphs: [p1, p2] },
  images: {
    hero: { src, alt },        // publicMediaUrl(media.storage_path); falls back to the
    brandStory: { src, alt },  // static /images/home/... path when its media id is null
    closing: { src, alt },
  },
  contact: { address, email, phone, whatsappNumber, instagramUrl, youtubeUrl },
}
```

- `useSiteSettings` joins the other wrappers in `src/hooks/useContent.js`, with a fallback
  object built from the existing constants in `homeContent.js` and `contact.js` — the same
  stale-beats-blank resilience as every other section. Those two modules stay, re-commented as
  **fallback-only**; components stop importing them directly.
- **Data flows as props, per the standing convention.** `App` calls `useSiteSettings` once and
  passes slices down: `HomePage` gets `quote`/`brandStory`/`images`; `AboutPage` gets
  `brandStory` + the portrait image; `Layout` passes `contact` to `Footer`; `ContactPage`
  passes `contact` to `BookingForm`, which forwards the number to `WhatsAppButton` (both keep
  their current constant-based defaults so they render sensibly when unwired, e.g. in tests).
  `ErrorBoundary` alone keeps reading the email constant — it is the crash screen, shown
  precisely when the database cannot be trusted to answer.

## 4. The admin, reworked

Tab order becomes: **Dashboard · Leads · Media Library · Weddings · Gallery · Films ·
Testimonials · Settings**, plus a **View website** link (opens `/` in a new tab) in the admin
header next to Sign Out.

### Dashboard (new, the landing tab)

- Counts, each fetched with a cheap `head: true` count query (`src/lib/queries/adminOverview.js`):
  new leads (`status = 'new'`), and published/draft counts for weddings, gallery photos,
  films, and testimonials.
- Each count is a button that jumps to its tab. A prominent "New lead waiting" callout renders
  only when the new-leads count is above zero.

### Settings (new)

- One form, two visual sections (Home content; Contact & social), reusing the admin's
  existing field classes. The three image slots reuse `UploadField` + `MediaPicker` (with the
  `selectedId` highlight) exactly like `ResourceForm`'s media field.
- Validation before save: required text fields non-empty; email must pass the same permissive
  pattern the inquiry validator uses; WhatsApp number digits-only (or empty); social URLs must
  start `http(s)://` (or be empty).
- Save calls `updateSiteSettings(values)` (`src/lib/queries/adminSettings.js`, an
  `update ... eq('id', 1)`), then shows the same saved/error affordances other admin forms use.

### Workflow polish

- **Media Library → "Add to Gallery":** every media card in the standalone library gets an
  Add-to-Gallery button. Clicking it switches to the Gallery tab with the create form open and
  that photograph pre-selected (admin `App` holds a `galleryPrefill` media id, hands it to the
  gallery section, which clears it once consumed). The confusing dead-end — upload lands in a
  drawer and nothing suggests the next step — disappears.
- **Draft state made loud:** `ResourceList`'s status cell becomes a badge — amber outline
  `DRAFT`, filled `PUBLISHED` — and after every successful create, a banner renders above the
  list: "Saved as draft — publish when ready", with a publish button for the new row inline.
  `makeResourceQueries.create()` returns the created row's id to make that button possible.

## 5. Testing

- Unit: settings query mapping (including null-media fallback to static paths), admin
  overview counts, `SettingsForm` (renders seeded values, validates, saves, error paths),
  Dashboard (counts render, lead callout only when > 0), Add-to-Gallery prefill flow,
  draft-badge + post-create banner, `useSiteSettings` fallback on query failure.
- `npm run verify:admin` gains a settings leg: update the quote through the admin client,
  read it back through `getSiteSettings()` (the public path), assert, restore the original.
- Existing suites stay green; public component tests updated where props replace constant
  imports.

## 6. Documentation

`docs/DATA-MODEL.md` (new table + policies), `docs/ARCHITECTURE.md` (settings flow, new admin
tabs), `docs/ROADMAP.md` (Phase 3c row, `v0.4c`), `src/data/homeContent.js` and
`src/data/contact.js` re-commented as fallback-only. `docs/COMPONENTS.md` rows for
`Footer`/`BookingForm`/`WhatsAppButton`/pages updated to name their new props.

## 7. Out of scope

- Multiple admin users, roles, or an audit/edit history.
- Drag-and-drop page building or reordering of Home sections.
- Film video uploads (needs Phase 4 hosting) and the parked hover-tilt effect.
- Editing the navbar labels, footer service marks, or petals behavior.
- SEO metadata editing (Phase 5 owns SEO).
