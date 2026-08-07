# Home & Chrome Polish (Phase 3g, `v0.4g`) — Design

**Date:** 2026-08-07
**Status:** Approved by owner (font control = separate Heading/Body pickers; video = full content width; both chosen explicitly)
**Branch:** `phase-3g/home-chrome-polish`

## 1. Scope

Four owner-requested changes, one branch:

1. **Admin font control** — pick the site's Heading and Body fonts from curated sets, applied site-wide.
2. **Revert the custom cursor** — the native pointer returns everywhere.
3. **Home video rework** — the block becomes the embedded YouTube player: full content width, 16:9, YouTube's own thumbnail/player (nothing hardcoded), **autoplaying on load** (Home only).
4. **Responsive verification** across phone, tablet, and desktop.

Standing constraints apply: plain JS, Tailwind tokens, components-call-hooks, schema changes only in `supabase/migrations/` applied with `supabase migration up` (never `db:reset` — real data), content tolerates empty lists, no fabricated content, doc accuracy enforced by `npm run check:docs`.

## 2. Admin font control

**Curated fonts** (`src/data/fontOptions.js`, pure data — no imports of the Supabase client):
- `HEADING_FONTS`: Cormorant Garamond (default), Playfair Display, EB Garamond, Libre Baskerville, Marcellus, Cinzel.
- `BODY_FONTS`: Plus Jakarta Sans (default), Inter, Lato, Montserrat, Work Sans, Nunito Sans.
- Each entry `{ value, label }` where `value` is the exact CSS family name stored in the database. Also exports `DEFAULT_HEADING_FONT = 'Cormorant Garamond'`, `DEFAULT_BODY_FONT = 'Plus Jakarta Sans'`, and `isKnownFont(value, role)` (defensive lookup).
- All non-currently-loaded families are added to `index.html`'s Google Fonts `<link>` (modest weights). Payload optimization is deferred to Phase 7's performance pass.

**Data:** migration `supabase/migrations/20260807110000_settings_fonts.sql` adds to `site_settings`:
`heading_font text not null default 'Cormorant Garamond'`, `body_font text not null default 'Plus Jakarta Sans'`.
No RLS change (the row's existing read-all / admin-update policies already cover new columns).

**Read/write:** `src/lib/queries/siteSettings.js` `SETTINGS_SELECT` gains `heading_font, body_font`; `getSiteSettings()` returns `fonts: { heading, body }`. `src/lib/queries/adminSettings.js` `COLUMNS` gains the two columns (so `getSettingsRow`/`updateSiteSettings` round-trip them). `src/data/siteSettingsFallback.js` gains `fonts: { heading: DEFAULT_HEADING_FONT, body: DEFAULT_BODY_FONT }`.

**Apply (public site only):** Tailwind's two public type roles become CSS-variable-driven in `tailwind.config.js`:
`garamond: ['var(--font-heading, "Cormorant Garamond")', 'serif']`, `sans: ['var(--font-body, "Plus Jakarta Sans")', 'sans-serif']`. `font-script` (Home quote) and `font-cinzel` (admin-only) stay fixed. `src/App.jsx` (the public app) sets the two variables from `settings.fonts` in an effect:
`document.documentElement.style.setProperty('--font-heading', '"' + heading + '"')` (and body), guarded so an absent `settings.fonts` leaves the Tailwind fallback in place. The admin app never sets these variables, so its `font-sans` keeps resolving to the Plus Jakarta Sans fallback — no admin regression.

**Admin UI:** `src/admin/SettingsForm.jsx` gains a "Typography" section (before Contact & Social) with two `<select>`s — Heading font and Body font — options from `fontOptions`, each `<option>` styled in its own family for a live preview. The values join the existing `values` object as `headingFont`/`bodyFont`; validation requires each to be a known value (defensive, since a select can only offer known ones). `SettingsDashboard` already threads the whole row, so no dashboard change beyond the row carrying two more fields.

## 3. Revert the custom cursor

- `src/components/Layout.jsx`: remove the `CustomCursor` import and element. The native cursor returns.
- Delete `src/components/CustomCursor.jsx` and `src/components/__tests__/CustomCursor.test.jsx`.
- `src/index.css`: remove the custom-cursor block (`.custom-cursor-active`, `.cursor-dot`, `.cursor-ring`, `.cursor-ring-engaged`, and the `cursor: none` media rule). `PetalsBackground` styling below is untouched.
- `docs/COMPONENTS.md`: remove the `CustomCursor` row and add `CustomCursor` to the deleted-components note (the note already records its earlier return — it now records its removal in Phase 3g).
- The `matchMedia` stub in `src/test/setup.js` stays (harmless; not cursor-specific).

## 4. Home video rework

**New util `src/lib/youtube.js`:**
- `youtubeId(url)` — extracts the 11-char id from any YouTube form: `youtube.com/embed/ID`, `watch?v=ID`, `youtu.be/ID`, `youtube.com/shorts/ID`, each with or without extra query/hash. Returns `null` when none found.
- `youtubeEmbedUrl(url, { autoplay = false } = {})` — when an id is found, builds
  `https://www.youtube.com/embed/{id}` with params: always `rel=0&playsinline=1`; when `autoplay`, adds `autoplay=1&mute=1` (muted is the only autoplay browsers permit). When no id is found (a non-YouTube embed), returns the original `url` unchanged so other providers still work.

**New component `src/components/HomeVideo.jsx`:** `HomeVideo({ film })`.
- With a film: a full-content-width, `aspect-video`, `overflow-hidden` container holding an autoplaying `<iframe>` (`src = youtubeEmbedUrl(film.videoEmbedUrl, { autoplay: true })`, `title = film.title`, `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`, `allowFullScreen`, absolutely positioned to fill the 16:9 box). YouTube's player supplies its own thumbnail/poster while loading — nothing hardcoded.
- Without a film: the existing "Video to be added" placeholder, same box.
- Width: `max-w-6xl mx-auto px-4 sm:px-6` (wider than the old `max-w-5xl`), `aspect-video` so it never letterboxes and scales cleanly from desktop down to phone.

**`src/pages/HomePage.jsx`:** the inline video `<section>` becomes `<HomeVideo film={featuredFilm} />`. The `onOpenVideo` prop and the `Play` import are dropped from HomePage (the Home video no longer opens the modal). `src/App.jsx` stops passing `onOpenVideo` to `HomePage` (the modal stays for `FilmsPage`/`StoriesPage`, which keep click-to-play — this change is Home-only).

## 5. Testing

- `src/lib/__tests__/youtube.test.js` (new): id extraction across all URL forms + `null` for non-YouTube; `youtubeEmbedUrl` builds the muted-autoplay URL and passes a non-YouTube url through unchanged.
- `src/components/__tests__/HomeVideo.test.jsx` (new): renders an iframe whose `src` contains `autoplay=1` and `mute=1` and the film's video id; placeholder when `film` is null.
- `src/pages/__tests__/HomePage.test.jsx` (update): the video is now an autoplaying iframe (assert the iframe/title), not a play-button-to-modal; drop the `onOpenVideo` assertion.
- `src/components/__tests__/Layout.test.jsx` (update if it asserts CustomCursor): no custom cursor rendered.
- Delete `src/components/__tests__/CustomCursor.test.jsx`.
- `src/admin/__tests__/SettingsForm.test.jsx` (update): the Typography selects render with the current values; changing Heading font submits `headingFont`.
- `src/lib/queries/__tests__/adminSettings.test.js` and `siteSettings.test.js` (update): the two font columns round-trip; `getSiteSettings` returns `fonts`.
- `src/__tests__/App.routes.test.jsx` and `src/admin/__tests__/App.test.jsx` (update): the `useSiteSettings`/`getSettingsRow` mocks gain `fonts` / the two columns; a public-App assertion that the `--font-heading` variable is set from settings.
- Live smoke (Playwright): Home page at 390 / 820 / 1280 px — the video fills the width and keeps 16:9; screenshot each and LOOK. Confirm the native cursor (no `cursor: none`). In the admin, change Heading font in Settings, save, reload Home, confirm the heading font changed; then restore it (owner's real database — leave nothing changed).

## 6. Docs

`docs/DATA-MODEL.md` (the `site_settings` columns now include the two fonts), `docs/ARCHITECTURE.md` (one sentence: public type roles are CSS-variable-driven from settings; the custom cursor was removed; the Home video autoplays its embed), `docs/COMPONENTS.md` (remove CustomCursor row, add HomeVideo row, note the cursor removal), `docs/ROADMAP.md` (`v0.4g` row + a Phase 3g paragraph). `npm run check:docs` enforces.

## 7. Out of scope (deliberate)

- The Home-quote script face and the admin's own `font-cinzel` stay fixed.
- No per-page font overrides; one heading font and one body font, site-wide.
- The Films/Stories video modal is unchanged (still click-to-play); only Home autoplays.
- No sound-on autoplay (browsers forbid it) — Home video autoplays muted with the player's unmute control.
- No font-file self-hosting; curated families load from Google Fonts as today (revisit in Phase 7).

## 8. Phase mechanics

Branch `phase-3g/home-chrome-polish`; Conventional Commits; migration via `supabase migration up`; full gates (`npm test`, `npm run lint`, `npm run check:docs`, `npm run build`) plus the live smoke before merge; merge to `main` locally and tag `v0.4g`.
