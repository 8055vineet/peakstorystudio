# Admin CMS Completion (Phase 3c, v0.4c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the site's singular content (Home quote, Brand Story, Home images, contact, socials) admin-editable via a `site_settings` table, and rework the admin workflow (Dashboard landing, Settings tab, Add-to-Gallery, loud draft states, View-website link).

**Architecture:** One typed `site_settings` row (RLS: world-read, admin-write), read by the public site through `useSiteSettings` with the current constants as fallback, edited through a new admin Settings tab. Data still flows App → props; components keep constant defaults. Spec: `docs/superpowers/specs/2026-08-04-admin-cms-settings-design.md` — read it before any task.

**Tech Stack:** Vite 5, React 18, plain JavaScript, Supabase (Postgres + RLS), Vitest + RTL.

## Global Constraints

- **No TypeScript.** Plain `.jsx`/`.js`.
- **Schema changes only in `supabase/migrations/`.** Apply locally with `supabase migration up` — **NEVER run `npm run db:reset` in this phase: the local database holds the studio's real booking inquiries and loaded real content.** CI's from-empty reset is what proves replayability.
- **Components stay presentational**: public components receive settings as props from `src/App.jsx` with their current constant values as prop defaults; components never import the Supabase client. Admin components call hooks/queries per existing admin patterns.
- **Public components must not use `gold-*` or `font-cinzel`** (admin files in `src/admin/` are exempt and already use both).
- `npm run lint` stays at ≤2 warnings; `npm test` green; `npm run check:docs` green at the docs task.
- Conventional Commits; branch `phase-3c/admin-cms` (exists, spec committed); tag `v0.4c` at completion (after merge, by the controller).
- Never run `npm run dev` from a subagent.
- **Exact seed values** (verbatim; single quotes doubled for SQL): quote_text `Every journey builds toward a single, breathless moment. We are here to capture the story when it reaches its absolute peak.` · quote_credit `by abhinav` · brand_story_heading `The Brand Story` · the two Brand Story paragraphs exactly as in `src/data/homeContent.js` · studio_address `2/231 Vastu Khand, Gomtinagar, Lucknow, UP` · studio_email `peakstorystudio@gmail.com` · studio_phone `+91 8881621021` · whatsapp_number `918881621021` · instagram_url and youtube_url empty strings.
- Env for any script hitting the DB: `eval "$(supabase status -o env | sed 's/^/export /')"` then `SUPABASE_URL="$API_URL"`, `SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"`, `SUPABASE_ANON_KEY="$ANON_KEY"`, and for vite-node `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`.

## File Structure

**Create:** migration `supabase/migrations/20260804100000_site_settings.sql` · `src/lib/queries/siteSettings.js` · `src/lib/queries/adminSettings.js` · `src/lib/queries/adminOverview.js` · `src/admin/SettingsForm.jsx` · `src/admin/DashboardOverview.jsx` · `src/admin/CreatedDraftBanner.jsx` · tests beside each.

**Modify:** `src/hooks/useContent.js` (add `useSiteSettings`) · `src/App.jsx` (fetch settings, pass props) · `src/pages/HomePage.jsx`, `src/pages/AboutPage.jsx`, `src/components/Layout.jsx`, `src/components/Footer.jsx`, `src/components/BookingForm.jsx`, `src/components/WhatsAppButton.jsx` (props with constant defaults) · `src/admin/App.jsx` (tabs, header link, prefill flow, banners) · `src/admin/MediaPicker.jsx` (`onAddToGallery`) · `src/admin/ResourceList.jsx` (status badge) · `scripts/load-real-content.mjs` (settings step) · `scripts/verify-admin.mjs` (settings leg) · `src/data/homeContent.js`, `src/data/contact.js` (comments only) · docs.

---

### Task 1: `site_settings` migration — schema, RLS, seed

**Files:**
- Create: `supabase/migrations/20260804100000_site_settings.sql`
- Test: applied-schema check via a Node one-liner (no unit test; the table is proven by Task 2's queries and CI's reset)

**Interfaces:**
- Produces: table `public.site_settings` with exactly the columns in the spec §2 schema block; one seeded row `id = 1`.

- [ ] **Step 1: Write the migration** — exact content:

```sql
-- Phase 3c: the site's singular, admin-editable content. One row, forever.
-- See docs/superpowers/specs/2026-08-04-admin-cms-settings-design.md §2.

create table public.site_settings (
  id int primary key default 1 check (id = 1),
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
  whatsapp_number text not null default '',
  instagram_url text not null default '',
  youtube_url text not null default '',
  updated_at timestamptz not null default now()
);

-- Same grant-broadly-let-RLS-decide pattern as
-- 20260730204126_row_level_security.sql (see its own comment).
grant select, update on public.site_settings to anon, authenticated, service_role;

alter table public.site_settings enable row level security;

-- The public site reads with the anon key.
create policy site_settings_read_all on public.site_settings
  for select using (true);

-- Only admins write. No insert/delete policies exist at all: the row is
-- created below and check (id = 1) keeps it singular.
create policy site_settings_admin_update on public.site_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- Seed with the studio's real, owner-confirmed content so a from-empty
-- reset reproduces a working site with no extra step. Media ids start null;
-- scripts/load-real-content.mjs points them at the real Home images.
insert into public.site_settings (
  id, quote_text, quote_credit, brand_story_heading, brand_story_p1, brand_story_p2,
  studio_address, studio_email, studio_phone, whatsapp_number
) values (
  1,
  'Every journey builds toward a single, breathless moment. We are here to capture the story when it reaches its absolute peak.',
  'by abhinav',
  'The Brand Story',
  'At Peak Story Studio, we believe that life''s most profound moments are not just lived—they unfold like a masterpiece. Whether it is the quiet, nervous anticipation right before a wedding ceremony or the soaring crescendo of a cinematic short film, every narrative has a summit.',
  'Our passion lies in recognizing that exact heartbeat. We don''t just record events; we wait for the emotion, the light, and the connection to converge at their highest point. By freezing time at the peak of your story, we turn fleeting chapters into timeless memories that you can relive forever.',
  '2/231 Vastu Khand, Gomtinagar, Lucknow, UP',
  'peakstorystudio@gmail.com',
  '+91 8881621021',
  '918881621021'
);
```

- [ ] **Step 2: Apply without resetting** — `supabase migration up` (NOT `db:reset`; see Global Constraints). Expected output names `20260804100000_site_settings.sql`.
- [ ] **Step 3: Prove the row** — with the env mapped (Global Constraints):

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
db.from('site_settings').select('quote_credit, studio_phone').single().then(({ data, error }) => {
  if (error) { console.error(error.message); process.exit(1); }
  console.log(JSON.stringify(data));
  process.exit(data.quote_credit === 'by abhinav' && data.studio_phone === '+91 8881621021' ? 0 : 1);
});
"
```

Expected: the JSON row, exit 0 — proving anon-key read works (RLS select policy live).
- [ ] **Step 4: Prove anon cannot write** — same one-liner shape but `.update({ quote_credit: 'x' }).eq('id', 1).select()`: expect `data` to be an empty array (RLS silently filters the update; no row comes back). If a row comes back changed, the policy is wrong — stop.
- [ ] **Step 5: Commit** — `git add supabase/migrations/20260804100000_site_settings.sql && git commit -m "feat: site_settings table with RLS and real seeded content"`

### Task 2: Public read path — query + hook + fallback

**Files:**
- Create: `src/data/siteSettingsFallback.js` (pure data — importable by components without touching the query layer), `src/lib/queries/siteSettings.js`, `src/lib/queries/__tests__/siteSettings.test.js`
- Modify: `src/hooks/useContent.js`
- Test: extend `src/hooks/__tests__/useContent.test.jsx` only if it enumerates wrappers (check; if it tests the generic mechanism once, no change needed)

**Interfaces:**
- Consumes: `publicMediaUrl` from `src/lib/mediaUrl.js`; `HOME_QUOTE`, `BRAND_STORY`, `HOME_IMAGES` from `src/data/homeContent.js`; `STUDIO_*`, `WHATSAPP_NUMBER` from `src/data/contact.js`.
- Produces: `SITE_SETTINGS_FALLBACK` from **`src/data/siteSettingsFallback.js`** — a data module with NO import from `src/lib/` (components use it as prop defaults in Task 3; a fallback living in the query layer would drag the Supabase client import into presentational components, breaking the layering rule); `getSiteSettings(): Promise<Settings>` from `siteSettings.js`; `useSiteSettings()` from `useContent.js` returning `{ data: Settings, loading, error }`. Settings shape (spec §3):

```js
{
  quote: { text, credit },
  brandStory: { heading, paragraphs: [p1, p2] },
  images: { hero: { src, alt }, brandStory: { src, alt }, closing: { src, alt } },
  contact: { address, email, phone, whatsappNumber, instagramUrl, youtubeUrl },
}
```

- [ ] **Step 1: Failing test** — `src/lib/queries/__tests__/siteSettings.test.js`. Mock the supabase client module the same way `src/lib/queries/__tests__/queries.test.js` does (read it first and copy its mock idiom exactly — it stubs `../../supabase` with a chainable builder). Cases:

```js
// 1. maps a full row: quote/brandStory/contact fields come through; each
//    image src is publicMediaUrl(joined storage_path) and alt falls back to
//    the HOME_IMAGES constant alt when the row has media but you choose to
//    keep alt from the constant — see Step 3: alt comes from media.alt_text
//    when present, else the constant.
// 2. null media ids: images fall back to the exact static paths
//    '/images/home/hero.jpg', '/images/home/brand-story.jpg',
//    '/images/home/closing.jpg' with the constants' alt text.
// 3. a Postgres error rejects with 'getSiteSettings: <message>'.
// 4. SITE_SETTINGS_FALLBACK equals the constants exactly (deep-equal against
//    an object literal built inline from the imported constants).
```

- [ ] **Step 2: Run it** — `npx vitest run src/lib/queries/__tests__/siteSettings.test.js` — FAIL (module missing).
- [ ] **Step 3: Implement.** First `src/data/siteSettingsFallback.js` (pure data — imports ONLY from other `src/data/` modules):

```js
import { HOME_QUOTE, BRAND_STORY, HOME_IMAGES } from './homeContent';
import {
  STUDIO_ADDRESS, STUDIO_EMAIL, STUDIO_PHONE, WHATSAPP_NUMBER,
  STUDIO_INSTAGRAM_URL, STUDIO_YOUTUBE_URL,
} from './contact';

// The shape useSiteSettings resolves, built from the shipped constants —
// what the site renders before the settings query resolves, when it fails,
// and what components default to when rendered unwired (tests). Pure data
// on purpose: components import this as a prop default, and a component
// must never (even transitively) import the Supabase client.
export const SITE_SETTINGS_FALLBACK = {
  quote: { text: HOME_QUOTE.text, credit: HOME_QUOTE.credit },
  brandStory: { heading: BRAND_STORY.heading, paragraphs: [...BRAND_STORY.paragraphs] },
  images: {
    hero: { ...HOME_IMAGES.hero },
    brandStory: { ...HOME_IMAGES.brandStory },
    closing: { ...HOME_IMAGES.closing },
  },
  contact: {
    address: STUDIO_ADDRESS,
    email: STUDIO_EMAIL,
    phone: STUDIO_PHONE,
    whatsappNumber: WHATSAPP_NUMBER,
    instagramUrl: STUDIO_INSTAGRAM_URL,
    youtubeUrl: STUDIO_YOUTUBE_URL,
  },
};
```

Then `src/lib/queries/siteSettings.js`:

```js
import { supabase } from '../supabase';
import { publicMediaUrl } from '../mediaUrl';
import { HOME_IMAGES } from '../../data/homeContent';

const SETTINGS_SELECT = `
  quote_text, quote_credit, brand_story_heading, brand_story_p1, brand_story_p2,
  studio_address, studio_email, studio_phone, whatsapp_number, instagram_url, youtube_url,
  hero:hero_media_id (storage_path, alt_text),
  brand_story:brand_story_media_id (storage_path, alt_text),
  closing:closing_media_id (storage_path, alt_text)
`;

// A slot with no media row yet falls back to the shipped static image —
// the site looks identical until the owner changes something.
function slot(media, fallback) {
  if (!media?.storage_path) return { ...fallback };
  return {
    src: publicMediaUrl(media.storage_path),
    alt: media.alt_text || fallback.alt,
  };
}

export async function getSiteSettings() {
  const { data, error } = await supabase
    .from('site_settings')
    .select(SETTINGS_SELECT)
    .eq('id', 1)
    .single();

  if (error) throw new Error(`getSiteSettings: ${error.message}`);

  return {
    quote: { text: data.quote_text, credit: data.quote_credit },
    brandStory: {
      heading: data.brand_story_heading,
      paragraphs: [data.brand_story_p1, data.brand_story_p2],
    },
    images: {
      hero: slot(data.hero, HOME_IMAGES.hero),
      brandStory: slot(data.brand_story, HOME_IMAGES.brandStory),
      closing: slot(data.closing, HOME_IMAGES.closing),
    },
    contact: {
      address: data.studio_address,
      email: data.studio_email,
      phone: data.studio_phone,
      whatsappNumber: data.whatsapp_number,
      instagramUrl: data.instagram_url,
      youtubeUrl: data.youtube_url,
    },
  };
}
```

- [ ] **Step 4: Add the hook** — in `src/hooks/useContent.js`, alongside the four existing wrappers:

```js
import { SITE_SETTINGS_FALLBACK } from '../data/siteSettingsFallback';
import { getSiteSettings } from '../lib/queries/siteSettings';
// ...
export const useSiteSettings = () => useContent(SITE_SETTINGS_FALLBACK, getSiteSettings);
```

- [ ] **Step 5: Run the new test file, then the full suite** — PASS. **Step 6: Commit** — `git commit -m "feat: public site-settings read path with constant fallback"`.

### Task 3: Public pages consume settings as props

**Files:**
- Modify: `src/App.jsx`, `src/pages/HomePage.jsx`, `src/pages/AboutPage.jsx`, `src/components/Layout.jsx`, `src/components/Footer.jsx`, `src/components/BookingForm.jsx`, `src/components/WhatsAppButton.jsx`
- Test: `src/__tests__/App.routes.test.jsx` (extend), existing component tests stay green

**Interfaces:**
- Consumes: `useSiteSettings` (Task 2).
- Produces prop contracts (all with constant defaults so unwired renders — and every existing test — behave as today):
  - `HomePage({ quote = HOME_QUOTE, brandStory = BRAND_STORY, images = HOME_IMAGES, films, photos, onOpenLightbox, onOpenVideo })` — note `quote`/`brandStory` here use the constants' shapes; map: `quote.text`, `quote.credit`, `brandStory.heading`, `brandStory.paragraphs`, `images.hero|brandStory|closing.{src,alt}` (the settings shape matches the constants' shape by construction).
  - `AboutPage({ testimonials, brandStory = BRAND_STORY, portraitImage = HOME_IMAGES.brandStory })`
  - `Layout({ ..., contact })` → `Footer({ contact = SITE_SETTINGS_FALLBACK.contact })` — the default imports from `src/data/siteSettingsFallback` (pure data, layering-safe); Footer switches from importing six constants to one `contact` prop (`contact.address`, `contact.email`, `contact.phone`, `contact.whatsappNumber`, `contact.instagramUrl`, `contact.youtubeUrl`).
  - `BookingForm({ contact = SITE_SETTINGS_FALLBACK.contact })` — same import source; left column reads `contact.*`; passes `number={contact.whatsappNumber}` to both `WhatsAppButton`s. **Submission logic untouched.**
  - `WhatsAppButton({ number = WHATSAPP_NUMBER, message, className })` — guard becomes `if (!number) return null;`, href uses `number`.

- [ ] **Step 1: Failing test** — add to `src/__tests__/App.routes.test.jsx` (its `vi.mock('../hooks/useContent', ...)` factory gains `useSiteSettings`):

```jsx
useSiteSettings: () => ({
  data: {
    quote: { text: 'A settings-driven quote for testing.', credit: 'by tester' },
    brandStory: { heading: 'The Brand Story', paragraphs: ['P one.', 'P two.'] },
    images: {
      hero: { src: '/images/home/hero.jpg', alt: 'hero' },
      brandStory: { src: '/images/home/brand-story.jpg', alt: 'p' },
      closing: { src: '/images/home/closing.jpg', alt: 'c' },
    },
    contact: {
      address: 'Settings Street 1', email: 'settings@example.test', phone: '+91 11111 11111',
      whatsappNumber: '911111111111', instagramUrl: '', youtubeUrl: '',
    },
  },
  loading: false, error: null,
}),
```

New tests: `/` renders 'A settings-driven quote for testing.'; `/gallery`'s footer shows 'Settings Street 1'; `/contact` shows the settings phone.
- [ ] **Step 2: Run** — FAIL (App doesn't call the hook yet). **Step 3: Implement** — `App` calls `useSiteSettings()`, destructures `data: settings`, passes: `quote={settings.quote} brandStory={settings.brandStory} images={settings.images}` to HomePage; `brandStory={settings.brandStory} portraitImage={settings.images.brandStory}` to AboutPage; `contact={settings.contact}` to Layout (→ Footer) and to ContactPage (→ BookingForm). Update the components per the Interfaces block — mechanical prop threading; keep all imports used by defaults.
- [ ] **Step 4: Full suite + lint** — PASS (existing Footer/BookingForm/WhatsAppButton/HomePage tests exercise the defaults; fix any that imported the removed direct reads). **Step 5: Commit** — `git commit -m "feat: public pages read site settings via props with constant fallbacks"`.

### Task 4: Admin queries — settings row + overview counts

**Files:**
- Create: `src/lib/queries/adminSettings.js` + `src/lib/queries/__tests__/adminSettings.test.js`, `src/lib/queries/adminOverview.js` + `src/lib/queries/__tests__/adminOverview.test.js`

**Interfaces:**
- Produces: `getSettingsRow(): Promise<Row>` (camelCase: `quoteText, quoteCredit, brandStoryHeading, brandStoryP1, brandStoryP2, heroMediaId, brandStoryMediaId, closingMediaId, studioAddress, studioEmail, studioPhone, whatsappNumber, instagramUrl, youtubeUrl`); `updateSiteSettings(values): Promise<Row>` (same camelCase keys in, `update ... eq('id', 1) ... select().single()`, throws `site_settings: update failed: <msg>` on error); `getOverviewCounts(): Promise<{ newLeads, weddings: {published, draft}, gallery: {published, draft}, films: {published, draft}, testimonials: {published, draft} }>`.

- [ ] **Step 1: Failing tests.** Mock `../../supabase` per the existing `adminContent.test.js` idiom (read it; copy the builder mock). `adminSettings.test.js`: maps snake→camel on read; sends only known snake_case columns on update (an unknown key on `values` is dropped); update error throws with the table-prefixed message. `adminOverview.test.js`: issues `select('id', { count: 'exact', head: true })` with the right filters (`status.eq.new` for inquiries; `status.eq.published` / `status.eq.draft` per content table) and shapes the result; any error throws.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement both modules.** `adminSettings.js` reuses the column list as a `const COLUMNS = [...]` with local `toCamel`/`valuesToRow` helpers mirroring `adminContent.js`'s (they are module-private there — duplicate the two tiny functions rather than exporting them; note why in a comment). `adminOverview.js`:

```js
import { supabase } from '../supabase';

async function countWhere(table, column, value) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value);
  if (error) throw new Error(`${table}: count failed: ${error.message}`);
  return count ?? 0;
}

async function statusPair(table) {
  const [published, draft] = await Promise.all([
    countWhere(table, 'status', 'published'),
    countWhere(table, 'status', 'draft'),
  ]);
  return { published, draft };
}

export async function getOverviewCounts() {
  const [newLeads, weddings, gallery, films, testimonials] = await Promise.all([
    countWhere('inquiries', 'status', 'new'),
    statusPair('weddings'),
    statusPair('gallery_photos'),
    statusPair('films'),
    statusPair('testimonials'),
  ]);
  return { newLeads, weddings, gallery, films, testimonials };
}
```

- [ ] **Step 4: Run both test files + full suite** — PASS. **Step 5: Commit** — `git commit -m "feat: admin settings and overview count queries"`.

### Task 5: Settings tab

**Files:**
- Create: `src/admin/SettingsForm.jsx`, `src/admin/__tests__/SettingsForm.test.jsx`
- Modify: `src/admin/App.jsx` (add a `SettingsDashboard` composition + tab entry; full tab rework happens in Task 6 — this task only appends the tab)

**Interfaces:**
- Consumes: `getSettingsRow`/`updateSiteSettings` (Task 4); `MediaPicker` (with `selectedId`, `onSelect`), `UploadField`, `listMedia`, `useResource`.
- Produces: `SettingsForm({ initial, media, onSave, pending, error, saved })` — presentational; `SettingsDashboard()` in `App.jsx` owns data (loads row once on mount, owns save state) mirroring the other dashboards.

- [ ] **Step 1: Failing tests** — `SettingsForm.test.jsx` (presentational, no network):

```jsx
// initial = full camelCase row (write a fixture with the real seeded values).
// media = [{ id: 'm-1', storagePath: '/images/home/hero.jpg', altText: 'Hero' }, ...]
// 1. renders every field pre-filled from `initial` (spot-check quoteText,
//    studioEmail, whatsappNumber).
// 2. blocks save and shows an inline error when quoteText is emptied
//    (onSave not called), when studioEmail is 'not-an-email', when
//    whatsappNumber is 'abc', and when instagramUrl is 'ftp://x' — one
//    it.each over [field, badValue, message-pattern].
// 3. valid submit calls onSave with the full camelCase values object.
// 4. `saved` renders a "Saved" confirmation; `error` renders its message.
// 5. the three media slots render a MediaPicker each with the current
//    *_MediaId highlighted (assert one '✓ Selected' per slot fixture).
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement `SettingsForm.jsx`.** Controlled form over one `values` state seeded from `initial`. Two sections under `font-cinzel` headings ("Home Content", "Contact & Social"), field classes copied from `ResourceForm`'s (`LABEL_CLASS` equivalents — duplicate the class strings; do not import another component's internals). Validation on submit, mirroring the spec: required non-empty for the five text-content fields and address/email/phone; email `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`; whatsapp `/^\d*$/`; each social URL empty or `/^https?:\/\//i`. Errors render inline per field (`role="alert"`, `aria-invalid`, `aria-describedby` — same wiring BookingForm uses). Three image slots: each a `<fieldset>` with `UploadField` (on upload: `onSelectMedia(slotKey, media.id)` via the same `values` update + a `reloadMedia` callback prop — expose `onUploaded` passthrough) and `MediaPicker` (`items={media}`, `onSelect={(m) => set(slotKey, m.id)}`, `selectedId={values[slotKey]}`). Submit → `onSave(values)`.
  `SettingsDashboard` in `App.jsx`: `useResource(useMemo(() => ({ list: listMedia }), []))` for media + local state `{ row, loadError, pending, saveError, saved }`; `useEffect` on mount: `getSettingsRow()`. Save handler: `setPending`, `await updateSiteSettings(values)`, set `row` to result, `saved: true` (cleared on next edit via `onDirty` callback or simply left until next save — keep simple: `saved` resets at the start of each save). Render `SettingsForm` once the row has loaded; load error shows a retry button that refetches.
- [ ] **Step 4: Append the tab** — add `{ key: 'settings', label: 'Settings' }` to `DASHBOARD_TABS` and `{tab === 'settings' && <SettingsDashboard />}`.
- [ ] **Step 5: Run new tests + full suite + lint** — PASS. **Step 6: Commit** — `git commit -m "feat: admin Settings tab edits site content, contact, and Home images"`.

### Task 6: Dashboard landing tab + View-website link

**Files:**
- Create: `src/admin/DashboardOverview.jsx`, `src/admin/__tests__/DashboardOverview.test.jsx`
- Modify: `src/admin/App.jsx` (tab order + default + header link), `src/admin/__tests__/App.test.jsx`

**Interfaces:**
- Consumes: `getOverviewCounts` (Task 4).
- Produces: `DashboardOverview({ onNavigate })` — fetches counts itself on mount (one `useEffect`, no polling); calls `onNavigate(tabKey)` when a count card is clicked.

- [ ] **Step 1: Failing tests** — `DashboardOverview.test.jsx` (mock `../../lib/queries/adminOverview`):

```jsx
// 1. renders each count card once the mocked promise resolves (leads,
//    weddings, gallery, films, testimonials with published/draft numbers).
// 2. "New lead waiting" callout renders when newLeads > 0 and NOT when 0.
// 3. clicking the Leads card calls onNavigate('leads'); the Gallery card,
//    onNavigate('gallery').
// 4. a rejected fetch renders an error line with a Retry button that
//    refetches (mock called twice).
```

And in `App.test.jsx`: update the existing "still shows the leads dashboard first" test — the landing tab is now Dashboard (assert the overview heading renders and `listInquiries` was NOT called on mount); add: clicking the Leads tab shows Booking Inquiries; the header contains a link named "View website" with `href="/"` and `target="_blank"`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** `DashboardOverview`: local `{ counts, error, loading }`, `load()` on mount; cards as buttons (grid, existing admin card classes: `border border-pitch-900/10 rounded-2xl bg-offwhite-50 p-6`); callout `role="status"` amber-styled using the admin's existing `gold-500` accent. `App.jsx`: `DASHBOARD_TABS` becomes `dashboard, leads, media, weddings, gallery, films, testimonials, settings` with `useState('dashboard')`; render `{tab === 'dashboard' && <DashboardOverview onNavigate={setTab} />}`; header gains `<a href="/" target="_blank" rel="noopener noreferrer" ...>View website</a>` styled like the Sign Out button, placed before it.
- [ ] **Step 4: Run suite** — PASS. **Step 5: Commit** — `git commit -m "feat: admin dashboard landing with counts, lead callout, view-website link"`.

### Task 7: Add-to-Gallery flow, draft badges, post-create banner

**Files:**
- Create: `src/admin/CreatedDraftBanner.jsx`, `src/admin/__tests__/CreatedDraftBanner.test.jsx`
- Modify: `src/admin/MediaPicker.jsx` (+ its test), `src/admin/ResourceList.jsx` (+ its test), `src/admin/App.jsx` (+ its test)

**Interfaces:**
- Consumes: `makeResourceQueries.create()` already returns the created item (verified — `src/lib/queries/adminContent.js` line 91); `useResource.mutate(name, ...args)` — **read `src/hooks/useResource.js` first**: if `mutate` does not resolve with the query's return value, extend it to `return result` (and update its own test to assert the pass-through) — that return is what the banner needs.
- Produces: `MediaPicker({ ..., onAddToGallery })` — optional; renders an "Add to Gallery" button per card only when provided. `CreatedDraftBanner({ label, onPublish, onDismiss, publishing })`. `AdminDashboard` holds `galleryPrefill` (a media id or null); `GalleryDashboard({ prefillMediaId, onPrefillConsumed })`.

- [ ] **Step 1: Failing tests.**
  - `MediaPicker.test.jsx` additions (use the existing `renderPicker` dynamic-import helper): with `onAddToGallery` provided, each card shows an "Add to Gallery" button and clicking it calls the handler with the full media row; without the prop, no such button (assert on the existing no-onSelect fixture).
  - `CreatedDraftBanner.test.jsx`: renders `Saved as draft — publish when ready` plus the `label`; Publish button calls `onPublish` (disabled + "Publishing…" while `publishing`); Dismiss calls `onDismiss`.
  - `ResourceList.test.jsx` addition: a published row shows a `PUBLISHED` badge, a draft row an amber `DRAFT` badge (assert on text + `aria-label="status: draft"`).
  - `App.test.jsx` addition: in the Media Library tab, clicking a card's "Add to Gallery" switches to the Gallery tab with the Add Gallery Photo form open and that media preselected (assert the form heading and one '✓ Selected').
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.**
  - `MediaPicker`: next to (or instead of) nothing in library mode, render `{onAddToGallery && <button ...>Add to Gallery</button>}` per card, same button classes as Select.
  - `CreatedDraftBanner`:

```jsx
export default function CreatedDraftBanner({ label, onPublish, onDismiss, publishing }) {
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border-2 border-gold-500 bg-offwhite-50 px-4 py-3">
      <p className="text-xs font-semibold text-pitch-900">
        Saved as draft — publish when ready{label ? `: ${label}` : ''}
      </p>
      <button type="button" onClick={onPublish} disabled={publishing}
        className="px-4 py-1.5 rounded-lg bg-pitch-900 text-offwhite-50 text-[10px] uppercase tracking-widest font-semibold disabled:opacity-60">
        {publishing ? 'Publishing…' : 'Publish now'}
      </button>
      <button type="button" onClick={onDismiss}
        className="px-3 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold">
        Keep as draft
      </button>
    </div>
  );
}
```

  - `ResourceList` status cell: replace the plain status text with `<span aria-label={'status: ' + item.status} className={...}>` — `DRAFT`: `border-2 border-gold-500 text-pitch-900 bg-offwhite-50`; `PUBLISHED`: `bg-pitch-900 text-offwhite-50`; both `px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-bold`.
  - Each of the four content dashboards in `App.jsx`: `const [justCreated, setJustCreated] = useState(null)`; in `handleSubmit`'s create path capture `const created = await mutate('create', payload); setJustCreated(created);` (cleared on edit/create open); in list view render `{justCreated && <CreatedDraftBanner label={justCreated.title ?? justCreated.couple ?? ''} publishing={bannerPending} onPublish={async () => { setBannerPending(true); try { await runListAction('update', justCreated.id, { status: 'published' }); setJustCreated(null); } finally { setBannerPending(false); } }} onDismiss={() => setJustCreated(null)} />}`. (Yes, four times — this file deliberately repeats dashboard shapes rather than abstracting; match it.)
  - Prefill: `AdminDashboard` gets `const [galleryPrefill, setGalleryPrefill] = useState(null)`; `MediaLibraryDashboard` gains prop `onAddToGallery={(media) => { setGalleryPrefill(media.id); setTab('gallery'); }}` (threaded to `MediaPicker`); `GalleryDashboard` gains `prefillMediaId`/`onPrefillConsumed` and a `useEffect`: when `prefillMediaId` set → `setView({ mode: 'form', item: { mediaId: prefillMediaId } }); onPrefillConsumed();`. Note: passing `item` with only `mediaId` means the form opens in create mode pre-selected — `handleSubmit` must branch on `view.item?.id` (already does) so this still creates.
- [ ] **Step 4: Full suite + lint** — PASS. **Step 5: Commit** — `git commit -m "feat: add-to-gallery flow, loud draft badges, post-create publish banner"`.

### Task 8: Loader registers Home images as settings media

**Files:**
- Modify: `scripts/load-real-content.mjs`

**Interfaces:**
- Consumes: table + columns from Task 1.
- Produces: after a run, `site_settings.hero_media_id/brand_story_media_id/closing_media_id` point at media rows whose `storage_path`s are the three static home paths.

- [ ] **Step 1: Extend the script** — after the existing story step, add:

```js
// 5. Point the settings' Home image slots at media rows for the three
//    shipped static images, so the admin Settings form shows real current
//    selections. Idempotent: reuses an existing media row per path.
async function mediaIdForPath(path, alt) {
  const { data } = await db.from('media').select('id').eq('storage_path', path).limit(1);
  if (data && data.length > 0) return data[0].id;
  return insertMedia(path, alt);
}
const heroId = await mediaIdForPath('/images/home/hero.jpg', 'A couple embracing beneath the arches of a Lucknow monument at golden hour');
const brandId = await mediaIdForPath('/images/home/brand-story.jpg', 'A bride in an embellished navy lehenga, framed by dark leaves');
const closingId = await mediaIdForPath('/images/home/closing.jpg', "A couple's hands holding their two gold wedding rings");
const { error: settingsErr } = await db
  .from('site_settings')
  .update({ hero_media_id: heroId, brand_story_media_id: brandId, closing_media_id: closingId })
  .eq('id', 1);
if (settingsErr) throw new Error(`site_settings update failed: ${settingsErr.message}`);
n.settings = 1;
```

(Also note in the header comment that the deletion pass must NOT delete media referenced by `site_settings` — extend the old-media collection step to exclude the three ids currently on the settings row: fetch them first and skip them when deleting.)
- [ ] **Step 2: Run it** (env per Global Constraints): `node scripts/load-real-content.mjs` — expect the summary to include `"settings":1`. **Step 3: Verify through the public path** — vite-node one-off asserting `getSiteSettings()` images resolve to the three `/images/home/...` paths and `contact.phone === '+91 8881621021'`. **Step 4: Commit** — `git commit -m "feat: loader points site_settings image slots at the shipped Home images"`.

### Task 9: `verify:admin` settings leg

**Files:**
- Modify: `scripts/verify-admin.mjs`

**Interfaces:**
- Consumes: the script's existing structure — read it first; reuse its existing `check(...)` reporter, its authenticated admin client, and its anon client exactly as the wedding leg does.

- [ ] **Step 1: Add the leg** after the existing public read-back section, before cleanup:

```js
console.log('\nsite settings round-trip (admin edit -> public read)');
const PROBE_QUOTE = 'verify-admin settings probe quote';
const { data: before } = await adminClient.from('site_settings').select('quote_text').eq('id', 1).single();
const { error: setErr } = await adminClient.from('site_settings').update({ quote_text: PROBE_QUOTE }).eq('id', 1);
check('admin can update site_settings', !setErr, setErr?.message);
const { data: publicRow, error: readErr } = await anonClient.from('site_settings').select('quote_text').eq('id', 1).single();
check('public read sees the update', !readErr && publicRow?.quote_text === PROBE_QUOTE, readErr?.message ?? publicRow?.quote_text);
const { error: restoreErr } = await adminClient.from('site_settings').update({ quote_text: before.quote_text }).eq('id', 1);
check('original quote restored', !restoreErr, restoreErr?.message);
```

Match the actual client variable names used in the script (read it; they may be `admin`/`anon` or similar). If the script's cleanup runs in a `finally`/crash handler, add the restore there too, guarded on `before` being set.
- [ ] **Step 2: Run** — `npm run verify:admin` with the full env (Global Constraints) — all checks `ok`, including the three new ones. **Step 3: Commit** — `git commit -m "test: verify:admin proves a settings edit reaches the public site"`.

### Task 10: Documentation

**Files:**
- Modify: `docs/DATA-MODEL.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/COMPONENTS.md`, `src/data/homeContent.js`, `src/data/contact.js`

- [ ] **Step 1:** `DATA-MODEL.md` — add a `site_settings` section beside the other tables: the column list, the one-row `check (id = 1)` device, the two policies (world select, admin update, no insert/delete), the seeded values' provenance (owner-confirmed 2026-08-03/04), and that `load-real-content.mjs` wires the media ids.
- [ ] **Step 2:** `ARCHITECTURE.md` — in the data-flow section: `useSiteSettings` as the fifth wrapper, settings flowing App → props; in the admin section: the eight tabs (Dashboard default, Settings), the Add-to-Gallery flow, draft-first creates with the banner, View-website link.
- [ ] **Step 3:** `ROADMAP.md` — Phase 3c row after 3b: `**v0.4c** | 3c — Admin CMS completion | site_settings table; Settings + Dashboard tabs; add-to-gallery; draft-state clarity | Every visitor-visible word and image is editable from the admin with no code change | local`; update "Current position".
- [ ] **Step 4:** `COMPONENTS.md` — update the rows for `Footer`, `BookingForm`, `WhatsAppButton`, `Layout` (new props + defaults) and the Pages table (HomePage/AboutPage/ContactPage props).
- [ ] **Step 5:** Re-comment `src/data/homeContent.js` and `src/data/contact.js` headers: they are now the **fallback** the site renders when the database is unreachable (and the prop defaults in components); editing content for a live site happens in the admin's Settings tab.
- [ ] **Step 6: Gates** — `npm run check:docs && npm test && npm run lint` — green. **Step 7: Commit** — `git commit -m "docs: record Phase 3c — admin CMS completion"`.

### Task 11: Whole-branch verification (controller may run inline)

- [ ] `npm test` (full), `npm run lint` (≤2 warnings), `npm run check:docs`.
- [ ] `npm run build` then `git checkout -- dist/ && git clean -fx dist/`.
- [ ] With the stack running: `npm run verify:inquiry` and `npm run verify:admin` — both fully green.
- [ ] Manual smoke (controller): admin loads at `/admin.html` → Dashboard counts render → Settings shows seeded values with three highlighted image slots → edit the quote, Save, confirm it on `/` → restore it via Settings.
- [ ] Hand to superpowers:finishing-a-development-branch (merge is the owner's call; tag `v0.4c` after merge).
