# Phase 3i — Adaptive Surface Warmth + Logo Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only slider that warms the public site's cream surfaces from white to ivory, and a once-per-session Home-page intro where the studio logo fills the screen then collapses into the navbar badge.

**Architecture:** Both features extend the existing `site_settings` → query → `App` effect → CSS-variable pipeline (the Phase 3g font control's shape). A pure `surfaceRamp(warmth)` maps one scalar to the five `offwhite` surface hexes; Tailwind's `offwhite` tokens become `var(--offwhite-*)` so `App` can retint them at runtime. The intro is a self-contained `IntroSplash` overlay measured against a `[data-logo-badge]` target in the navbar.

**Tech Stack:** Vite, React 18 (plain JS/`.jsx`), Tailwind, Supabase (local, migrations), Vitest + Testing Library, ffmpeg (asset crop).

## Global Constraints

- Plain JavaScript, `.jsx` components. **No TypeScript.**
- Tailwind utilities inline; **components use palette tokens only, never a raw hex literal.** Hex anchors live in `src/data/surfaceTint.js` (data module, same status as `tailwind.config.js`). Admin preview colors are `surfaceRamp()` output rendered via `style={{ backgroundColor: hex }}` — computed data, not literals — this is allowed and must not be flagged.
- `gold-*` / `font-cinzel` stay admin-only (`src/admin/`). `font-cinzel` section headings in `SettingsForm` are admin — allowed.
- Components never import the Supabase client; components → hooks → `src/lib/queries/`.
- **Schema changes only in `supabase/migrations/`.** Apply with `npx supabase migration up`. **Never `npm run db:reset`** — the local DB holds real inquiries and content.
- `warmth` is a number in `[0, 1]`; `DEFAULT_WARMTH = 0.5` reproduces today's palette exactly.
- Conventional Commits; branch `phase-3i/warmth-and-intro` (already created); tag `v0.4i` at completion.
- Gates run **standalone** (never `&&`-chained): `npm run lint`, `npm test`, `npm run check:docs`, `npm run build`.
- Any change adding/removing/renaming a `src/components` component updates `docs/COMPONENTS.md` in the same commit (`check:docs` enforces it).
- Do not touch PS-002's celebrity testimonial; add no fabricated content.

## File Structure

**Create:**
- `src/data/surfaceTint.js` — pure: `DEFAULT_WARMTH`, three anchor ramps, `surfaceRamp(warmth)`.
- `src/data/__tests__/surfaceTint.test.js`
- `supabase/migrations/20260808110000_settings_appearance.sql` — `surface_warmth` column.
- `src/components/IntroSplash.jsx` — Home-only intro overlay.
- `src/components/__tests__/IntroSplash.test.jsx`

**Modify:**
- `tailwind.config.js` — `offwhite` ramp → `var(--offwhite-*)` with today's hex fallbacks.
- `src/index.css` — scrollbar-track + `.minimal-card` follow the tokens.
- `src/App.jsx` — warmth apply-effect; render `IntroSplash` on Home.
- `src/lib/queries/siteSettings.js` (+ test) — read `surface_warmth` → `appearance.warmth`.
- `src/lib/queries/adminSettings.js` (+ test) — `surface_warmth` column round-trip → `surfaceWarmth`.
- `src/data/siteSettingsFallback.js` — `appearance: { warmth: DEFAULT_WARMTH }`.
- `src/admin/SettingsForm.jsx` (+ test) — Appearance section: slider + live preview.
- `src/admin/__tests__/App.test.jsx` — `getSettingsRow` fixture gains `surfaceWarmth`.
- `src/components/Navbar.jsx` (+ test) — `data-logo-badge` on the badge `<img>`.
- `src/__tests__/App.routes.test.jsx` — settings mock gains `appearance`/truthy `logo`; warmth + splash assertions.
- `src/test/setup.js` — `sessionStorage` stub.
- `public/images/home/logo.jpg` — overwritten with the peaks-logo square crop.
- `docs/DATA-MODEL.md`, `docs/COMPONENTS.md`, `docs/ARCHITECTURE.md` — documentation.

---

## Task 1: `surfaceTint` module

**Files:**
- Create: `src/data/surfaceTint.js`
- Test: `src/data/__tests__/surfaceTint.test.js`

**Interfaces:**
- Produces: `DEFAULT_WARMTH` (number `0.5`); `surfaceRamp(warmth: number) → { '50','100','200','300','400': string }` (each a `#rrggbb` hex). Clamps to `[0,1]`; non-finite → `DEFAULT_WARMTH`. `surfaceRamp(0.5)` returns today's palette exactly.

- [ ] **Step 1: Write the failing test**

`src/data/__tests__/surfaceTint.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { surfaceRamp, DEFAULT_WARMTH } from '../surfaceTint';

describe('surfaceRamp', () => {
  it('reproduces today’s cream palette at the 0.5 default', () => {
    expect(DEFAULT_WARMTH).toBe(0.5);
    expect(surfaceRamp(0.5)).toEqual({
      50: '#ffffff', 100: '#faf9f6', 200: '#f5f3ee', 300: '#e8e4dc', 400: '#d5cfc2',
    });
  });

  it('returns the cool-white anchor at 0 and the warm-ivory anchor at 1', () => {
    expect(surfaceRamp(0)).toEqual({
      50: '#ffffff', 100: '#fcfcfb', 200: '#f4f4f2', 300: '#e7e6e2', 400: '#d6d4cd',
    });
    expect(surfaceRamp(1)).toEqual({
      50: '#fbf6ec', 100: '#f6efe1', 200: '#efe6d4', 300: '#e2d6c1', 400: '#cfc0a5',
    });
  });

  it('clamps out-of-range and non-finite inputs', () => {
    expect(surfaceRamp(-3)).toEqual(surfaceRamp(0));
    expect(surfaceRamp(9)).toEqual(surfaceRamp(1));
    expect(surfaceRamp(NaN)).toEqual(surfaceRamp(0.5));
    expect(surfaceRamp(undefined)).toEqual(surfaceRamp(0.5));
  });

  it('interpolates on the cream line between anchors (no muddy excursion)', () => {
    const q = surfaceRamp(0.25); // halfway cool→cream
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(q[200].slice(i, i + 2), 16));
    // between cool #f4f4f2 (244,244,242) and cream #f5f3ee (245,243,238)
    expect(r).toBeGreaterThanOrEqual(0xf4); expect(r).toBeLessThanOrEqual(0xf5);
    expect(g).toBeGreaterThanOrEqual(0xf3); expect(g).toBeLessThanOrEqual(0xf4);
    expect(b).toBeGreaterThanOrEqual(0xee); expect(b).toBeLessThanOrEqual(0xf2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/__tests__/surfaceTint.test.js`
Expected: FAIL — cannot resolve `../surfaceTint`.

- [ ] **Step 3: Write the implementation**

`src/data/surfaceTint.js`:
```js
// FALLBACK + MATH for the admin surface-warmth control (Phase 3i). Pure data
// and a pure function: the public site applies surfaceRamp()'s output as
// CSS variables (--offwhite-50..400) and the admin renders a live preview
// from the same function. The hex anchors live here — a data module, the
// same status as tailwind.config.js — never inline in a component.
export const DEFAULT_WARMTH = 0.5;

const SURFACE_KEYS = ['50', '100', '200', '300', '400'];

// Three hand-tuned cream ramps. CREAM is today's exact palette and sits at
// the slider midpoint, so warmth 0.5 reproduces the shipped site pixel for
// pixel; 0 cools toward white, 1 warms toward golden ivory. Both ends of
// each segment are low-chroma creams, so every interpolated value stays on
// the cream line.
const COOL = { 50: '#ffffff', 100: '#fcfcfb', 200: '#f4f4f2', 300: '#e7e6e2', 400: '#d6d4cd' };
const CREAM = { 50: '#ffffff', 100: '#faf9f6', 200: '#f5f3ee', 300: '#e8e4dc', 400: '#d5cfc2' };
const WARM = { 50: '#fbf6ec', 100: '#f6efe1', 200: '#efe6d4', 300: '#e2d6c1', 400: '#cfc0a5' };

function clamp01(n) {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : DEFAULT_WARMTH;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function channels(hex) {
  return [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((h) => parseInt(h, 16));
}

function toHex(n) {
  return Math.round(n).toString(16).padStart(2, '0');
}

function lerpHex(a, b, t) {
  const ca = channels(a);
  const cb = channels(b);
  return `#${ca.map((v, i) => toHex(v + (cb[i] - v) * t)).join('')}`;
}

// A five-key map of surface hexes for a warmth in [0, 1]. Two-segment,
// anchored on today's cream at 0.5.
export function surfaceRamp(warmth) {
  const w = clamp01(warmth);
  const [a, b, t] = w <= 0.5 ? [COOL, CREAM, w / 0.5] : [CREAM, WARM, (w - 0.5) / 0.5];
  const ramp = {};
  SURFACE_KEYS.forEach((key) => { ramp[key] = lerpHex(a[key], b[key], t); });
  return ramp;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/__tests__/surfaceTint.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/surfaceTint.js src/data/__tests__/surfaceTint.test.js
git commit -m "feat: add surfaceTint warmth ramp (Phase 3i)"
```

---

## Task 2: `surface_warmth` through the settings data layer

**Files:**
- Create: `supabase/migrations/20260808110000_settings_appearance.sql`
- Modify: `src/lib/queries/siteSettings.js`, `src/lib/queries/adminSettings.js`, `src/data/siteSettingsFallback.js`, `docs/DATA-MODEL.md`
- Test: `src/lib/queries/__tests__/siteSettings.test.js`, `src/lib/queries/__tests__/adminSettings.test.js`

**Interfaces:**
- Consumes: `DEFAULT_WARMTH` from `src/data/surfaceTint.js`.
- Produces: public `getSiteSettings()` → `settings.appearance = { warmth: number }`; `SITE_SETTINGS_FALLBACK.appearance = { warmth: 0.5 }`; admin `getSettingsRow()` → `surfaceWarmth`, and `updateSiteSettings({ surfaceWarmth })` writes `surface_warmth`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/queries/__tests__/siteSettings.test.js`, add `surface_warmth: 0.75,` to `FULL_ROW` (after `youtube_url`), then add these assertions/tests:
```js
// inside the 'maps a full row' test, after the fonts assertion:
expect(settings.appearance).toEqual({ warmth: 0.75 });

// new test in the getSiteSettings describe:
it('defaults surface warmth to 0.5 when the column is null', async () => {
  mockFrom.mockReturnValue(singleResult({ ...FULL_ROW, surface_warmth: null }));
  const { getSiteSettings } = await importSettings();
  const settings = await getSiteSettings();
  expect(settings.appearance).toEqual({ warmth: 0.5 });
});
```
In the `SITE_SETTINGS_FALLBACK` `toEqual` object, add `appearance: { warmth: 0.5 },`.

In `src/lib/queries/__tests__/adminSettings.test.js`, add `surface_warmth: 0.75,` to `ROW` (after `logo_media_id`), add to the `getSettingsRow` test:
```js
expect(item.surfaceWarmth).toBe(0.75);
```
and extend the `updateSiteSettings` "sends only known columns" test call + expectation:
```js
await updateSiteSettings({
  id: 99, quoteText: 'New', unknownKey: 'x', heroMediaId: 'm-9', surfaceWarmth: 0.9,
});
expect(captured.values).toEqual({ quote_text: 'New', hero_media_id: 'm-9', surface_warmth: 0.9 });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/queries/__tests__/siteSettings.test.js src/lib/queries/__tests__/adminSettings.test.js`
Expected: FAIL — `settings.appearance` undefined; `item.surfaceWarmth` undefined; `captured.values` missing `surface_warmth`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260808110000_settings_appearance.sql`:
```sql
-- Phase 3i: admin-controlled surface warmth for the public site.
-- One scalar in [0, 1]; the app interpolates the cream surface ramp from it
-- (src/data/surfaceTint.js) and applies the result as --offwhite-* CSS
-- variables. 0.5 reproduces today's palette exactly.
alter table public.site_settings
  add column surface_warmth numeric not null default 0.5
  check (surface_warmth >= 0 and surface_warmth <= 1);
```

- [ ] **Step 4: Wire the queries + fallback**

`src/lib/queries/siteSettings.js`:
- Add import: `import { DEFAULT_WARMTH } from '../../data/surfaceTint';`
- In `SETTINGS_SELECT`, add `surface_warmth,` on the line with `heading_font, body_font,`.
- In the returned object, add after the `fonts:` line:
```js
    appearance: { warmth: data.surface_warmth ?? DEFAULT_WARMTH },
```

`src/lib/queries/adminSettings.js`: add `'surface_warmth',` to the `COLUMNS` array (after `'logo_media_id',`).

`src/data/siteSettingsFallback.js`:
- Add import: `import { DEFAULT_WARMTH } from './surfaceTint';`
- Add before the closing brace of `SITE_SETTINGS_FALLBACK` (after `logo: null,`):
```js
  appearance: { warmth: DEFAULT_WARMTH },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/queries/__tests__/siteSettings.test.js src/lib/queries/__tests__/adminSettings.test.js`
Expected: PASS.

- [ ] **Step 6: Apply the migration locally (never reset)**

Run: `npx supabase migration up`
Expected: applies `20260808110000_settings_appearance.sql`; the single `site_settings` row gains `surface_warmth = 0.5`. Do NOT run `npm run db:reset`.

- [ ] **Step 7: Document the column**

In `docs/DATA-MODEL.md`, find the `site_settings` column list and add a line matching that file's existing format:
```
- `surface_warmth` — `numeric`, `[0,1]`, default `0.5`. Background warmth; the public read maps it to `appearance.warmth`, and `App` applies `surfaceRamp()` as `--offwhite-*` CSS variables. `0.5` = the shipped palette.
```

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260808110000_settings_appearance.sql src/lib/queries/siteSettings.js src/lib/queries/adminSettings.js src/data/siteSettingsFallback.js src/lib/queries/__tests__/siteSettings.test.js src/lib/queries/__tests__/adminSettings.test.js docs/DATA-MODEL.md
git commit -m "feat: add surface_warmth to the site_settings data layer (Phase 3i)"
```

---

## Task 3: Apply warmth on the public site

**Files:**
- Modify: `tailwind.config.js`, `src/App.jsx`, `src/index.css`, `docs/ARCHITECTURE.md`
- Test: `src/__tests__/App.routes.test.jsx`

**Interfaces:**
- Consumes: `surfaceRamp` from `src/data/surfaceTint.js`; `settings.appearance.warmth` from Task 2.
- Produces: `--offwhite-50..400` set on `document.documentElement` from the active warmth; Tailwind `offwhite-*` tokens read them.

- [ ] **Step 1: Write the failing test**

In `src/__tests__/App.routes.test.jsx`:
- In the `useSiteSettings` mock's `data`, change `logo: null,` to `logo: '/images/home/logo.jpg',` and add `appearance: { warmth: 1 },` (after the `fonts:` line).
- Add a `beforeEach` (import `beforeEach` from vitest) that clears session state so the splash can play each test:
```js
beforeEach(() => { window.sessionStorage.clear(); });
```
- Add this test inside `describe('routing', ...)`:
```js
it('applies the admin-chosen surface warmth as CSS variables on the document', () => {
  renderAt('/');
  expect(document.documentElement.style.getPropertyValue('--offwhite-100')).toBe('#f6efe1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/App.routes.test.jsx -t "surface warmth"`
Expected: FAIL — `--offwhite-100` is empty (App does not set it yet).

- [ ] **Step 3: Retint the tokens and apply the ramp**

`tailwind.config.js` — replace the `offwhite` block with:
```js
        offwhite: {
          50: 'var(--offwhite-50, #ffffff)',
          100: 'var(--offwhite-100, #faf9f6)',
          200: 'var(--offwhite-200, #f5f3ee)',
          300: 'var(--offwhite-300, #e8e4dc)',
          400: 'var(--offwhite-400, #d5cfc2)',
        },
```

`src/App.jsx`:
- Add import: `import { surfaceRamp } from './data/surfaceTint';`
- Add a new effect immediately after the existing fonts effect (the one keyed on `settings.fonts?.*`):
```jsx
  // Apply the admin-chosen surface warmth site-wide (Phase 3i). Tailwind's
  // offwhite-* tokens read these variables; surfaceRamp(0.5) reproduces the
  // shipped palette, so an unset/outage value leaves the site unchanged.
  useEffect(() => {
    const root = document.documentElement;
    const ramp = surfaceRamp(settings.appearance?.warmth);
    Object.entries(ramp).forEach(([key, hex]) => {
      root.style.setProperty(`--offwhite-${key}`, hex);
    });
  }, [settings.appearance?.warmth]);
```

`src/index.css` — the two hardcoded surface uses follow the tokens:
- `::-webkit-scrollbar-track { background: var(--offwhite-200, #f5f3ee); }`
- `.minimal-card { background: var(--offwhite-50, #ffffff); ... }` (change only the `background` line; leave border/shadow).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/App.routes.test.jsx`
Expected: PASS (existing route tests + the new warmth test).

- [ ] **Step 5: Verify the token indirection in the build**

Run: `npm run build`
Then: `grep -o 'var(--offwhite-100[^)]*)' dist/assets/*.css | head -1`
Expected: prints `var(--offwhite-100,#faf9f6)` (proves tokens compile to variables with the today-fallback).
Clean up per CLAUDE.md: `git checkout -- dist/ && git clean -fx dist/`.

- [ ] **Step 6: Document the flow**

In `docs/ARCHITECTURE.md`, near the existing font CSS-variable note, add (matching format):
```
Surface warmth (Phase 3i): App sets `--offwhite-50..400` on the document root
from `settings.appearance.warmth` via `surfaceRamp()` (src/data/surfaceTint.js);
Tailwind's `offwhite-*` tokens read those variables, so one admin scalar retints
every cream surface. `0.5` reproduces the shipped palette.
```

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.js src/App.jsx src/index.css src/__tests__/App.routes.test.jsx docs/ARCHITECTURE.md
git commit -m "feat: retint offwhite surfaces from admin warmth (Phase 3i)"
```

---

## Task 4: Admin Appearance slider + live preview

**Files:**
- Modify: `src/admin/SettingsForm.jsx`, `src/admin/__tests__/App.test.jsx`
- Test: `src/admin/__tests__/SettingsForm.test.jsx`

**Interfaces:**
- Consumes: `surfaceRamp`, `DEFAULT_WARMTH` from `src/data/surfaceTint.js`; the `surfaceWarmth` field on the settings row (Task 2).
- Produces: a `Background warmth` range control (`0..100` → stored `0..1`) submitted as `surfaceWarmth`.

- [ ] **Step 1: Write the failing test**

In `src/admin/__tests__/SettingsForm.test.jsx`, add `surfaceWarmth: 0.5,` to the `INITIAL` object (after `logoMediaId: null,`), then add:
```js
it('renders the Appearance warmth slider and submits a changed value', async () => {
  const { props } = await renderForm();
  const slider = screen.getByLabelText(/background warmth/i);
  expect(slider).toHaveValue(50);
  fireEvent.change(slider, { target: { value: '80' } });
  fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
  expect(props.onSave.mock.calls[0][0]).toMatchObject({ surfaceWarmth: 0.8 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/admin/__tests__/SettingsForm.test.jsx -t "Appearance warmth"`
Expected: FAIL — no `Background warmth` control.

- [ ] **Step 3: Implement the Appearance section**

`src/admin/SettingsForm.jsx`:
- Add import: `import { surfaceRamp, DEFAULT_WARMTH } from '../data/surfaceTint';`
- Add this presentational helper above the `SettingsForm` component:
```jsx
// A contained preview of the cream surfaces at a given warmth. Colors come
// from surfaceRamp() (computed data, not literal hex), and it never mutates
// :root — the public site changes only on Save.
function WarmthPreview({ warmth }) {
  const ramp = surfaceRamp(warmth);
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden="true">
        {Object.entries(ramp).map(([key, hex]) => (
          <span
            key={key}
            className="h-6 flex-1 rounded border border-pitch-900/10"
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
      <div
        className="mt-3 rounded-lg border border-pitch-900/10 p-4"
        style={{ backgroundColor: ramp['100'] }}
      >
        <p className="font-garamond text-lg text-pitch-900">The Brand Story</p>
        <p className="text-sm text-charcoal-700">A preview of the site&rsquo;s surfaces at this warmth.</p>
      </div>
    </div>
  );
}
```
- Add a new `<section>` after the Typography `</section>` and before the Contact &amp; Social section:
```jsx
      <section className={SECTION_CLASS}>
        <h2 className="font-cinzel text-lg font-bold text-pitch-900">Appearance</h2>
        <p className="text-xs text-charcoal-500">
          The background warmth of the public site &mdash; crisp white through warm ivory.
        </p>
        <Field id={`${uid}-surfaceWarmth`} label="Background warmth">
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-charcoal-500">White</span>
            <input
              id={`${uid}-surfaceWarmth`}
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round((values.surfaceWarmth ?? DEFAULT_WARMTH) * 100)}
              onChange={(e) => set('surfaceWarmth', Number(e.target.value) / 100)}
              className="flex-1 accent-pitch-900"
            />
            <span className="text-[10px] uppercase tracking-widest text-charcoal-500">Ivory</span>
          </div>
        </Field>
        <WarmthPreview warmth={values.surfaceWarmth ?? DEFAULT_WARMTH} />
      </section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/admin/__tests__/SettingsForm.test.jsx`
Expected: PASS (existing + new).

- [ ] **Step 5: Keep the admin shell fixture honest**

In `src/admin/__tests__/App.test.jsx`, in the `getSettingsRow.mockResolvedValue({...})` object (the one with `logoMediaId: null,`), add `surfaceWarmth: 0.5,`.
Run: `npx vitest run src/admin/__tests__/App.test.jsx`
Expected: PASS (unchanged behavior; fixture now representative).

- [ ] **Step 6: Commit**

```bash
git add src/admin/SettingsForm.jsx src/admin/__tests__/SettingsForm.test.jsx src/admin/__tests__/App.test.jsx
git commit -m "feat: add admin Appearance warmth slider with live preview (Phase 3i)"
```

---

## Task 5: Adopt the peaks logo as the default badge

**Files:**
- Modify (overwrite bytes): `public/images/home/logo.jpg`
- Reference only: `scripts/load-real-content.mjs` (confirm it maps `/images/home/logo.jpg`)

**Interfaces:**
- Produces: the navbar badge / intro image is the mountain-peaks logo. Storage path unchanged (`/images/home/logo.jpg`), so no DB/query/seed change.

- [ ] **Step 1: Confirm the logo path mapping is unchanged**

Run: `grep -n "images/home/logo" scripts/load-real-content.mjs`
Expected: a line mapping `logo_media_id` to `/images/home/logo.jpg`. If it points elsewhere, note it — the crop target must match that path.

- [ ] **Step 2: Produce a square peaks crop from the owner's source**

Run (starting values; the ring/peaks/wordmark are roughly centered in the 1401×1123 source):
```bash
ffmpeg -y -i "$HOME/Downloads/UPDATEDLOGO.png" \
  -vf "crop=780:780:320:170,scale=800:800" -frames:v 1 \
  "public/images/home/logo.jpg"
```

- [ ] **Step 3: Verify the crop visually and adjust if clipped**

Open `public/images/home/logo.jpg` (Read it as an image). Confirm the full ring, mountain peaks, and wordmark are inside the square with a small warm margin and nothing clipped. If the ring is cut, re-run Step 2 adjusting the `crop=W:H:X:Y` offsets (larger W/H to zoom out; change X/Y to recenter) until framed. This visual check is the acceptance criterion for the asset.

- [ ] **Step 4: Commit**

```bash
git add public/images/home/logo.jpg
git commit -m "feat: adopt the mountain-peaks logo as the default badge (Phase 3i)"
```

---

## Task 6: `IntroSplash` component

**Files:**
- Create: `src/components/IntroSplash.jsx`
- Modify: `src/test/setup.js`, `docs/COMPONENTS.md`
- Test: `src/components/__tests__/IntroSplash.test.jsx`

**Interfaces:**
- Produces: `default export IntroSplash({ logoUrl: string|null, onDone?: () => void })`. Renders an overlay `data-testid="intro-splash"` when it should play; renders nothing when `logoUrl` is falsy, when `matchMedia('(prefers-reduced-motion: reduce)')` matches, or when `sessionStorage['peak_intro_played'] === '1'`. On first play it sets that session key. A click / wheel / touch / keydown, or the end of its ~1.75s timeline, dismisses it and calls `onDone`. It glides toward `[data-logo-badge]` if measurable, else fades only.

- [ ] **Step 1: Add the `sessionStorage` stub to the test setup**

In `src/test/setup.js`, after the `localStorage` stub block, add:
```js
// Same jsdom gap for sessionStorage — IntroSplash gates its once-per-session
// play on it. In-memory is enough; individual tests clear it in beforeEach.
if (typeof globalThis.sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: new LocalStorageStub(),
    configurable: true,
  });
}
```

- [ ] **Step 2: Write the failing test**

`src/components/__tests__/IntroSplash.test.jsx`:
```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IntroSplash from '../IntroSplash';

beforeEach(() => { window.sessionStorage.clear(); });

describe('IntroSplash', () => {
  it('plays and marks the session when a logo is set and motion is allowed', () => {
    render(<IntroSplash logoUrl="/images/home/logo.jpg" />);
    expect(screen.getByTestId('intro-splash')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('peak_intro_played')).toBe('1');
  });

  it('renders nothing when it already played this session', () => {
    window.sessionStorage.setItem('peak_intro_played', '1');
    render(<IntroSplash logoUrl="/images/home/logo.jpg" />);
    expect(screen.queryByTestId('intro-splash')).toBeNull();
  });

  it('renders nothing with no logo', () => {
    render(<IntroSplash logoUrl={null} />);
    expect(screen.queryByTestId('intro-splash')).toBeNull();
  });

  it('renders nothing under prefers-reduced-motion', () => {
    const original = window.matchMedia;
    window.matchMedia = (q) => ({
      matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    });
    render(<IntroSplash logoUrl="/images/home/logo.jpg" />);
    expect(screen.queryByTestId('intro-splash')).toBeNull();
    window.matchMedia = original;
  });

  it('dismisses on a click and calls onDone', () => {
    const onDone = vi.fn();
    render(<IntroSplash logoUrl="/images/home/logo.jpg" onDone={onDone} />);
    fireEvent.click(document.body);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('intro-splash')).toBeNull();
  });

  it('dismisses on a keypress', () => {
    const onDone = vi.fn();
    render(<IntroSplash logoUrl="/images/home/logo.jpg" onDone={onDone} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/IntroSplash.test.jsx`
Expected: FAIL — cannot resolve `../IntroSplash`.

- [ ] **Step 4: Implement the component**

`src/components/IntroSplash.jsx`:
```jsx
import { useCallback, useEffect, useRef, useState } from 'react';

// Phase 3i: the Home-page first-load moment. The studio logo fills a warm
// cream screen, holds, then scales and glides into the navbar badge, once
// per browser session. Presentational and self-contained: it owns only its
// own play/skip lifecycle and renders nothing that outlives it. App renders
// it only on the Home route, so "home only" is structural.
const SESSION_KEY = 'peak_intro_played';
const INTRO_LOGO_SIZE = 240; // px, the on-screen intro logo diameter

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
function alreadyPlayed() {
  try { return window.sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}
function markPlayed() {
  try { window.sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* private mode: may replay, never crash */ }
}

export default function IntroSplash({ logoUrl, onDone }) {
  // Decide once, before first paint, whether to play — reading matchMedia /
  // sessionStorage in a lazy initializer keeps render pure.
  const [active, setActive] = useState(() => (
    Boolean(logoUrl) && !prefersReducedMotion() && !alreadyPlayed()
  ));
  const [phase, setPhase] = useState('in'); // 'in' -> 'hold' -> 'out'
  const [entered, setEntered] = useState(false);
  const [target, setTarget] = useState(null); // { dx, dy, scale } | null (fade-only)
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const dismiss = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setActive(false);
    onDoneRef.current?.();
  }, []);

  // Choreography timeline; every timer cleaned up on unmount.
  useEffect(() => {
    if (!active) return undefined;
    markPlayed();
    const t1 = setTimeout(() => setEntered(true), 20);
    const t2 = setTimeout(() => setPhase('hold'), 470);
    const t3 = setTimeout(() => setPhase('out'), 1170);
    const t4 = setTimeout(() => dismiss(), 1770);
    return () => { [t1, t2, t3, t4].forEach(clearTimeout); };
  }, [active, dismiss]);

  // Measure the navbar badge as the glide destination, post-mount.
  useEffect(() => {
    if (!active) return;
    const badge = document.querySelector('[data-logo-badge]');
    if (!badge) return;
    const r = badge.getBoundingClientRect();
    if (!r.width) return; // not laid out (jsdom) -> fade-only
    setTarget({
      dx: (r.left + r.width / 2) - window.innerWidth / 2,
      dy: (r.top + r.height / 2) - window.innerHeight / 2,
      scale: r.width / INTRO_LOGO_SIZE,
    });
  }, [active]);

  // Any intent to interact fast-forwards and dismisses.
  useEffect(() => {
    if (!active) return undefined;
    const skip = () => dismiss();
    window.addEventListener('click', skip);
    window.addEventListener('wheel', skip, { passive: true });
    window.addEventListener('touchstart', skip, { passive: true });
    window.addEventListener('keydown', skip);
    return () => {
      window.removeEventListener('click', skip);
      window.removeEventListener('wheel', skip);
      window.removeEventListener('touchstart', skip);
      window.removeEventListener('keydown', skip);
    };
  }, [active, dismiss]);

  if (!active) return null;

  const collapsing = phase === 'out';
  const logoStyle = {
    width: `${INTRO_LOGO_SIZE}px`,
    height: `${INTRO_LOGO_SIZE}px`,
    opacity: collapsing ? 1 : (entered ? 1 : 0),
    transform: collapsing && target
      ? `translate(-50%, -50%) translate(${target.dx}px, ${target.dy}px) scale(${target.scale})`
      : `translate(-50%, -50%) scale(${entered ? 1 : 1.06})`,
    transition: 'transform 640ms cubic-bezier(0.16, 1, 0.3, 1), opacity 420ms ease',
  };

  return (
    <div
      data-testid="intro-splash"
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        backgroundColor: 'var(--offwhite-100, #faf9f6)',
        opacity: collapsing ? 0 : 1,
        transition: 'opacity 640ms ease',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 45%, transparent 42%, rgba(61,12,26,0.06) 100%)' }}
      />
      <img
        src={logoUrl}
        alt=""
        className="absolute left-1/2 top-1/2 rounded-full object-cover shadow-2xl ring-1 ring-pitch-900/10"
        style={logoStyle}
      />
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/IntroSplash.test.jsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Document the component**

In `docs/COMPONENTS.md`, add an entry (matching the file's existing format), e.g.:
```
- `IntroSplash` — Home-only first-load overlay: the logo fills a cream screen, holds, then collapses into the navbar badge. Once per session (`sessionStorage`), skippable, and skipped entirely under reduced motion or with no logo.
```

- [ ] **Step 7: Commit**

```bash
git add src/components/IntroSplash.jsx src/components/__tests__/IntroSplash.test.jsx src/test/setup.js docs/COMPONENTS.md
git commit -m "feat: add IntroSplash home intro overlay (Phase 3i)"
```

---

## Task 7: Wire the intro into the frame

**Files:**
- Modify: `src/components/Navbar.jsx`, `src/App.jsx`, `src/__tests__/App.routes.test.jsx`
- Test: `src/components/__tests__/Navbar.test.jsx`

**Interfaces:**
- Consumes: `IntroSplash` (Task 6); `settings.logo` (existing).
- Produces: the navbar badge `<img>` carries `data-logo-badge`; App renders `<IntroSplash logoUrl={settings.logo} />` on the Home route only.

- [ ] **Step 1: Write the failing tests**

In `src/components/__tests__/Navbar.test.jsx`, add to the `describe('logo badge', ...)` block:
```js
it('marks the badge as the intro-collapse target', () => {
  renderAt('/', { logo: '/images/logo.png' });
  expect(document.querySelector('header [data-logo-badge]')).not.toBeNull();
});
```
In `src/__tests__/App.routes.test.jsx` (its settings mock already has a truthy `logo` and cleared session from Task 3), add inside `describe('routing', ...)`:
```js
it('plays the intro splash on Home', () => {
  renderAt('/');
  expect(screen.getByTestId('intro-splash')).toBeInTheDocument();
});

it('does not render the intro splash off Home', () => {
  renderAt('/gallery');
  expect(screen.queryByTestId('intro-splash')).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/Navbar.test.jsx src/__tests__/App.routes.test.jsx -t "intro"`
Expected: FAIL — no `data-logo-badge`; no `intro-splash` element.

- [ ] **Step 3: Add the measurement target + render the splash**

`src/components/Navbar.jsx` — add `data-logo-badge` to the badge `<img>` (the one inside `{logo && (...)}`), leaving everything else:
```jsx
            <img
              src={logo}
              alt=""
              data-logo-badge
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover ring-1 ring-pitch-900/15 shrink-0"
            />
```

`src/App.jsx`:
- Add import: `import IntroSplash from './components/IntroSplash';`
- In the index `<Route>`'s `element`, wrap `HomePage` so the splash renders above it only when a logo exists:
```jsx
          <Route
            index
            element={
              <>
                {settings.logo ? <IntroSplash logoUrl={settings.logo} /> : null}
                <HomePage
                  films={films}
                  photos={photos}
                  onOpenLightbox={handleOpenLightbox}
                  quote={settings.quote}
                  brandStory={settings.brandStory}
                  images={settings.images}
                />
              </>
            }
          />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/Navbar.test.jsx src/__tests__/App.routes.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Navbar.jsx src/App.jsx src/components/__tests__/Navbar.test.jsx src/__tests__/App.routes.test.jsx
git commit -m "feat: play the logo intro on Home, collapsing into the navbar badge (Phase 3i)"
```

---

## Task 8: Full verification + manual smoke

**Files:** none (verification only).

- [ ] **Step 1: Run every gate, standalone**

```bash
npm run lint
```
Expected: exits 0; no more than the two tracked `useScrollReveal` warnings (`--max-warnings=2`). No new warnings from `IntroSplash` (it uses `useCallback`/refs to keep effect deps exhaustive).
```bash
npm test
```
Expected: the whole Vitest suite passes.
```bash
npm run check:docs
```
Expected: passes — `IntroSplash` is in `COMPONENTS.md`; every cited `src/...` path exists; links resolve.
```bash
npm run build
```
Expected: builds. Then clean up: `git checkout -- dist/ && git clean -fx dist/`.

- [ ] **Step 2: Manual smoke (owner-facing behavior)**

With the dev server already running (do not start a second one), verify by hand:
- Home load shows the logo full-screen, then it collapses into the navbar badge; a click/scroll skips it; a reload in the same tab does **not** replay it (open a new tab to see it again).
- Admin → Settings → Appearance: dragging the slider updates the live preview; Save warms/cools the public site; the slider at center matches today's cream.
- Confirm no horizontal scroll and that reduced-motion (OS setting) suppresses the intro.

- [ ] **Step 3: Finish the branch**

Hand off to `superpowers:finishing-a-development-branch`: verify the suite is green, then merge `phase-3i/warmth-and-intro` to `main`, tag `v0.4i`, and push (per the owner's per-phase flow).

---

## Self-Review

**Spec coverage:**
- Warmth model / anchors / 0.5-default → Task 1 (`surfaceTint`) + Task 3 (apply).
- Migration + query/fallback mapping → Task 2.
- Tailwind var tokens + `App` effect + index.css follow → Task 3.
- Admin slider + contained live preview → Task 4.
- Reduced-motion / once-per-session / skippable / no-logo / un-measurable fallbacks → Task 6 (component) + Task 7 (home-only wiring).
- Logo adoption (peaks crop, unchanged path) → Task 5.
- Docs (DATA-MODEL, ARCHITECTURE, COMPONENTS) → Tasks 2, 3, 6. Gates → Task 8.

**Placeholder scan:** No TBD/TODO. The one visual-tuning step (Task 5 crop offsets) ships a concrete command plus an explicit accept-by-eye criterion — not a placeholder.

**Type consistency:** `surfaceRamp(warmth)` / `DEFAULT_WARMTH` used identically in Tasks 1, 3, 4. `settings.appearance.warmth` (public) vs `surfaceWarmth` (admin row) kept distinct and consistent across Tasks 2/3/4. `IntroSplash({ logoUrl, onDone })`, `data-testid="intro-splash"`, `SESSION_KEY = 'peak_intro_played'`, and `[data-logo-badge]` match across Tasks 6/7 and their tests. CSS variables `--offwhite-50..400` consistent between `tailwind.config.js`, the `App` effect, and `index.css`.
