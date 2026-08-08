# Home Hero, Peaks, Logo & Navbar (Phase 3h, `v0.4h`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-width cinematic Home video hero with a mountain-peaks + "Peak Story Studio" overlay, the quote in Dancing Script, and an admin-uploadable circular logo in a restyled navbar.

**Architecture:** `youtube.js` gains a background-embed mode; `HomeVideo` becomes the full-width ambient hero with an inline peaks overlay. `font-script` is repointed to Dancing Script. A new nullable `site_settings.logo_media_id` flows through the existing settings read/write + `MediaSlot` and is rendered as a circular navbar badge threaded App → Layout → Navbar.

**Tech Stack:** React 18, Tailwind, Supabase (one migration), Vitest/jsdom, the existing media/upload pipeline.

**Spec:** `docs/superpowers/specs/2026-08-08-home-hero-logo-navbar-design.md` — authority when this plan is ambiguous.

## Global Constraints

- Plain JavaScript, `.jsx`. Tailwind inline, existing palette tokens only, no new hex. `font-cinzel`/`gold-*` admin-only.
- Components never import the Supabase client; pure-data modules don't either.
- Schema changes only in `supabase/migrations/`, applied with `npx supabase migration up` — **never `npm run db:reset`** (real data).
- `useContent` fallbacks stay module-level constants.
- ESLint `--max-warnings=2` (the two tracked `useScrollReveal` warnings); react-hooks purity enforced.
- Run `npm run lint` and `npm test` standalone before each commit.
- Conventional Commits; stay on `phase-3h/home-hero-logo-navbar`.
- Verbatim: hero wordmark **Peak Story Studio**; hero tagline **by abhinav**; quote font role → **Dancing Script**; logo slot label **Logo**, help **A square image works best.**; the video hero is **muted, looping, no controls** (ambient).

---

### Task 1: Quote font → Dancing Script

**Files:**
- Modify: `tailwind.config.js`, `index.html`

**Interfaces:**
- Produces: the `font-script` role resolves to Dancing Script (consumed by the Home quote and, in Task 3, the hero tagline).

- [ ] **Step 1: Repoint the role**

In `tailwind.config.js`, change the `script` family (leave `cinzel`, `garamond`, `sans` as they are):

```js
        script: ['Dancing Script', 'cursive'],
```

- [ ] **Step 2: Swap the loaded font in `index.html`**

In the Google Fonts `<link href=...>` `css2?family=` list, replace `&family=Great+Vibes` with `&family=Dancing+Script:wght@400;500;600;700` (keep every other family). Great Vibes is used nowhere else, so it is fully removed.

- [ ] **Step 3: Verify build + lint**

Run: `npm run build` (then `git checkout -- dist/ && git clean -fx dist/`), and `npm run lint`.
Expected: build clean; lint 0 errors, 2 warnings. (Font family is a config/visual change; the live smoke in Task 7 confirms the quote renders in Dancing Script — there is no meaningful jsdom unit test for a font family.)

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.js index.html
git commit -m "feat: Home quote font is Dancing Script"
```

---

### Task 2: `youtube.js` background-embed mode

**Files:**
- Modify: `src/lib/youtube.js`
- Test: `src/lib/__tests__/youtube.test.js`

**Interfaces:**
- Consumes: existing `youtubeId`.
- Produces: `youtubeEmbedUrl(url, { autoplay = false, background = false } = {})` — `background` returns `.../embed/{id}?autoplay=1&mute=1&loop=1&playlist={id}&controls=0&modestbranding=1&playsinline=1&rel=0`. Task 3 uses `{ background: true }`.

- [ ] **Step 1: Add the failing test**

Append to `src/lib/__tests__/youtube.test.js`:

```js
describe('youtubeEmbedUrl — background mode', () => {
  it('builds an ambient loop embed (muted, looping, no controls)', () => {
    const url = youtubeEmbedUrl('https://youtu.be/4KEZRGlwJU4', { background: true });
    expect(url).toContain('/embed/4KEZRGlwJU4?');
    expect(url).toContain('autoplay=1');
    expect(url).toContain('mute=1');
    expect(url).toContain('loop=1');
    expect(url).toContain('playlist=4KEZRGlwJU4');
    expect(url).toContain('controls=0');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/__tests__/youtube.test.js`

- [ ] **Step 3: Implement**

Replace `youtubeEmbedUrl` in `src/lib/youtube.js`:

```js
// autoplay implies mute — the only autoplay a browser will honour. `background`
// is the ambient hero mode: muted, looping, chromeless (loop needs playlist=id).
export function youtubeEmbedUrl(url, { autoplay = false, background = false } = {}) {
  const id = youtubeId(url);
  if (!id) return url ?? '';
  if (background) {
    const p = `autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&playsinline=1&rel=0`;
    return `https://www.youtube.com/embed/${id}?${p}`;
  }
  const params = ['rel=0', 'playsinline=1'];
  if (autoplay) params.push('autoplay=1', 'mute=1');
  return `https://www.youtube.com/embed/${id}?${params.join('&')}`;
}
```

- [ ] **Step 4: Run + lint** — `npx vitest run src/lib/__tests__/youtube.test.js` then `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube.js src/lib/__tests__/youtube.test.js
git commit -m "feat: youtube background-embed mode (muted, looping, chromeless)"
```

---

### Task 3: `HomeVideo` cinematic peaks hero

**Files:**
- Modify: `src/components/HomeVideo.jsx`
- Test: `src/components/__tests__/HomeVideo.test.jsx`, `src/pages/__tests__/HomePage.test.jsx`

**Interfaces:**
- Consumes: `youtubeEmbedUrl(url, { background: true })` (Task 2).
- Produces: `HomeVideo({ film })` — full-width ambient hero band with the peaks + name overlay.

- [ ] **Step 1: Update the HomeVideo tests**

Replace `src/components/__tests__/HomeVideo.test.jsx` body's assertions:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import HomeVideo from '../HomeVideo';

const film = { id: 'f1', title: 'Palace Symphony', videoEmbedUrl: 'https://youtu.be/4KEZRGlwJU4?si=x' };

describe('HomeVideo', () => {
  it('plays the film as a chromeless looping background with the peaks + name overlay', () => {
    render(<HomeVideo film={film} />);
    const frame = screen.getByTitle('Palace Symphony');
    expect(frame.tagName).toBe('IFRAME');
    const src = frame.getAttribute('src');
    expect(src).toContain('/embed/4KEZRGlwJU4');
    expect(src).toContain('loop=1');
    expect(src).toContain('controls=0');
    // The brand overlay
    const band = screen.getByLabelText('Peak Story Studio');
    expect(within(band).getByText('Peak Story Studio')).toBeInTheDocument();
    expect(within(band).getByText('by abhinav')).toBeInTheDocument();
  });

  it('shows the branded band with no iframe when there is no film', () => {
    render(<HomeVideo film={null} />);
    expect(screen.queryByTitle('Palace Symphony')).toBeNull();
    const band = screen.getByLabelText('Peak Story Studio');
    expect(within(band).getByText('Peak Story Studio')).toBeInTheDocument();
    expect(within(band).getByText('by abhinav')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Update the HomePage test**

In `src/pages/__tests__/HomePage.test.jsx`, replace the `embeds the first film` test:

```js
  it('renders the cinematic hero band with the studio name overlay', () => {
    renderPage({ films: [film] });
    const band = screen.getByLabelText('Peak Story Studio');
    expect(band).toBeInTheDocument();
    expect(screen.getByTitle(film.title).tagName).toBe('IFRAME');
  });
```

(The `film` fixture already uses `https://www.youtube.com/embed/4KEZRGlwJU4`, an 11-char id — good.)

- [ ] **Step 3: Run to verify both fail** — `npx vitest run src/components/__tests__/HomeVideo.test.jsx src/pages/__tests__/HomePage.test.jsx`

- [ ] **Step 4: Implement `src/components/HomeVideo.jsx`**

```jsx
import React from 'react';
import { youtubeEmbedUrl } from '../lib/youtube';

const WORDMARK = 'Peak Story Studio';
const TAGLINE = 'by abhinav';

// The Option-1 mountain range: two fine strokes drawn under the wordmark.
// Decorative — aria-hidden; the band itself carries the accessible name.
function Peaks() {
  return (
    <svg
      viewBox="0 0 520 90"
      className="w-[min(520px,64vw)] my-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 78 L120 30 L180 58 L270 8 L360 58 L420 34 L516 78" opacity="0.95" />
      <path d="M4 86 L150 52 L250 74 L360 44 L516 86" opacity="0.5" />
    </svg>
  );
}

// The Home page's cinematic hero: the film plays muted, looping, and
// chromeless as a full-width ambient background, dimmed, with the studio
// name + mountain range + "by abhinav" overlaid. Full-width, natural 16:9
// height ("fit to the screen width", no crop or letterbox). The full films
// stay playable with sound on the Films page.
export default function HomeVideo({ film }) {
  return (
    <section className="w-full">
      <div
        className="relative w-full aspect-video overflow-hidden bg-pitch-950"
        aria-label={WORDMARK}
      >
        {film && (
          <iframe
            src={youtubeEmbedUrl(film.videoEmbedUrl, { background: true })}
            title={film.title}
            tabIndex={-1}
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-pitch-950/45 via-pitch-950/20 to-pitch-950/60" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-offwhite-50 px-6 pointer-events-none">
          <h2 className="font-garamond uppercase tracking-[0.34em] text-[clamp(1.6rem,5vw,4rem)] leading-none" style={{ textIndent: '0.34em' }}>
            {WORDMARK}
          </h2>
          <Peaks />
          <p className="font-script text-[clamp(1.2rem,2.6vw,2.1rem)] text-offwhite-100">{TAGLINE}</p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run the two files + lint**

Run: `npx vitest run src/components/__tests__/HomeVideo.test.jsx src/pages/__tests__/HomePage.test.jsx` then `npm run lint`.

- [ ] **Step 6: Commit**

```bash
git add src/components/HomeVideo.jsx src/components/__tests__/HomeVideo.test.jsx src/pages/__tests__/HomePage.test.jsx
git commit -m "feat: Home video is a full-width cinematic peaks hero"
```

---

### Task 4: Logo data layer

**Files:**
- Create: `supabase/migrations/20260808100000_settings_logo.sql`
- Modify: `src/lib/queries/siteSettings.js`, `src/lib/queries/adminSettings.js`, `src/data/siteSettingsFallback.js`
- Test: `src/lib/queries/__tests__/siteSettings.test.js`, `src/lib/queries/__tests__/adminSettings.test.js`

**Interfaces:**
- Produces: `site_settings.logo_media_id` (nullable uuid). `getSiteSettings()` returns top-level `logo: string | null` (a URL or null). `SITE_SETTINGS_FALLBACK.logo = null`. `adminSettings` round-trips `logoMediaId`.

- [ ] **Step 1: Write and apply the migration**

`supabase/migrations/20260808100000_settings_logo.sql`:

```sql
-- Phase 3h: an admin-uploadable studio logo (circular navbar badge). One
-- nullable media reference on the settings row; existing policies cover it.
alter table public.site_settings
  add column logo_media_id uuid references public.media(id);
```

Run: `npx supabase migration up`.

- [ ] **Step 2: Update the query tests**

In `src/lib/queries/__tests__/siteSettings.test.js`, add to `FULL_ROW`: `logo: { storage_path: 'uploads/logo.webp' },` and assert in the first test:

```js
    expect(settings.logo).toBe('https://cdn.peakstorystudio.test/uploads/logo.webp');
```

Add to the null-media test (`hero: null, brand_story: null, closing: null` case) `logo: null,` and assert `expect(settings.logo).toBeNull();`. In the `SITE_SETTINGS_FALLBACK` `toEqual`, add `logo: null,`.

In `src/lib/queries/__tests__/adminSettings.test.js`, add `logo_media_id: 'm-logo',` to `ROW` and assert `expect(item.logoMediaId).toBe('m-logo');`.

- [ ] **Step 3: Implement**

`siteSettings.js`: add `logo:logo_media_id (storage_path)` to `SETTINGS_SELECT` (alongside the other media joins), and add to the returned object (after `fonts`):

```js
    logo: data.logo?.storage_path ? publicMediaUrl(data.logo.storage_path) : null,
```

`adminSettings.js`: add `'logo_media_id'` to `COLUMNS`.

`siteSettingsFallback.js`: add `logo: null,` (after `fonts`).

- [ ] **Step 4: Run the two query files + lint**

Run: `npx vitest run src/lib/queries/__tests__/siteSettings.test.js src/lib/queries/__tests__/adminSettings.test.js` then `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260808100000_settings_logo.sql src/lib/queries/siteSettings.js src/lib/queries/adminSettings.js src/data/siteSettingsFallback.js src/lib/queries/__tests__/siteSettings.test.js src/lib/queries/__tests__/adminSettings.test.js
git commit -m "feat: site_settings carries an admin-uploadable logo"
```

---

### Task 5: SettingsForm logo slot

**Files:**
- Modify: `src/admin/SettingsForm.jsx`
- Test: `src/admin/__tests__/SettingsForm.test.jsx`, `src/admin/__tests__/App.test.jsx`

**Interfaces:**
- Consumes: the existing `MediaSlot` flow. The settings row now carries `logoMediaId`.

- [ ] **Step 1: Update the tests**

In `src/admin/__tests__/App.test.jsx`, add `logoMediaId: null,` to the `getSettingsRow.mockResolvedValue({...})` object (next to `headingFont`/`bodyFont`).

In `src/admin/__tests__/SettingsForm.test.jsx`, add `logoMediaId: 'm-hero',` to `INITIAL` (reuse an id already in the `MEDIA` fixture so it resolves), and add:

```js
  it('offers a Logo upload slot', async () => {
    await renderForm();
    expect(screen.getByRole('group', { name: /^logo$/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/admin/__tests__/SettingsForm.test.jsx`

- [ ] **Step 3: Implement**

In `src/admin/SettingsForm.jsx`, add a fourth entry to `IMAGE_SLOTS`:

```js
  { key: 'logoMediaId', label: 'Logo', help: 'Shown as a circular badge in the navbar. A square image works best.' },
```

(No other change — the existing `IMAGE_SLOTS.map(...)` renders it as a `MediaSlot` exactly like the others.)

- [ ] **Step 4: Run both files + lint**

Run: `npx vitest run src/admin/__tests__/SettingsForm.test.jsx src/admin/__tests__/App.test.jsx` then `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/admin/SettingsForm.jsx src/admin/__tests__/SettingsForm.test.jsx src/admin/__tests__/App.test.jsx
git commit -m "feat(admin): upload a studio logo in Settings"
```

---

### Task 6: Navbar circular logo + restyle + threading

**Files:**
- Modify: `src/components/Navbar.jsx`, `src/components/Layout.jsx`, `src/App.jsx`
- Test: `src/components/__tests__/Navbar.test.jsx`, `src/__tests__/App.routes.test.jsx`

**Interfaces:**
- Consumes: `settings.logo` (Task 4).
- Produces: `Navbar({ ..., logo = null })`; `Layout({ ..., logo = null })` forwards it.

- [ ] **Step 1: Add the failing Navbar tests**

In `src/components/__tests__/Navbar.test.jsx`, append:

```js
describe('logo badge', () => {
  it('renders a circular logo before the wordmark when a logo is set', () => {
    renderAt('/', { logo: '/images/logo.png' });
    const img = document.querySelector('header img');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('/images/logo.png');
    expect(img.className).toMatch(/rounded-full/);
  });

  it('renders no logo image when none is set', () => {
    renderAt('/');
    expect(document.querySelector('header img')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/components/__tests__/Navbar.test.jsx`

- [ ] **Step 3: Implement the Navbar lockup + restyle**

In `src/components/Navbar.jsx`, add `logo = null` to the props. Replace the centered wordmark block:

```jsx
        {/* Wordmark, centered */}
        <div className="text-center">
          <Link
            to="/"
            className="inline-block font-garamond text-2xl sm:text-3xl tracking-[0.25em] text-pitch-900"
          >
            Peak Story Studio
          </Link>
        </div>
```

with a logo + wordmark lockup:

```jsx
        {/* Wordmark lockup, centered — with the studio logo as a circular badge when set */}
        <div className="flex items-center justify-center gap-3">
          {logo && (
            <img
              src={logo}
              alt=""
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-1 ring-pitch-900/15 shrink-0"
            />
          )}
          <Link
            to="/"
            className="inline-block font-garamond text-2xl sm:text-3xl tracking-[0.25em] text-pitch-900"
          >
            Peak Story Studio
          </Link>
        </div>
```

Restyle for a classier feel (existing tokens only): change the outer `<nav>` bottom padding and add a hairline rule under the links row. Specifically, in the links row `<div className="hidden md:flex items-center justify-center gap-8 mt-5">` change `mt-5` to `mt-6` and, immediately after that links `</div>`, the existing `<header>` already has `border-b border-pitch-900/10` — keep it. Add subtle breathing room: change the `<nav>`'s `pt-8 pb-5` to `pt-9 pb-6`. (No structural change; spacing only.)

- [ ] **Step 4: Thread through Layout and App**

`src/components/Layout.jsx`: add `logo = null` to the signature and pass `logo={logo}` to `<Navbar ... />`.

`src/App.jsx`: in the `<Layout ... />` element (next to `contact={settings.contact}`), add `logo={settings.logo}`.

`src/__tests__/App.routes.test.jsx`: the `useSiteSettings` mock's `data` gains `logo: null,` (so `settings.logo` is defined).

- [ ] **Step 5: Run Navbar + App-routes + lint**

Run: `npx vitest run src/components/__tests__/Navbar.test.jsx src/__tests__/App.routes.test.jsx` then `npm run lint`.

- [ ] **Step 6: Commit**

```bash
git add src/components/Navbar.jsx src/components/Layout.jsx src/App.jsx src/components/__tests__/Navbar.test.jsx src/__tests__/App.routes.test.jsx
git commit -m "feat: circular studio logo in a restyled navbar lockup"
```

---

### Task 7: Docs, gates, responsive + logo smoke

**Files:**
- Modify: `docs/DATA-MODEL.md`, `docs/ARCHITECTURE.md`, `docs/COMPONENTS.md`, `docs/ROADMAP.md`

- [ ] **Step 1: `docs/DATA-MODEL.md`** — in the `site_settings` bullet, note it also carries `logo_media_id` (the admin-uploadable studio logo, rendered as a circular navbar badge; nullable, no shipped default).

- [ ] **Step 2: `docs/ARCHITECTURE.md`** — one sentence: since Phase 3h the Home video is a full-width, chromeless, looping ambient hero with a mountain-peaks + wordmark overlay; the Home quote uses Dancing Script; and the navbar shows the admin-uploaded logo as a circular badge.

- [ ] **Step 3: `docs/COMPONENTS.md`** — update the `HomeVideo` row (now the full-width cinematic ambient hero with the peaks + "Peak Story Studio" + "by abhinav" overlay; `film` prop; deps `youtube.js`), the `Navbar` row (new `logo` prop → circular badge before the wordmark), and the `Layout` row (forwards `logo`).

- [ ] **Step 4: Full gates, each standalone**

```bash
npm test
npm run lint
npm run check:docs
npm run build
git checkout -- dist/ && git clean -fx dist/
```

Expected: suite green; lint `0 errors, 2 warnings`; check:docs passes; build clean.

- [ ] **Step 5: Live smoke (Playwright)**

With `npm run dev` + the stack up: screenshot Home at 390 / 820 / 1280 px — the video band spans full width with the **Peak Story Studio** + peaks + **by abhinav** overlay, the quote above is Dancing Script, and there is no sideways scroll. Then, in the admin, upload a logo in Settings → Logo (use `public/images/home/brand-story.jpg` as a stand-in file), reload Home, confirm the **circular badge** appears before the wordmark; screenshot it; then **remove** the probe logo in Settings and save (owner's real database — leave it as found). LOOK at every screenshot. Note in the report that YouTube background embeds may show faint branding and that autoplay/loop is best-effort under the headless autoplay policy — the deterministic assertions live in the unit tests; the screenshots confirm layout.

- [ ] **Step 6: Commit**

```bash
git add docs/DATA-MODEL.md docs/ARCHITECTURE.md docs/COMPONENTS.md docs/ROADMAP.md
git commit -m "docs: Phase 3h — cinematic hero, Dancing Script quote, admin logo, navbar"
```

Also add the `v0.4h` ROADMAP row (`3h — Home hero, peaks, logo, navbar | Full-width cinematic peaks hero; Dancing Script quote; admin logo; restyled navbar | The Home video is a branded full-width hero and the logo is admin-controlled | local`) and a short Phase 3h paragraph after 3g's, linking the spec — in Step 3's edit or here.

---

## After the last task

Use superpowers:finishing-a-development-branch: full suite on the branch, present the integration menu (owner's standing pattern is merge to `main` locally + tag `v0.4h`; never push without asking).
