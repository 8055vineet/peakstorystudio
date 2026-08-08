# Home Hero, Peaks, Logo & Navbar (Phase 3h, `v0.4h`) — Design

**Date:** 2026-08-08
**Status:** Approved by owner (hero = Option 1 "range beneath the name", tagline "by abhinav", logo admin-uploadable + circular, video stays in its current spot).
**Branch:** `phase-3h/home-hero-logo-navbar`

## 1. Scope

1. **Home quote font → Dancing Script** (the quote and its credit; the decorative `font-script` role, used only here and in the new hero tagline).
2. **Home video → full-width cinematic hero band**: the film plays muted, looping, no controls, dimmed, spanning the full screen width, overlaid with **PEAK STORY STUDIO** + a fine mountain range + **"by abhinav"** (Dancing Script). Stays in its current position (just below the quote); the top hero image is unchanged. Full films stay playable (with sound) on the Films page.
3. **Studio logo → admin-uploadable**, rendered as a circular badge in the navbar before the wordmark.
4. **Navbar restyle** — classier lockup and alignment.

Standing constraints apply: plain JS, Tailwind tokens (`font-cinzel`/`gold-*` admin-only), components-call-hooks, schema changes only in `supabase/migrations/` applied with `supabase migration up` (never a reset — real data), doc accuracy enforced by `npm run check:docs`, no fabricated content.

## 2. Quote font → Dancing Script

`font-script` is repointed in `tailwind.config.js` from Great Vibes to Dancing Script:
`script: ['Dancing Script', 'cursive']`. `index.html`'s Google Fonts link swaps `Great+Vibes`
for `Dancing+Script:wght@400;500;600;700` (Great Vibes is no longer used anywhere). The Home
quote and credit keep their existing `font-script` classes, so no component change is needed
beyond the config; the hero tagline (below) uses the same role. Sizes unchanged.

## 3. Home video → cinematic peaks hero

**`youtube.js`** gains a `background` option on `youtubeEmbedUrl(url, { autoplay, background })`:
when `background` is true it returns an embed URL with
`autoplay=1&mute=1&loop=1&playlist={id}&controls=0&modestbranding=1&playsinline=1&rel=0` (loop
requires `playlist={id}`; `controls=0` for the ambient look). Existing `autoplay` behaviour is
unchanged; `background` implies muted autoplay.

**`HomeVideo`** (`src/components/HomeVideo.jsx`, reworked) becomes the full-width cinematic band:

- Outer `<section className="w-full">`; inner `relative w-full aspect-video overflow-hidden
  bg-pitch-950`. **Full viewport width, natural 16:9 height** — "fit to the screen width" with no
  cropping or letterboxing (the iframe box is itself 16:9). The site body already clips
  horizontal overflow, so full width never adds a scrollbar.
- With a film: an `<iframe absolute inset-0 w-full h-full>` at `youtubeEmbedUrl(film.videoEmbedUrl,
  { background: true })`, `title={film.title}`, `allow="autoplay; encrypted-media; picture-in-picture"`,
  `tabIndex={-1}` (ambient, not a focus stop). A gradient scrim (`bg-gradient-to-b` from
  `pitch-950/45` → `pitch-950/20` → `pitch-950/60`) sits over it. **No player controls** — the full
  film remains watchable with sound on the Films page.
- Without a film: the same band on `bg-pitch-950` with the overlay only (no iframe). The public
  never sees a "Video to be added" note; the branded overlay is the graceful empty state.
- **The overlay** (a small local `PeaksOverlay`, absolute `inset-0`, flex-centered, `pointer-events-none`,
  `text-offwhite-50`): the wordmark **Peak Story Studio** in `font-garamond` uppercase, letterspaced;
  beneath it the Option-1 two-line mountain-range **inline SVG** (stroke `currentColor`, responsive
  width `min(520px,64vw)`); beneath that **"by abhinav"** in `font-script` (Dancing Script). Name
  and tagline are fixed brand strings (constants in the component). The SVG is decorative
  (`aria-hidden`); the band carries an `aria-label="Peak Story Studio"` for the accessible name.

**Tests:** `HomeVideo.test.jsx` — background iframe src contains `loop=1`, `controls=0`, and the
video id; the name and "by abhinav" render; placeholder band (no iframe) when `film` is null.
`HomePage.test.jsx` — updated to the new overlay (no play button/modal), still shows the name.

## 4. Admin-uploadable logo (circular navbar badge)

**Migration** `supabase/migrations/20260808100000_settings_logo.sql`: adds
`logo_media_id uuid references public.media(id)` to `site_settings` (nullable — there is no
shipped default logo). Existing read-all / admin-update policies cover it.

**Read/write:** `siteSettings.js` `SETTINGS_SELECT` gains `logo:logo_media_id (storage_path)`, and
`getSiteSettings()` returns `logo: data.logo?.storage_path ? publicMediaUrl(data.logo.storage_path)
: null` (a URL string, or `null`). `adminSettings.js` `COLUMNS` gains `logo_media_id` (round-trips
as `logoMediaId`). `siteSettingsFallback.js` gains `logo: null`.

**Admin UI:** `SettingsForm.jsx`'s `IMAGE_SLOTS` gains a fourth slot
`{ key: 'logoMediaId', label: 'Logo', help: 'Shown as a circular badge in the navbar. A square image works best.' }`
— it reuses the existing `MediaSlot` upload/pick flow, so the logo is uploaded exactly like the
Home images. Optional (nullable), so it keeps its Remove button.

**Navbar:** `Navbar` gains a `logo = null` prop (URL or null), threaded App → `Layout` → `Navbar`
(Layout already forwards `contact`/`morePages`). When present, a circular badge renders
immediately before the wordmark: `<img src={logo} alt="" className="w-10 h-10 rounded-full
object-cover ..."/>` inside the centered lockup. When null, the wordmark stands alone (today's
look). App passes `settings.logo`.

## 5. Navbar restyle

Purely presentational polish, keeping the owner-approved centered structure:

- The wordmark and (when set) the circular logo form one centered **lockup** (logo + wordmark in a
  centered flex row, small gap), with the logo circle carrying a hairline `ring-1 ring-pitch-900/15`.
- Slightly refined vertical rhythm and a hairline divider under the nav row; the six links keep
  their row beneath, the More dropdown unchanged; the Sign In / Book Date corner controls keep their
  positions with tidied spacing. Existing palette tokens only; no new hex.
- Mobile: the logo appears beside the wordmark in the drawer header; alignment verified.

**Tests:** `Navbar.test.jsx` — a circular logo image renders (with the lockup) when `logo` is
provided and is absent when null; existing nav/More/mobile tests still pass.

## 6. Data flow through App

`App` reads `settings` from `useSiteSettings` (already). It passes `logo={settings.logo}` to
`Layout` (→ `Navbar`). The `settings.logo`/`fonts` etc. shape is extended in the `App.routes.test`
and admin `App.test` mocks. No new stateful component.

## 7. Testing & verification

- Unit: youtube `background` option; `HomeVideo` overlay + background src + placeholder; `Navbar`
  logo badge; `SettingsForm` logo slot; `siteSettings`/`adminSettings` logo column; the App mocks
  gain `logo`.
- Full gates: `npm test`, `npm run lint`, `npm run check:docs`, `npm run build`.
- Live smoke (Playwright): Home at 390/820/1280 — the video spans full width with the name + peaks
  overlay and no sideways scroll; the quote is Dancing Script. In the admin, upload a logo in
  Settings, reload Home, confirm the circular badge in the navbar; then remove the probe logo
  (owner's real database — leave it as found). LOOK at the screenshots.

## 8. Out of scope (deliberate)

- The hero tagline "by abhinav" and the wordmark are fixed brand strings (not admin-editable this
  phase); the quote credit stays admin-editable and unchanged in content.
- No self-hosted background video (Phase 4 hosting); the ambient hero is the YouTube embed, which
  keeps faint YouTube branding at the edges.
- The Films/Stories pages' click-to-play modal is unchanged.
- No logo in the admin app's own header (the admin is a tool, not the brand surface).

## 9. Phase mechanics

Branch `phase-3h/home-hero-logo-navbar`; Conventional Commits; migration via `supabase migration
up`; full gates + live smoke before merge; merge to `main` locally and tag `v0.4h`. Docs:
DATA-MODEL (the logo column), COMPONENTS (`HomeVideo` rework, `Navbar` logo prop, `Layout` logo
forward), ARCHITECTURE (one line), ROADMAP (`v0.4h` row + paragraph).
