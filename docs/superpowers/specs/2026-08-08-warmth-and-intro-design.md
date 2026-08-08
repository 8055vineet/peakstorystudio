# Phase 3i — Adaptive Surface Warmth + Logo Intro (design)

**Version:** `v0.4i` · **Branch:** `phase-3i/warmth-and-intro` · **Date:** 2026-08-08

Two owner-facing features, built on the plumbing Phase 3g/3h already established
(a `site_settings` column → query mapping → `App` effect → CSS variables that
Tailwind tokens read). They are independent and each independently testable, but
share that plumbing and the same admin form, so they ship as one phase.

1. **Adaptive surface warmth** — an admin-only control that shifts every cream
   surface on the public site along a white → ivory spectrum, without touching the
   maroon / gold / charcoal accents.
2. **Logo intro** — on the Home page, a full-screen presentation of the studio
   logo that collapses into the navbar badge once per session.

This phase also adopts the owner's updated **peaks logo** as the default badge and
intro image.

## Goals

- Give the owner a live, safe way to warm or cool the whole site from the admin
  Settings tab — no code, no ugly intermediate values possible.
- Add a tasteful, on-brand first-load moment that makes the logo unmissable and
  then gets out of the way, degrading cleanly on every axis (reduced motion, no
  logo, repeat visits, un-measurable target).
- Replace today's wordmark-only navbar badge with the mountain-peaks logo.

## Non-goals / out of scope

- No per-page or per-section theming — warmth is one site-wide value.
- No change to accent colors (`pitch`, `gold`, `charcoal`) or to the paper-grain
  overlay. "Texture of colors" is read as *background tone*, not the grain.
- No TypeScript (project standing rule).
- The intro is **not** reintroducing the old marketing splash Phase 3b deleted; it
  is a new, logo-only, once-per-session moment.
- No new fabricated content of any kind (standing rule); PS-002's celebrity
  testimonial is not touched here.

## Global constraints (bind every task)

- Plain JavaScript, `.jsx` components. No TypeScript.
- Style with Tailwind utilities inline; **components use palette tokens only, never
  a raw hex**. The warmth anchors are hex, but they live in the data module
  `src/data/surfaceTint.js` (the same status as `tailwind.config.js`), never inline
  in a component. The admin preview colors come from `surfaceRamp()` output, not
  literal hex in JSX.
- `gold-*` / `font-cinzel` stay admin-only (`src/admin/`).
- Components never import the Supabase client; components → hooks → `src/lib/queries/`.
- **Schema changes only in `supabase/migrations/`.** Apply locally with
  `npx supabase migration up` — **never `npm run db:reset`** (the local DB holds
  real inquiries and content).
- Conventional Commits; one branch per phase; tag `v0.4i` at completion.
- `npm run lint`, `npm test`, `npm run check:docs`, `npm run build` all pass, each
  run as its own standalone gate.

---

## Part 1 — Adaptive surface warmth

### The model (taste-safe by construction)

The control is a single scalar `warmth ∈ [0, 1]`, default `0.5`. It does **not**
expose free RGB — that is where muddy values come from. Instead it interpolates the
five cream surface tokens along a three-anchor ramp:

| `warmth` | Anchor | `50` / `100` / `200` / `300` / `400` |
|---|---|---|
| `0.0` | Cool white | `#ffffff` `#fcfcfb` `#f4f4f2` `#e7e6e2` `#d6d4cd` |
| `0.5` | **Soft Cream** (today, unchanged) | `#ffffff` `#faf9f6` `#f5f3ee` `#e8e4dc` `#d5cfc2` |
| `1.0` | Warm ivory | `#fbf6ec` `#f6efe1` `#efe6d4` `#e2d6c1` `#cfc0a5` |

Interpolation is two-segment, anchored on today's cream at the midpoint:

```
surfaceRamp(w):
  w = clamp(w, 0, 1)
  t, a, b = w <= 0.5 ? (w / 0.5, COOL, CREAM)
                     : ((w - 0.5) / 0.5, CREAM, WARM)
  for each key: lerp(a[key], b[key], t)   # per-channel sRGB, rounded
```

Consequences that make this safe:

- `warmth = 0.5` reproduces today's palette **pixel-for-pixel** — the default site
  is visually unchanged.
- Both anchors of every segment are hand-picked low-chroma creams, so every
  intermediate value stays on the cream line — no green/muddy detours.
- Left of centre cools toward white; right warms toward golden ivory. This is
  exactly the owner's "white → yellowish" request, with today's look centred.

### Data + flow

- **Migration** `supabase/migrations/20260808110000_settings_appearance.sql`:
  ```sql
  alter table public.site_settings
    add column surface_warmth numeric not null default 0.5
    check (surface_warmth >= 0 and surface_warmth <= 1);
  ```
- **`src/data/surfaceTint.js`** (new, pure, unit-tested): exports `DEFAULT_WARMTH`
  (`0.5`), the three anchor maps, `surfaceRamp(warmth)` returning
  `{ '50':'#…', '100':…, '200':…, '300':…, '400':… }`, and the hex-lerp helper.
- **`src/lib/queries/siteSettings.js`**: add `surface_warmth` to `SETTINGS_SELECT`;
  return `appearance: { warmth: data.surface_warmth ?? DEFAULT_WARMTH }`.
- **`src/lib/queries/adminSettings.js`**: add `'surface_warmth'` to `COLUMNS`. The
  generic `toCamel` mapper then round-trips it as `surfaceWarmth` on read and write
  with no other change.
- **`src/data/siteSettingsFallback.js`**: add `appearance: { warmth: DEFAULT_WARMTH }`.
- **`tailwind.config.js`**: the `offwhite` ramp becomes CSS-variable-backed,
  falling back to today's hex so an un-run/failed apply looks identical to today:
  ```js
  offwhite: {
    50:  'var(--offwhite-50, #ffffff)',
    100: 'var(--offwhite-100, #faf9f6)',
    200: 'var(--offwhite-200, #f5f3ee)',
    300: 'var(--offwhite-300, #e8e4dc)',
    400: 'var(--offwhite-400, #d5cfc2)',
  }
  ```
- **`src/App.jsx`**: a new effect (mirroring the Phase 3g font effect) keyed on
  `settings.appearance?.warmth` sets `--offwhite-50…400` on `document.documentElement`
  from `surfaceRamp(warmth)`.
- **`src/index.css`**: the two hardcoded surface uses follow the tokens —
  scrollbar-track `#f5f3ee` → `var(--offwhite-200, #f5f3ee)`, `.minimal-card`
  background `#ffffff` → `var(--offwhite-50, #ffffff)`. The frosted
  `.glass-panel-light` (translucent white) stays as-is.

### Admin UI

`src/admin/SettingsForm.jsx` gains an **Appearance** section (same
`SECTION_CLASS`, `font-cinzel` heading) with:

- A range input, `0–100 step 1`, bound to `surfaceWarmth` (stored `0–1`; the input
  shows `warmth * 100`). Labelled endpoints: "White" ⇢ "Ivory".
- A **contained live preview** that recomputes from the current slider value via
  `surfaceRamp()`: a five-swatch strip plus a small sample card (garamond heading +
  body line) painted with the previewed `50/100/200` tones. The preview updates on
  drag but **does not** mutate `:root` — the admin chrome stays stable; the public
  site changes only on Save.

### Error handling

- `warmth` unset / non-numeric → `DEFAULT_WARMTH`; out of range → clamped in
  `surfaceRamp`. The DB `check` constraint is the backstop.
- If the apply effect never runs (outage, JS disabled), Tailwind's hex fallbacks
  render today's palette.

### Testing

- `surfaceTint.test.js`: `surfaceRamp(0.5)` equals the Soft-Cream row exactly;
  `0` and `1` equal the cool/warm anchors; clamps below 0 / above 1; a midpoint
  between anchors is a clean per-channel average.
- `SettingsForm.test.jsx`: the Appearance slider renders at the initial
  `surfaceWarmth`, and a changed value is submitted through `onSave`. `INITIAL`
  fixture gains `surfaceWarmth`.
- Query tests: `surface_warmth` ↔ `appearance.warmth` (public) and `surfaceWarmth`
  (admin) mapping, plus the fallback default.
- `App.routes` / admin `App` settings mocks gain `appearance.warmth` /
  `surfaceWarmth`.
- Token indirection verified via `npm run build`: `dist` CSS shows
  `var(--offwhite-100,#faf9f6)` (same technique used to verify the font roles).

---

## Part 2 — Logo intro

### Component

`src/components/IntroSplash.jsx` (new, presentational, self-contained). Props:
`logoUrl` (string | null) and `onDone` (callback, optional). It owns exactly one
concern — its own play/skip lifecycle — and renders nothing that outlives it.

Rendered **only on Home**, inside the index route element alongside `HomePage`, so
"home only" is structural, not a runtime pathname check. It overlays the frame via
`position: fixed; inset: 0` at a z-index above the paper grain (`z-99`).

### Choreography (~1.6s total)

1. **In** (~0.4s): full-screen warm cream field with a soft radial vignette + the
   paper grain; the circular logo fades in large and centred, settling from a
   slight over-scale.
2. **Hold** (~0.7s).
3. **Collapse** (~0.6s): the logo scales down and glides to the **measured**
   position of the navbar badge while the cream backdrop fades out; because the
   splash logo and the badge are the same image, the hand-off is seamless. The
   component then unmounts and the real badge is already in place.

The backdrop is a clean cream field (not the leaf-shadow mockup) so the collapse
morphs pixel-for-pixel into the badge. *Trade-off noted for review: this favours a
coherent morph over the full 3D-mockup drama.*

### Guardrails

- **Once per session** — a `sessionStorage` key (`peak_intro_played`) set when the
  animation starts; already-set → render nothing.
- **Home only** — by construction (rendered only in the index route).
- **Skippable** — a click, scroll, `Escape`, or any key fast-forwards to the end and
  dismisses.
- **Reduced motion** — `matchMedia('(prefers-reduced-motion: reduce)')` matching →
  render nothing at all (no flash, no motion).
- **No logo / un-measurable target** — `logoUrl` null → render nothing; if the
  navbar badge (`[data-logo-badge]`) can't be measured, degrade to a plain fade-out
  with no glide.
- **Never blocks** — it does not trap focus, does not lock scroll (scroll dismisses
  it), and an image load error dismisses immediately.

### Wiring

- **`src/components/Navbar.jsx`**: add `data-logo-badge` to the badge `<img>` as the
  measurement target. No behavioural change.
- **`src/App.jsx`**: render `<IntroSplash logoUrl={settings.logo} />` in the index
  route element.
- Reads external state (`sessionStorage`, `matchMedia`) in a lazy `useState`
  initializer; measures `getBoundingClientRect` in a post-mount effect; timers set
  in effects with cleanup — no sync `setState` loops, hooks-purity clean.

### Testing

- `IntroSplash.test.jsx`: plays and sets the session key when allowed; renders
  nothing when the session key is already set; renders nothing under reduced motion
  (`matchMedia` stub → `matches:true`); renders nothing with `logoUrl={null}`;
  dismiss on click / scroll / `Escape` calls `onDone`; with jsdom's zeroed
  `getBoundingClientRect`, the fade-only fallback path is exercised.
- `Navbar.test.jsx`: the badge carries `data-logo-badge`.
- `App.routes.test.jsx`: Home renders the splash element; other routes do not.

---

## Cross-cutting

### Logo asset

The owner's `UPDATEDLOGO.png` (1401×1123, peaks + ring, 3D mockup on a cream wall)
is the source. A centred square crop of the ring/peaks/wordmark region, scaled to a
web badge, **overwrites `public/images/home/logo.jpg`** (the path the existing logo
media row already points at). This adopts the peaks logo for both badge and intro
with **zero** query/seed/DB churn — the storage path is unchanged and
`scripts/load-real-content.mjs` still maps it. The crop is verified visually during
implementation. `NewLogo.jpeg` (oval, no peaks) is not used.

### Docs (required by `check:docs`)

- `docs/COMPONENTS.md`: document `IntroSplash`.
- `docs/DATA-MODEL.md`: document `site_settings.surface_warmth` and the
  `appearance.warmth` mapping.
- `docs/ARCHITECTURE.md`: note the surface-warmth CSS-variable flow (alongside the
  existing font-variable note) and the Home intro overlay.

### Sequence

Part 1 (warmth) lands first — migration, `surfaceTint`, query + fallback wiring,
Tailwind tokens, `App` effect, admin section — each task independently testable.
Part 2 (intro) follows — logo asset, `IntroSplash`, Navbar hook, App wiring.
Tag `v0.4i` at completion.
