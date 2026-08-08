# Phase 3j — Fixes, Fonts & Polish (design)

**Version:** `v0.4j` · **Branch:** `phase-3j/fixes-and-fonts` · **Date:** 2026-08-09

A punch-list phase: two bug fixes and several owner-requested refinements. Root causes for both
bugs were established first (systematic-debugging), with live evidence from the running DB and
dev server.

## The seven items

### 1. Video won't add in a More page — **fix (client-side)**
Root cause confirmed against the DB: photo-adds work (7 photos in the "Model Shoot" collection),
and a direct `collection_items` video insert succeeds — the schema, RLS, and `useResource.mutate`
path are all fine. The gap: the admin video form (`CollectionItems.jsx`) demands a pre-formatted
`/embed/` URL and validates only an `http` prefix, and the public page frames whatever raw URL
was stored. A normal `youtu.be/…` / `watch?v=…` link (what people paste) trips the form or
"refuses to connect" on playback. **Fix:** route it through the existing `src/lib/youtube.js`
normalizer, exactly as the homepage already does —
- Admin form: accept any recognizable YouTube link (validate via `youtubeId(url)` non-null),
  store the normalized embed URL (`youtubeEmbedUrl(url)`), and reword the help text.
- Public video modal (`App.jsx` iframe `src`): normalize with `youtubeEmbedUrl(...)` as
  defense-in-depth, so every video-modal consumer (Films, Stories, Collections) and any
  already-stored raw URL plays.

### 2. Background-warmth slider "not working" — **no code change; environmental**
Root cause confirmed: the saved value is in the DB (`surface_warmth: 0`), and the production
build binds the token (`var(--offwhite-100, #faf9f6)`), but the **running dev server's CSS still
has the literal hex** (zero `var(--offwhite-*)` occurrences) — a `tailwind.config.js` change
needs the dev server to regenerate, which a long-running `npm run dev` hadn't. **Resolution:
restart `npm run dev`.** No code is wrong. (Noted for the owner: the *cool* end ≈ today's cream;
drag toward ivory for an obvious change.)

### 3. Remove the Home video overlay — **change**
Delete the overlay from `HomeVideo.jsx`: the "PEAK STORY STUDIO" wordmark, the hand-drawn
`Peaks` mountain SVG, and the "by abhinav" tagline. Keep the ambient, full-width, looping video
(and its dark band when no film). The band keeps an `aria-label` for its accessible name.

### 4 + 5. Fonts: a Quote role + more families — **feature**
Extend the Phase 3g font control from two roles to **three** (heading, body, **quote**), and
widen every menu with famous families. The Home quote (today fixed to Dancing Script via the
`font-script` token) becomes admin-selectable, defaulting to **Quicksand**.
- New DB column `quote_font text not null default 'Quicksand'`.
- `tailwind.config.js`: `script` token → `var(--font-quote, "Quicksand")` (the quote is the only
  `font-script` user; `HomeVideo`'s tagline is being removed in #3, so nothing else is affected).
- `App.jsx`: set `--font-quote` from `settings.fonts.quote`.
- `siteSettings`/`adminSettings`/`siteSettingsFallback`: thread `quote_font` → `fonts.quote`.
- `SettingsForm.jsx`: a third font `<select>` for the quote.
- `src/data/fontOptions.js`: add `QUOTE_FONTS` + `DEFAULT_QUOTE_FONT = 'Quicksand'`; add five
  new families — **Quicksand, Poppins, Raleway, Merriweather, Josefin Sans** — to the heading and
  body menus too; extend `isKnownFont` for the quote role.
- `index.html`: load the five new Google Font families.

### 6. Same background on all pages — **already consistent; verify**
Every page's background comes from one place — `Layout`'s `bg-offwhite-100` wrapper and the
`bg-offwhite-100` on `<body>` — both now variable-driven, so the chosen warmth applies uniformly
site-wide (the `--offwhite-*` variables live on `:root`). A grep confirms no page or section
overrides the page background. So this resolves with #2 (the dev restart); no code change beyond
that verification.

### 7. Navbar separator — **change**
Give the header a clearer boundary from the page: keep the hairline `border-b` and add a soft
drop shadow beneath it, so the navbar reads as a distinct bar.

## Constraints (unchanged from the project)
Plain JS `.jsx`; Tailwind tokens only in components (font/warmth hexes live in data modules and
`index.html`); components never import Supabase; **schema changes via migration + `supabase
migration up`, never `db:reset`**; Conventional Commits; tag `v0.4j`; lint/test/check:docs/build
each a standalone gate.

## Task order
1. #1 video URL normalization (admin form + modal) + tests.
2. #3 remove HomeVideo overlay + tests + docs.
3. #4/#5 quote-font role + expanded menus (migration → queries → fallback → tailwind → App →
   SettingsForm → fontOptions → index.html) + tests + docs.
4. #7 navbar separator (+ #6 verification).
5. Gates + finish (tag `v0.4j`).
