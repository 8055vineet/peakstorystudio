# Home & Chrome Polish (Phase 3g, `v0.4g`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-picked site fonts (heading + body), the native cursor back, and a full-width autoplaying Home video that uses YouTube's own player — all responsive.

**Architecture:** Two new `site_settings` columns drive site-wide fonts through CSS variables the public `App` sets from settings; the Tailwind `garamond`/`sans` roles read those variables. `CustomCursor` is deleted. The Home video block becomes an autoplaying muted YouTube `<iframe>` built by a new `youtube.js` URL helper.

**Tech Stack:** React 18, Tailwind (CSS-variable font roles), Supabase (one migration), Vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-08-07-home-chrome-polish-design.md` — authority when this plan is ambiguous.

## Global Constraints

- Plain JavaScript, `.jsx` for components. No TypeScript. Tailwind inline, existing palette tokens only.
- Components never import the Supabase client; pure-data modules (`src/data/*`) never do either.
- Schema changes only in `supabase/migrations/`, applied with `npx supabase migration up` — **never `npm run db:reset`** (real data).
- `useContent` fallbacks stay module-level constants.
- ESLint `--max-warnings=2` (the two tracked `useScrollReveal` warnings); react-hooks purity enforced.
- Run `npm run lint` and `npm test` standalone before each commit.
- Conventional Commits; stay on `phase-3g/home-chrome-polish`.
- Verbatim: heading default `Cormorant Garamond`; body default `Plus Jakarta Sans`; placeholder `Video to be added`; autoplay is **muted** (`autoplay=1&mute=1`); admin section heading **Typography**; field labels **Heading font** / **Body font**.
- Curated fonts — Heading: Cormorant Garamond, Playfair Display, EB Garamond, Libre Baskerville, Marcellus, Cinzel. Body: Plus Jakarta Sans, Inter, Lato, Montserrat, Work Sans, Nunito Sans.

---

### Task 1: Font data layer — migration, options, fallback, queries

**Files:**
- Create: `supabase/migrations/20260807110000_settings_fonts.sql`, `src/data/fontOptions.js`
- Modify: `src/data/siteSettingsFallback.js`, `src/lib/queries/siteSettings.js`, `src/lib/queries/adminSettings.js`
- Test: `src/lib/queries/__tests__/siteSettings.test.js`, `src/lib/queries/__tests__/adminSettings.test.js`

**Interfaces:**
- Produces: `site_settings.heading_font`/`body_font` (text, defaulted). `fontOptions.js` exports `HEADING_FONTS`/`BODY_FONTS` (`[{ value, label }]`), `DEFAULT_HEADING_FONT`, `DEFAULT_BODY_FONT`, `isKnownFont(value, role)`. `getSiteSettings()` returns `fonts: { heading, body }`. `SITE_SETTINGS_FALLBACK.fonts = { heading, body }`. `adminSettings` round-trips `headingFont`/`bodyFont`.

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260807110000_settings_fonts.sql`:

```sql
-- Phase 3g: admin-chosen site fonts. Two more columns on the one settings
-- row; the existing read-all / admin-update policies already cover them.
alter table public.site_settings
  add column heading_font text not null default 'Cormorant Garamond',
  add column body_font text not null default 'Plus Jakarta Sans';
```

- [ ] **Step 2: Apply it incrementally**

Run: `npx supabase migration up`
Expected: applies only this migration.

- [ ] **Step 3: Create `src/data/fontOptions.js`**

```js
// FALLBACK + CHOICES for the admin font control (Phase 3g). Pure data: the
// public site applies these via CSS variables and the admin renders them in
// two selects. `value` is the exact CSS family name stored in site_settings
// and set on --font-heading / --font-body; the generic fallback (serif /
// sans-serif) is supplied by tailwind.config.js's font-family stacks.
export const HEADING_FONTS = [
  { value: 'Cormorant Garamond', label: 'Cormorant Garamond' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'EB Garamond', label: 'EB Garamond' },
  { value: 'Libre Baskerville', label: 'Libre Baskerville' },
  { value: 'Marcellus', label: 'Marcellus' },
  { value: 'Cinzel', label: 'Cinzel' },
];

export const BODY_FONTS = [
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Work Sans', label: 'Work Sans' },
  { value: 'Nunito Sans', label: 'Nunito Sans' },
];

export const DEFAULT_HEADING_FONT = 'Cormorant Garamond';
export const DEFAULT_BODY_FONT = 'Plus Jakarta Sans';

export function isKnownFont(value, role) {
  const list = role === 'heading' ? HEADING_FONTS : BODY_FONTS;
  return list.some((font) => font.value === value);
}
```

- [ ] **Step 4: Update `src/data/siteSettingsFallback.js`**

Add the import and the `fonts` key:

```js
import { DEFAULT_HEADING_FONT, DEFAULT_BODY_FONT } from './fontOptions';
```

and inside the exported object (after `contact`):

```js
  fonts: { heading: DEFAULT_HEADING_FONT, body: DEFAULT_BODY_FONT },
```

- [ ] **Step 5: Update the fallback test**

`src/lib/queries/__tests__/siteSettings.test.js`, the `SITE_SETTINGS_FALLBACK` `toEqual` — add to the expected object:

```js
      fonts: { heading: 'Cormorant Garamond', body: 'Plus Jakarta Sans' },
```

And in the `getSiteSettings` test's `FULL_ROW`, add `heading_font: 'Playfair Display', body_font: 'Inter',`, then assert in the first test:

```js
    expect(settings.fonts).toEqual({ heading: 'Playfair Display', body: 'Inter' });
```

- [ ] **Step 6: Update `src/lib/queries/siteSettings.js`**

Add `heading_font, body_font` to `SETTINGS_SELECT` (top line, alongside the other scalar columns), and add to the returned object (after `contact`):

```js
    fonts: { heading: data.heading_font, body: data.body_font },
```

- [ ] **Step 7: Update `src/lib/queries/adminSettings.js` + its test**

In `adminSettings.js`, add `'heading_font'`, `'body_font'` to the `COLUMNS` array (after `'youtube_url'`).

In `src/lib/queries/__tests__/adminSettings.test.js`: add `heading_font: 'Marcellus', body_font: 'Lato',` to `ROW`, and in the `maps snake_case columns to camelCase` test add:

```js
    expect(item.headingFont).toBe('Marcellus');
    expect(item.bodyFont).toBe('Lato');
```

- [ ] **Step 8: Run the two query test files + lint**

Run: `npx vitest run src/lib/queries/__tests__/siteSettings.test.js src/lib/queries/__tests__/adminSettings.test.js` then `npm run lint`.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260807110000_settings_fonts.sql src/data/fontOptions.js src/data/siteSettingsFallback.js src/lib/queries/siteSettings.js src/lib/queries/adminSettings.js src/lib/queries/__tests__/siteSettings.test.js src/lib/queries/__tests__/adminSettings.test.js
git commit -m "feat: site_settings carries admin-chosen heading/body fonts"
```

---

### Task 2: Apply fonts — Tailwind CSS vars, App effect, font loading

**Files:**
- Modify: `tailwind.config.js`, `src/App.jsx`, `index.html`
- Test: `src/__tests__/App.routes.test.jsx`

**Interfaces:**
- Consumes: `settings.fonts` (Task 1).
- Produces: the public site's `font-garamond`/`font-sans` resolve from `--font-heading`/`--font-body`, which `App` sets from settings.

- [ ] **Step 1: Add the failing App-routes assertion**

In `src/__tests__/App.routes.test.jsx`, add `fonts` to the `useSiteSettings` mock's `data`:

```js
      fonts: { heading: 'Playfair Display', body: 'Inter' },
```

and a new test in the `routing` describe:

```js
  it('applies the admin-chosen fonts as CSS variables on the document', () => {
    renderAt('/');
    expect(document.documentElement.style.getPropertyValue('--font-heading')).toContain('Playfair Display');
    expect(document.documentElement.style.getPropertyValue('--font-body')).toContain('Inter');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/App.routes.test.jsx`
Expected: the new test FAILS (variables unset).

- [ ] **Step 3: Tailwind roles read the variables**

In `tailwind.config.js`, change the two public roles (leave `cinzel` and `script` fixed):

```js
        garamond: ['var(--font-heading, "Cormorant Garamond")', 'serif'],
        sans: ['var(--font-body, "Plus Jakarta Sans")', 'sans-serif'],
```

- [ ] **Step 4: `App` sets the variables from settings**

In `src/App.jsx`, add an effect below the existing `useEffect` (the `user`/localStorage one):

```jsx
  // Apply the admin-chosen fonts site-wide (Phase 3g). Tailwind's
  // font-garamond/font-sans roles read these variables, falling back to the
  // shipped families when unset. Guarded so an outage/fallback with no fonts
  // key leaves the Tailwind default in place.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.fonts?.heading) root.style.setProperty('--font-heading', `"${settings.fonts.heading}"`);
    if (settings.fonts?.body) root.style.setProperty('--font-body', `"${settings.fonts.body}"`);
  }, [settings.fonts?.heading, settings.fonts?.body]);
```

(`useEffect` is already imported in App.jsx.)

- [ ] **Step 5: Load the curated fonts**

In `index.html`, replace the existing Google Fonts `<link href=...>` (the `css2?family=...` one) so its `family=` list also includes the new families (keep the existing four). The full href:

```
https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,600&family=EB+Garamond:wght@400;500;600&family=Great+Vibes&family=Inter:wght@300;400;500;600&family=Lato:wght@300;400;700&family=Libre+Baskerville:wght@400;700&family=Marcellus&family=Montserrat:wght@300;400;500;600&family=Nunito+Sans:wght@300;400;600&family=Playfair+Display:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Work+Sans:wght@300;400;500;600&display=swap
```

- [ ] **Step 6: Run App-routes tests + lint**

Run: `npx vitest run src/__tests__/App.routes.test.jsx` then `npm run lint`.
Expected: green. (The other route tests already pass through the same mock.)

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.js src/App.jsx index.html src/__tests__/App.routes.test.jsx
git commit -m "feat: apply admin-chosen fonts site-wide via CSS variables"
```

---

### Task 3: SettingsForm — the Typography section

**Files:**
- Modify: `src/admin/SettingsForm.jsx`
- Test: `src/admin/__tests__/SettingsForm.test.jsx`

**Interfaces:**
- Consumes: `fontOptions` (Task 1). `SettingsForm`'s props are unchanged; the `initial` row now carries `headingFont`/`bodyFont`, and the submitted `values` include them.

- [ ] **Step 1: Update the tests**

In `src/admin/__tests__/App.test.jsx`, the `getSettingsRow.mockResolvedValue({...})` in the top-level `beforeEach` gains `headingFont: 'Cormorant Garamond', bodyFont: 'Plus Jakarta Sans',` so the Settings tab's Typography selects render as controlled with a real value (avoids a React warning; the existing Settings/Booking-services tests keep passing).

In `src/admin/__tests__/SettingsForm.test.jsx`, add `headingFont: 'Cormorant Garamond', bodyFont: 'Plus Jakarta Sans',` to the `INITIAL` fixture, then add:

```js
  it('renders the Typography selects with the current fonts and submits a change', async () => {
    const { props } = await renderForm();
    expect(screen.getByLabelText(/heading font/i)).toHaveValue('Cormorant Garamond');
    expect(screen.getByLabelText(/body font/i)).toHaveValue('Plus Jakarta Sans');
    fireEvent.change(screen.getByLabelText(/heading font/i), { target: { value: 'Playfair Display' } });
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(props.onSave.mock.calls[0][0]).toMatchObject({ headingFont: 'Playfair Display' });
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/admin/__tests__/SettingsForm.test.jsx`
Expected: the new test FAILS (no Typography selects).

- [ ] **Step 3: Implement**

In `src/admin/SettingsForm.jsx`, import the options:

```js
import { HEADING_FONTS, BODY_FONTS } from '../data/fontOptions';
```

Add a `select` helper next to the existing `text` helper:

```js
  const fontSelect = (field, label, options) => {
    const id = `${uid}-${field}`;
    return (
      <Field id={id} label={label} error={errors[field]}>
        <select
          id={id}
          value={values[field] ?? ''}
          onChange={(e) => set(field, e.target.value)}
          className={INPUT_CLASS}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>{opt.label}</option>
          ))}
        </select>
      </Field>
    );
  };
```

Add a Typography `<section>` before the "Contact & Social" section:

```jsx
      <section className={SECTION_CLASS}>
        <h2 className="font-cinzel text-lg font-bold text-pitch-900">Typography</h2>
        <p className="text-xs text-charcoal-500">
          The fonts the public site uses for headings and body text.
        </p>
        {fontSelect('headingFont', 'Heading font', HEADING_FONTS)}
        {fontSelect('bodyFont', 'Body font', BODY_FONTS)}
      </section>
```

(No new validation entry needed — a select can only submit a known value; the existing `validate` covers the required text fields.)

- [ ] **Step 4: Run + lint**

Run: `npx vitest run src/admin/__tests__/SettingsForm.test.jsx` then `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/admin/SettingsForm.jsx src/admin/__tests__/SettingsForm.test.jsx src/admin/__tests__/App.test.jsx
git commit -m "feat(admin): Typography section — pick heading and body fonts"
```

---

### Task 4: Revert the custom cursor

**Files:**
- Modify: `src/components/Layout.jsx`, `src/index.css`, `docs/COMPONENTS.md`
- Delete: `src/components/CustomCursor.jsx`, `src/components/__tests__/CustomCursor.test.jsx`

**Interfaces:** none outward — the native cursor returns.

- [ ] **Step 1: Remove from `Layout.jsx`**

Delete the `import CustomCursor from './CustomCursor';` line and the `<CustomCursor />` element.

- [ ] **Step 2: Delete the component and its test**

```bash
git rm src/components/CustomCursor.jsx src/components/__tests__/CustomCursor.test.jsx
```

- [ ] **Step 3: Remove the cursor CSS from `src/index.css`**

Delete the block that starts with the `/* Custom pointer (CustomCursor component)... */` comment through the end of `.cursor-ring-engaged { ... }` (the `@media (hover: hover)...{ .custom-cursor-active ... }` rule, `.cursor-dot`, `.cursor-ring`, `.cursor-ring-engaged`). Leave the `/* Falling petals background... */` block and everything after it untouched.

- [ ] **Step 4: Update `docs/COMPONENTS.md`**

Remove the `CustomCursor` table row. In the deleted-components note near the top (the paragraph listing Phase 3b deletions and noting CustomCursor "later returned"), append that it was **removed again in Phase 3g** — so the note now reads that CustomCursor returned in a rebuilt form and was then removed for good in Phase 3g.

- [ ] **Step 5: Run the component suite + docs check + lint**

Run: `npx vitest run src/components/ src/__tests__/App.routes.test.jsx` (no CustomCursor references remain), then `npm run check:docs`, then `npm run lint`.
Expected: green; check:docs passes (no doc cites the deleted file).

- [ ] **Step 6: Commit**

```bash
git add src/components/Layout.jsx src/index.css docs/COMPONENTS.md
git commit -m "feat: remove the custom cursor — native pointer returns"
```

---

### Task 5: `youtube.js` URL helper

**Files:**
- Create: `src/lib/youtube.js`
- Test: `src/lib/__tests__/youtube.test.js`

**Interfaces:**
- Produces: `youtubeId(url) → string | null`; `youtubeEmbedUrl(url, { autoplay = false } = {}) → string`. Task 6 consumes both.

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/youtube.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { youtubeId, youtubeEmbedUrl } from '../youtube';

describe('youtubeId', () => {
  it('extracts the id from every YouTube URL form', () => {
    expect(youtubeId('https://www.youtube.com/embed/4KEZRGlwJU4')).toBe('4KEZRGlwJU4');
    expect(youtubeId('https://www.youtube.com/embed/4KEZRGlwJU4?autoplay=1')).toBe('4KEZRGlwJU4');
    expect(youtubeId('https://www.youtube.com/watch?v=4KEZRGlwJU4&t=30s')).toBe('4KEZRGlwJU4');
    expect(youtubeId('https://www.youtube.com/watch?list=PL1&v=4KEZRGlwJU4')).toBe('4KEZRGlwJU4');
    expect(youtubeId('https://youtu.be/4KEZRGlwJU4?si=abc')).toBe('4KEZRGlwJU4');
    expect(youtubeId('https://www.youtube.com/shorts/4KEZRGlwJU4')).toBe('4KEZRGlwJU4');
  });

  it('returns null for a non-YouTube or empty url', () => {
    expect(youtubeId('https://vimeo.com/123456')).toBeNull();
    expect(youtubeId('')).toBeNull();
    expect(youtubeId(null)).toBeNull();
  });
});

describe('youtubeEmbedUrl', () => {
  it('builds a canonical embed url, muted-autoplay when asked', () => {
    expect(youtubeEmbedUrl('https://youtu.be/4KEZRGlwJU4?si=x'))
      .toBe('https://www.youtube.com/embed/4KEZRGlwJU4?rel=0&playsinline=1');
    const auto = youtubeEmbedUrl('https://www.youtube.com/watch?v=4KEZRGlwJU4', { autoplay: true });
    expect(auto).toContain('/embed/4KEZRGlwJU4?');
    expect(auto).toContain('autoplay=1');
    expect(auto).toContain('mute=1');
  });

  it('passes a non-YouTube url through unchanged', () => {
    expect(youtubeEmbedUrl('https://player.vimeo.com/video/123')).toBe('https://player.vimeo.com/video/123');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/__tests__/youtube.test.js`

- [ ] **Step 3: Implement `src/lib/youtube.js`**

```js
// Turns any YouTube link an admin might paste — embed, watch, youtu.be, or
// shorts — into a clean embed URL. This is why a pasted "youtu.be/..." share
// link no longer "refuses to connect" when embedded: those cannot be framed,
// but the /embed/ form built here can.

export function youtubeId(url) {
  if (!url) return null;
  const s = String(url);
  const direct = s.match(/(?:youtu\.be\/|youtube\.com\/(?:embed|shorts)\/)([A-Za-z0-9_-]{11})/);
  if (direct) return direct[1];
  const v = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  return v ? v[1] : null;
}

// autoplay implies mute — the only autoplay a browser will honour.
export function youtubeEmbedUrl(url, { autoplay = false } = {}) {
  const id = youtubeId(url);
  if (!id) return url ?? '';
  const params = ['rel=0', 'playsinline=1'];
  if (autoplay) params.push('autoplay=1', 'mute=1');
  return `https://www.youtube.com/embed/${id}?${params.join('&')}`;
}
```

- [ ] **Step 4: Run + lint** — `npx vitest run src/lib/__tests__/youtube.test.js` then `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube.js src/lib/__tests__/youtube.test.js
git commit -m "feat: youtube url helper — id extraction + canonical embed url"
```

---

### Task 6: `HomeVideo` autoplay embed + HomePage rewire

**Files:**
- Create: `src/components/HomeVideo.jsx`
- Modify: `src/pages/HomePage.jsx`, `src/App.jsx`, `docs/COMPONENTS.md`
- Test: `src/components/__tests__/HomeVideo.test.jsx`, `src/pages/__tests__/HomePage.test.jsx`

**Interfaces:**
- Consumes: `youtubeEmbedUrl` (Task 5).
- Produces: `HomeVideo({ film })`.

- [ ] **Step 1: Write the failing HomeVideo test**

`src/components/__tests__/HomeVideo.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomeVideo from '../HomeVideo';

const film = { id: 'f1', title: 'Palace Symphony', videoEmbedUrl: 'https://youtu.be/4KEZRGlwJU4?si=x' };

describe('HomeVideo', () => {
  it('embeds an autoplaying muted YouTube player using the video id', () => {
    render(<HomeVideo film={film} />);
    const frame = screen.getByTitle('Palace Symphony');
    expect(frame.tagName).toBe('IFRAME');
    const src = frame.getAttribute('src');
    expect(src).toContain('/embed/4KEZRGlwJU4');
    expect(src).toContain('autoplay=1');
    expect(src).toContain('mute=1');
  });

  it('shows the placeholder when there is no film', () => {
    render(<HomeVideo film={null} />);
    expect(screen.getByText('Video to be added')).toBeInTheDocument();
    expect(screen.queryByTitle('Palace Symphony')).toBeNull();
  });
});
```

- [ ] **Step 2: Update the HomePage test**

In `src/pages/__tests__/HomePage.test.jsx`, replace the `shows the first film, playable` test:

```js
  it('embeds the first film as an autoplaying player when one is published', () => {
    renderPage({ films: [film] });
    expect(screen.queryByText('Video to be added')).toBeNull();
    const frame = screen.getByTitle(film.title);
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('src')).toContain('autoplay=1');
  });
```

(The `film` fixture's `videoEmbedUrl` is `https://www.youtube.com/embed/example` — `youtubeId` needs 11 chars; change that fixture value to `https://www.youtube.com/embed/4KEZRGlwJU4` so the embed url resolves. The `onOpenVideo` fixture prop can stay in `renderPage`; HomePage simply ignores it now.)

- [ ] **Step 3: Run to verify both fail** — `npx vitest run src/components/__tests__/HomeVideo.test.jsx src/pages/__tests__/HomePage.test.jsx`

- [ ] **Step 4: Implement `src/components/HomeVideo.jsx`**

```jsx
import React from 'react';
import { youtubeEmbedUrl } from '../lib/youtube';

// The Home page's video block: the embedded player itself, full content
// width and 16:9, autoplaying muted on load (the only autoplay a browser
// allows) and using YouTube's own thumbnail/player — nothing hardcoded.
// Home-only; the Films/Stories pages keep their click-to-play modal.
export default function HomeVideo({ film }) {
  return (
    <section className="pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative w-full aspect-video overflow-hidden bg-pitch-950">
          {film ? (
            <iframe
              src={youtubeEmbedUrl(film.videoEmbedUrl, { autoplay: true })}
              title={film.title}
              className="absolute inset-0 w-full h-full border-0"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-charcoal-400/60">
              <p className="font-garamond text-pitch-700 text-xl tracking-wide">Video to be added</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Rewire `HomePage.jsx`**

Replace `import { Play } from 'lucide-react';` with `import HomeVideo from '../components/HomeVideo';` (drop the `Play` import). Remove `onOpenVideo` from the destructured props. Replace the entire `{/* Video */}` `<section>...</section>` block with:

```jsx
      {/* Video — the embedded player, autoplaying muted on load */}
      <HomeVideo film={featuredFilm} />
```

- [ ] **Step 6: Stop passing `onOpenVideo` to HomePage in `App.jsx`**

In `src/App.jsx`, remove the `onOpenVideo={(url) => setVideoModalUrl(url)}` prop from the `<HomePage ... />` element only (the `StoriesPage`/`FilmsPage` modal wiring and `videoModalUrl` state stay).

- [ ] **Step 7: Document HomeVideo, drop the Video-modal mention if any**

In `docs/COMPONENTS.md`, add a `HomeVideo` row (Purpose: the Home page's autoplaying, muted, full-width YouTube embed; Props: `film`; Notable deps: `src/lib/youtube.js`). Update the `HomePage` page-row's composition sentence: the video block now autoplays the first film's YouTube embed (muted) instead of a thumbnail-and-play-button.

- [ ] **Step 8: Run the affected tests + docs + lint**

Run: `npx vitest run src/components/__tests__/HomeVideo.test.jsx src/pages/__tests__/HomePage.test.jsx` then `npm run check:docs` then `npm run lint`.

- [ ] **Step 9: Commit**

```bash
git add src/components/HomeVideo.jsx src/pages/HomePage.jsx src/App.jsx docs/COMPONENTS.md src/components/__tests__/HomeVideo.test.jsx src/pages/__tests__/HomePage.test.jsx
git commit -m "feat: Home video is a full-width autoplaying YouTube embed"
```

---

### Task 7: Docs, gates, responsive smoke

**Files:**
- Modify: `docs/DATA-MODEL.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`

- [ ] **Step 1: `docs/DATA-MODEL.md`** — in the `site_settings` bullet, note it now also carries `heading_font` and `body_font` (the admin-chosen site fonts, defaulted to Cormorant Garamond / Plus Jakarta Sans), applied on the public site via CSS variables.

- [ ] **Step 2: `docs/ARCHITECTURE.md`** — one sentence in the public-site overview: the two public type roles (`font-garamond`/`font-sans`) are CSS-variable-driven and set by `App` from `site_settings`; the custom cursor was removed in Phase 3g; the Home video autoplays its YouTube embed (muted).

- [ ] **Step 3: `docs/ROADMAP.md`** — add the `v0.4g` row (`3g — Home & chrome polish | Admin font control; native cursor; autoplaying full-width Home video | Fonts change from the admin; Home video autoplays and fits every screen | local`) and a short Phase 3g paragraph after 3f's, linking the spec.

- [ ] **Step 4: Full gates, each standalone**

```bash
npm test
npm run lint
npm run check:docs
npm run build
git checkout -- dist/ && git clean -fx dist/
```

Expected: suite green; lint `0 errors, 2 warnings`; check:docs passes; build clean.

- [ ] **Step 5: Live responsive smoke**

With `npm run dev` and the stack up, drive Playwright: screenshot the Home page at 390, 820, and 1280 px and LOOK — the video fills the content width at 16:9 with no letterboxing or overflow, and the page has no horizontal scroll. Confirm the document has no `cursor: none` in effect (native pointer). Then, in the admin, open Settings → Typography, change Heading font to Playfair Display, Save, reload Home, and confirm the headings changed; restore it to Cormorant Garamond afterward (owner's real database — leave it as found). Note in the report that autoplay may be gated by the browser's autoplay policy in a headless run; the iframe `src` carrying `autoplay=1&mute=1` is the deterministic assertion (covered by tests) — the screenshot confirms layout, not playback.

- [ ] **Step 6: Commit**

```bash
git add docs/DATA-MODEL.md docs/ARCHITECTURE.md docs/ROADMAP.md
git commit -m "docs: Phase 3g — fonts, cursor removal, Home video"
```

---

## After the last task

Use superpowers:finishing-a-development-branch: full suite on the branch, present the integration menu (owner's standing pattern is merge to `main` locally + tag `v0.4g`; never push without asking).
