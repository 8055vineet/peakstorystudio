# Admin Extensibility (Phase 3e, `v0.4e`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-created "More" pages (photo/video collections), admin-managed gallery categories, and admin-managed booking services — everything the owner will keep adding, without code changes.

**Architecture:** Three new tables + one rename RPC behind the existing RLS pattern; three new public reads behind `useContent` fallbacks; a More dropdown + `/more/:slug` route on the public site; in the admin, a Pages tab (ResourceList/Form + a WeddingPhotos-style items manager) and one shared `ManagedList` component used for both categories and services. The services allowlist in the shared validator becomes shape rules.

**Tech Stack:** Postgres/Supabase (migrations + RLS + one plpgsql RPC), React 18 + react-router-dom 6, Vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-08-07-admin-extensibility-design.md` — authority when this plan is ambiguous.

## Global Constraints

- Plain JavaScript, `.jsx` for components. No TypeScript.
- Tailwind inline with existing palette tokens only; `gold-*`/`font-cinzel` admin-only.
- Components never import the Supabase client; components → hooks → `src/lib/queries/*`.
- Schema changes ONLY in `supabase/migrations/`; apply with `npx supabase migration up` — **NEVER `npm run db:reset`** (the local DB holds real inquiries and real content).
- `useContent` fallbacks must be module-level constants (its effect deps include `staticData` — a fresh `[]` per render would refetch forever).
- Content sections tolerate empty lists. The More menu with zero pages renders nothing.
- Stored inquiries are historical records — service renames/removals never rewrite them.
- ESLint `--max-warnings=2` (the two tracked `useScrollReveal` warnings); react-hooks purity rules enforced (no sync `setState` in effects — use the mount-fresh or reloadKey patterns).
- Run `npm run lint` and `npm test` as standalone commands before every commit. Two pre-existing typing-timing tests (UploadField alt-text, BookingForm WhatsApp prefill) can flake under parallel load — rerun that file alone before assuming breakage.
- Conventional Commits; stay on `phase-3e/admin-extensibility`.
- Copy, verbatim: nav item **More**; admin tab **Pages**; buttons **Add photographs** / **Add video** / **Done**; category manager heading **Manage categories**; services heading **Booking services**; delete-refusal copy `Cannot delete "<name>" — <n> photograph(s) still use it.`
- Seeds, verbatim: categories `Pre-Wedding, Wedding, Engagement, Haldi & Mehendi`; services `Cinematic Film, Fine Art Photography, Drone Aerials, Pre-Wedding Shoot`.
- Validator shape rules: services array ≤ 12 entries, each cleaned, non-empty, ≤ 80 chars; duplicates dropped; submitted order kept.

---

### Task 1: Migration — tables, RLS, rename RPC, seeds

**Files:**
- Create: `supabase/migrations/20260807100000_admin_extensibility.sql`

**Interfaces:**
- Produces: tables `collections`, `collection_items`, `gallery_categories`, `booking_services`; RPC `rename_gallery_category(p_old text, p_new text)`. Every later task's queries assume these exact column names.

- [ ] **Step 1: Write the migration**

Read `supabase/migrations/20260730204126_row_level_security.sql` first and mirror its comment style. Content:

```sql
-- Phase 3e: admin-extensible content — More pages, gallery categories,
-- booking services. See docs/superpowers/specs/2026-08-07-admin-extensibility-design.md.

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  media_id uuid references public.media(id),
  video_embed_url text,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  -- An item is a photograph, or a video (optionally postered) — never neither.
  check (media_id is not null or video_embed_url is not null)
);

create index collection_items_collection_idx
  on public.collection_items (collection_id, sort_order);

create table public.gallery_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  sort_order int not null default 0
);

create table public.booking_services (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  sort_order int not null default 0
);

-- Same grant-broadly-let-RLS-decide pattern as 20260730204126.
grant select, insert, update, delete on
  public.collections,
  public.collection_items,
  public.gallery_categories,
  public.booking_services
to anon, authenticated, service_role;

alter table public.collections        enable row level security;
alter table public.collection_items   enable row level security;
alter table public.gallery_categories enable row level security;
alter table public.booking_services   enable row level security;

create policy collections_read_published on public.collections
  for select using (status = 'published' or public.is_admin());

create policy collections_admin_all on public.collections
  for all using (public.is_admin()) with check (public.is_admin());

create policy collection_items_read_published on public.collection_items
  for select using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
        and (c.status = 'published' or public.is_admin())
    )
  );

create policy collection_items_admin_all on public.collection_items
  for all using (public.is_admin()) with check (public.is_admin());

-- The public site renders category order and the services list, so both read openly.
create policy gallery_categories_read_all on public.gallery_categories
  for select using (true);

create policy gallery_categories_admin_all on public.gallery_categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy booking_services_read_all on public.booking_services
  for select using (true);

create policy booking_services_admin_all on public.booking_services
  for all using (public.is_admin()) with check (public.is_admin());

-- Rename atomically: the category row and every photo that names it, in one
-- transaction, so a rename can never strand photos on a dead name.
create or replace function public.rename_gallery_category(p_old text, p_new text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'rename_gallery_category: admin only';
  end if;
  update public.gallery_categories set name = p_new where name = p_old;
  if not found then
    raise exception 'rename_gallery_category: no category named "%"', p_old;
  end if;
  update public.gallery_photos set category = p_new where category = p_old;
end;
$$;

revoke execute on function public.rename_gallery_category(text, text) from public, anon;
grant execute on function public.rename_gallery_category(text, text) to authenticated, service_role;

-- Seeds: exactly what is hard-coded today, in today's order.
insert into public.gallery_categories (name, sort_order) values
  ('Pre-Wedding', 0), ('Wedding', 1), ('Engagement', 2), ('Haldi & Mehendi', 3);

insert into public.booking_services (name, sort_order) values
  ('Cinematic Film', 0), ('Fine Art Photography', 1), ('Drone Aerials', 2), ('Pre-Wedding Shoot', 3);
```

- [ ] **Step 2: Apply incrementally**

Run: `npx supabase migration up`
Expected: applies only this migration; no reset.

- [ ] **Step 3: Probe RLS from the outside**

```bash
eval "$(npx supabase status -o env | sed 's/^/export /')" >/dev/null 2>&1 || true
# anon reads categories (4 rows expected):
curl -s "$API_URL/rest/v1/gallery_categories?select=name&order=sort_order" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# anon reads collections (empty [] — none published):
curl -s "$API_URL/rest/v1/collections?select=slug" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# anon write refused (expect 401/403 body, not a created row):
curl -s -X POST "$API_URL/rest/v1/booking_services" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '{"name":"hack"}'
```

Expected: 4 category names in order; `[]`; an RLS violation (`42501`) on the write.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260807100000_admin_extensibility.sql
git commit -m "feat(db): collections, gallery_categories, booking_services + rename RPC"
```

---

### Task 2: Validator — services shape rules

**Files:**
- Modify: `supabase/functions/_shared/inquiry-validation.js` (the services block, ~lines 137–150)
- Test: `supabase/functions/_shared/__tests__/inquiry-validation.test.js`

**Interfaces:**
- Produces: `validateInquiry` accepts ANY array of ≤ 12 clean strings (each ≤ 80 chars) as services; `SERVICES` stays exported (fallback list). BookingForm (Task 4) keeps importing both.

- [ ] **Step 1: Update the tests**

In the test file: the test asserting `services: ['Skywriting']` is rejected (~line 86) now expects ACCEPTANCE — replace it and add the shape-rule tests:

```js
  it('accepts services beyond the built-in list — the list is admin-managed now', () => {
    const result = validateInquiry(valid({ services: ['Skywriting'] }), { today: TODAY });
    expect(result.fields.services).toBeUndefined();
    expect(result.value.services).toEqual(['Skywriting']);
  });

  it('keeps submitted order and drops duplicates', () => {
    const result = validateInquiry(valid({ services: ['Drone Aerials', 'Cinematic Film', 'Drone Aerials'] }), { today: TODAY });
    expect(result.value.services).toEqual(['Drone Aerials', 'Cinematic Film']);
  });

  it('rejects more than 12 services', () => {
    const many = Array.from({ length: 13 }, (_, i) => `Service ${i}`);
    const result = validateInquiry(valid({ services: many }), { today: TODAY });
    expect(result.fields.services).toBeTruthy();
  });

  it('rejects a service over 80 characters or empty after cleaning', () => {
    expect(validateInquiry(valid({ services: ['x'.repeat(81)] }), { today: TODAY }).fields.services).toBeTruthy();
    expect(validateInquiry(valid({ services: ['   '] }), { today: TODAY }).fields.services).toBeTruthy();
  });
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run supabase/functions/_shared/__tests__/inquiry-validation.test.js`
Expected: the four new/changed tests FAIL against the allowlist.

- [ ] **Step 3: Implement**

Replace the services block in `validateInquiry` (keep the `SERVICES` export and everything else untouched). Add next to `FIELD_LIMITS`:

```js
// The bookable services are admin-managed (booking_services table) as of
// Phase 3e, so this validator can no longer enforce a fixed allowlist —
// SERVICES above remains only as the outage fallback the form renders.
// What it enforces instead is shape: a bounded number of short, clean
// strings. Anything a spammer could put here they could already put in
// `message`.
export const MAX_SERVICES = 12;
export const SERVICE_MAX_LENGTH = 80;
```

and the block becomes:

```js
  let services = [];
  if (source.services === undefined || source.services === null) {
    services = [];
  } else if (!Array.isArray(source.services) || source.services.length > MAX_SERVICES) {
    fields.services = 'Please choose from the services offered.';
  } else {
    const cleaned = source.services.map(text);
    if (cleaned.some((service) => !service || service.length > SERVICE_MAX_LENGTH)) {
      fields.services = 'Please choose from the services offered.';
    } else {
      const seen = new Set();
      services = cleaned.filter((service) => {
        if (seen.has(service)) return false;
        seen.add(service);
        return true;
      });
    }
  }
```

- [ ] **Step 4: Run tests + lint, commit**

Run: `npx vitest run supabase/functions/_shared/__tests__/inquiry-validation.test.js` then `npm run lint`.

```bash
git add supabase/functions/_shared/inquiry-validation.js supabase/functions/_shared/__tests__/inquiry-validation.test.js
git commit -m "feat(inquiries): services validate by shape, not allowlist — the list is admin-managed"
```

---

### Task 3: Public read path — queries, hooks, fallback constant

**Files:**
- Create: `src/lib/queries/collections.js`, `src/lib/queries/bookingServices.js`, `src/data/galleryCategories.js`
- Modify: `src/lib/queries/gallery.js` (add `getGalleryCategories`), `src/hooks/useContent.js`
- Test: `src/lib/queries/__tests__/collections.test.js`, `src/lib/queries/__tests__/bookingServices.test.js`, add a describe to `src/lib/queries/__tests__/gallery.test.js`

**Interfaces:**
- Produces:
  - `getCollections()` → `[{ id, slug, title, description, items: [{ id, url, videoEmbedUrl, caption }] }]` (published only, both levels ordered; `url` from `publicMediaUrl`, `''` when no media).
  - `getGalleryCategories()` → `['Pre-Wedding', ...]` ordered names.
  - `getBookingServices()` → ordered names.
  - Hooks: `useCollections()` (fallback `NO_COLLECTIONS = []` module constant), `useGalleryCategories()` (fallback `GALLERY_CATEGORY_FALLBACK`), `useBookingServices()` (fallback the shared `SERVICES`). Each returns `{ data, loading, error }` like every `useContent` wrapper.
  - `src/data/galleryCategories.js` exports `GALLERY_CATEGORY_FALLBACK = ['Pre-Wedding', 'Wedding', 'Engagement', 'Haldi & Mehendi']` (pure data — no imports).

- [ ] **Step 1: Write failing query tests**

Follow the mock pattern of `src/lib/queries/__tests__/adminSettings.test.js` (mock `../../supabase`, chain stubs). `collections.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

beforeEach(() => { vi.resetModules(); mockFrom.mockReset(); });

const ROWS = [{
  id: 'c-1',
  slug: 'travels',
  title: 'Travels',
  description: 'On the road.',
  items: [
    { id: 'i-1', video_embed_url: null, caption: null, media: { storage_path: '/images/x/1.jpg' } },
    { id: 'i-2', video_embed_url: 'https://www.youtube.com/embed/abc', caption: 'Teaser', media: null },
  ],
}];

function chain(rows, error = null) {
  const c = {};
  c.select = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  // getCollections orders twice: collections, then the embedded items.
  c.order = vi.fn(() => c);
  c.then = (resolve, reject) => Promise.resolve({ data: rows, error }).then(resolve, reject);
  return c;
}

describe('getCollections', () => {
  it('maps published collections with photo and video items', async () => {
    const c = chain(ROWS);
    mockFrom.mockReturnValue(c);
    const { getCollections } = await import('../collections.js');
    const result = await getCollections();
    expect(mockFrom).toHaveBeenCalledWith('collections');
    expect(c.eq).toHaveBeenCalledWith('status', 'published');
    expect(result[0].slug).toBe('travels');
    expect(result[0].items[0]).toEqual({ id: 'i-1', url: '/images/x/1.jpg', videoEmbedUrl: null, caption: null });
    expect(result[0].items[1].videoEmbedUrl).toBe('https://www.youtube.com/embed/abc');
    expect(result[0].items[1].url).toBe('');
  });

  it('throws a prefixed error on failure', async () => {
    mockFrom.mockReturnValue(chain(null, { message: 'nope' }));
    const { getCollections } = await import('../collections.js');
    await expect(getCollections()).rejects.toThrow('getCollections: nope');
  });
});
```

`bookingServices.test.js` mirrors it: `from('booking_services')`, `.select('name')`, `.order('sort_order')`, maps to `['A', 'B']`, prefixed error `getBookingServices:`. The `gallery.test.js` addition asserts `getGalleryCategories` selects `name` from `gallery_categories` ordered by `sort_order` and returns names.

- [ ] **Step 2: Run to verify failures** — `npx vitest run src/lib/queries/__tests__/collections.test.js src/lib/queries/__tests__/bookingServices.test.js src/lib/queries/__tests__/gallery.test.js`

- [ ] **Step 3: Implement**

`src/lib/queries/collections.js`:

```js
import { supabase } from '../supabase';
import { publicMediaUrl } from '../mediaUrl';

// The admin-created "More" pages, published only, both levels ordered.
// PostgREST cascades the delete (collection_items references on delete
// cascade), so an item can never outlive its page.
export async function getCollections() {
  const { data, error } = await supabase
    .from('collections')
    .select('id, slug, title, description, items:collection_items (id, video_embed_url, caption, media:media_id (storage_path))')
    .eq('status', 'published')
    .order('sort_order')
    .order('sort_order', { foreignTable: 'collection_items' });

  if (error) throw new Error(`getCollections: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    items: (row.items ?? []).map((item) => ({
      id: item.id,
      url: publicMediaUrl(item.media?.storage_path),
      videoEmbedUrl: item.video_embed_url,
      caption: item.caption,
    })),
  }));
}
```

`src/lib/queries/bookingServices.js`:

```js
import { supabase } from '../supabase';

export async function getBookingServices() {
  const { data, error } = await supabase
    .from('booking_services')
    .select('name')
    .order('sort_order');
  if (error) throw new Error(`getBookingServices: ${error.message}`);
  return (data ?? []).map((row) => row.name);
}
```

In `gallery.js` append:

```js
// The admin-managed section order for PhotoGallery — names only; the photos
// themselves keep carrying their category as text.
export async function getGalleryCategories() {
  const { data, error } = await supabase
    .from('gallery_categories')
    .select('name')
    .order('sort_order');
  if (error) throw new Error(`getGalleryCategories: ${error.message}`);
  return (data ?? []).map((row) => row.name);
}
```

`src/data/galleryCategories.js`:

```js
// FALLBACK ONLY since Phase 3e — the live list is the gallery_categories
// table, managed in the admin's Gallery tab. This is what PhotoGallery
// orders by when the database is unreachable. Keep in step with the
// migration seed.
export const GALLERY_CATEGORY_FALLBACK = ['Pre-Wedding', 'Wedding', 'Engagement', 'Haldi & Mehendi'];
```

In `useContent.js` add imports (`getCollections`, `getGalleryCategories`, `getBookingServices`, `GALLERY_CATEGORY_FALLBACK`, and `SERVICES` from `'@shared/inquiry-validation.js'`) and:

```js
// Phase 3e: the admin-extensible lists. Fallbacks are module-level
// constants on purpose — useContent's effect re-runs when `staticData`
// changes identity, so a fresh [] per call would refetch forever.
const NO_COLLECTIONS = [];

export const useCollections = () => useContent(NO_COLLECTIONS, getCollections);
export const useGalleryCategories = () => useContent(GALLERY_CATEGORY_FALLBACK, getGalleryCategories);
export const useBookingServices = () => useContent(SERVICES, getBookingServices);
```

- [ ] **Step 4: Run the three test files + lint** — all pass, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/collections.js src/lib/queries/bookingServices.js src/lib/queries/gallery.js src/data/galleryCategories.js src/hooks/useContent.js src/lib/queries/__tests__/collections.test.js src/lib/queries/__tests__/bookingServices.test.js src/lib/queries/__tests__/gallery.test.js
git commit -m "feat: public read path for collections, categories, services with fallbacks"
```

---

### Task 4: PhotoGallery order prop + BookingForm services prop + threading

**Files:**
- Modify: `src/components/PhotoGallery.jsx`, `src/components/BookingForm.jsx`, `src/pages/GalleryPage.jsx`, `src/pages/ContactPage.jsx`, `src/App.jsx`
- Test: `src/components/__tests__/PhotoGallery.test.jsx`, `src/components/__tests__/BookingForm.test.jsx`

**Interfaces:**
- Consumes: `useGalleryCategories`, `useBookingServices` (Task 3).
- Produces: `PhotoGallery({ photos, onOpenLightbox, categoryOrder = GALLERY_CATEGORY_FALLBACK })`; `BookingForm({ contact = ..., services = SERVICES })`; `GalleryPage` and `ContactPage` accept and thread `categoryOrder`/`services`.

- [ ] **Step 1: Add failing tests**

`PhotoGallery.test.jsx` — append:

```js
  it('orders sections by the categoryOrder prop, unknown names appended', () => {
    const photos = [
      { id: '1', url: '/images/a.jpg', category: 'Wedding', title: 'w' },
      { id: '2', url: '/images/b.jpg', category: 'Travel Diaries', title: 't' },
      { id: '3', url: '/images/c.jpg', category: 'Pre-Wedding', title: 'p' },
    ];
    render(<PhotoGallery photos={photos} onOpenLightbox={vi.fn()} categoryOrder={['Wedding', 'Pre-Wedding']} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Wedding', 'Pre-Wedding', 'Travel Diaries']);
  });
```

`BookingForm.test.jsx` — append (match the file's existing render helper/mocks):

```js
  it('renders service buttons from the services prop', () => {
    renderForm({ services: ['Cinematic Film', 'Skywriting'] });
    expect(screen.getByRole('button', { name: /skywriting/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /drone aerials/i })).toBeNull();
  });
```

(Read the file's top first: if its render helper is named differently, use that name; the assertion stays.)

- [ ] **Step 2: Run to verify failures** — the two new tests fail.

- [ ] **Step 3: Implement**

`PhotoGallery.jsx`: import `GALLERY_CATEGORY_FALLBACK` from `'../data/galleryCategories'`, delete the local `SECTION_ORDER`, and:

```jsx
export default function PhotoGallery({ photos, onOpenLightbox, categoryOrder = GALLERY_CATEGORY_FALLBACK }) {
  const categories = [...new Set(photos.map((p) => p.category))].sort((a, b) => {
    const ia = categoryOrder.indexOf(a);
    const ib = categoryOrder.indexOf(b);
    return (ia === -1 ? categoryOrder.length : ia) - (ib === -1 ? categoryOrder.length : ib);
  });
```

(Comment above the component: order comes from the admin-managed list; unknown names still append.)

`BookingForm.jsx`: signature gains `services = SERVICES` (the import already exists); `{SERVICES.map(...)}` becomes `{services.map(...)}`.

`GalleryPage.jsx`: accept `categoryOrder` and pass to `PhotoGallery`. `ContactPage.jsx`: accept `services` and pass to `BookingForm`. `src/App.jsx`: add `const { data: galleryCategories } = useGalleryCategories();` and `const { data: bookingServices } = useBookingServices();` to the hook block, extend the `useContent` import, and thread `categoryOrder={galleryCategories}` / `services={bookingServices}` at the two routes.

- [ ] **Step 4: Run the two component test files + `src/__tests__/App.routes.test.jsx` + lint** — App.routes tests need the two new hooks in their `useContent` mock; add `useGalleryCategories: () => ({ data: ['Pre-Wedding', 'Wedding', 'Engagement', 'Haldi & Mehendi'], loading: false, error: null })` and the same shape for `useBookingServices` (data: the four services) to that file's existing mock of `./hooks/useContent` (read its mock block and match it).

- [ ] **Step 5: Commit**

```bash
git add src/components/PhotoGallery.jsx src/components/BookingForm.jsx src/pages/GalleryPage.jsx src/pages/ContactPage.jsx src/App.jsx src/components/__tests__/PhotoGallery.test.jsx src/components/__tests__/BookingForm.test.jsx src/__tests__/App.routes.test.jsx
git commit -m "feat: gallery section order and booking services come from the database"
```

---

### Task 5: Navbar — the More dropdown

**Files:**
- Modify: `src/components/Navbar.jsx`, `src/components/Layout.jsx`
- Test: `src/components/__tests__/Navbar.test.jsx`

**Interfaces:**
- Consumes: nothing new (pages arrive as a prop).
- Produces: `Navbar({ ..., morePages = [] })` where `morePages` is `[{ title, slug }]`; `Layout` gains and forwards the same prop. Task 6 wires App.

- [ ] **Step 1: Add failing tests**

Append to `Navbar.test.jsx` (match its existing render helper — it must render inside a router; reuse the file's pattern):

```js
describe('More dropdown', () => {
  const PAGES = [{ title: 'Travels', slug: 'travels' }, { title: 'Behind the Scenes', slug: 'behind-the-scenes' }];

  it('renders no More item at all when there are no pages', () => {
    renderNavbar();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it('opens a menu of page links and closes on Escape', async () => {
    const user = userEvent.setup();
    renderNavbar({ morePages: PAGES });
    const trigger = screen.getByRole('button', { name: 'More' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Travels' })).toHaveAttribute('href', '/more/travels');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('link', { name: 'Travels' })).toBeNull();
  });

  it('lists the pages as a labelled group in the mobile drawer', async () => {
    const user = userEvent.setup();
    renderNavbar({ morePages: PAGES });
    await user.click(screen.getByRole('button', { name: /toggle navigation menu/i }));
    expect(screen.getByText('More')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Behind the Scenes' })).toHaveAttribute('href', '/more/behind-the-scenes');
  });
});
```

- [ ] **Step 2: Run to verify failures.**

- [ ] **Step 3: Implement in `Navbar.jsx`**

Add to the signature: `morePages = []`. Add imports: `useLocation` from react-router-dom, `ChevronDown` from lucide-react, `useEffect, useRef` from react. Inside the component:

```jsx
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const onMorePage = location.pathname.startsWith('/more/');

  // Close on Escape and on any click outside the dropdown. Listeners exist
  // only while the menu is open, and this effect only ever tears down its
  // own listeners — no state is written here except via user events.
  useEffect(() => {
    if (!moreOpen) return undefined;
    function onKeyDown(e) { if (e.key === 'Escape') setMoreOpen(false); }
    function onClick(e) { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClick);
    };
  }, [moreOpen]);
```

In the desktop link row, after the `navLinks.map(...)`:

```jsx
          {morePages.length > 0 && (
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                aria-expanded={moreOpen}
                aria-haspopup="true"
                className={`flex items-center gap-1 text-xs uppercase tracking-[0.2em] font-medium transition-colors py-1 ${
                  onMorePage
                    ? 'text-pitch-900 underline underline-offset-8'
                    : 'text-pitch-900/70 hover:text-pitch-900'
                }`}
              >
                More
                <ChevronDown className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {moreOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 min-w-[12rem] bg-offwhite-50 border border-pitch-900/10 shadow-xl py-2 z-40">
                  {morePages.map((page) => (
                    <NavLink
                      key={page.slug}
                      to={`/more/${page.slug}`}
                      onClick={() => setMoreOpen(false)}
                      className="block px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-pitch-900/80 hover:text-pitch-900 hover:bg-offwhite-200 transition-colors"
                    >
                      {page.title}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
```

In the mobile drawer, after its `navLinks.map(...)`:

```jsx
          {morePages.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] uppercase tracking-[0.25em] text-charcoal-500 font-bold pb-1">More</p>
              {morePages.map((page) => (
                <NavLink
                  key={page.slug}
                  to={`/more/${page.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-sm uppercase tracking-widest text-pitch-900 hover:text-charcoal-700 py-2 border-b border-pitch-900/5 font-medium"
                >
                  {page.title}
                </NavLink>
              ))}
            </div>
          )}
```

`Layout.jsx`: signature gains `morePages = []`, forwarded to `<Navbar ... morePages={morePages} />`.

- [ ] **Step 4: Run Navbar tests + lint** — pass, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Navbar.jsx src/components/Layout.jsx src/components/__tests__/Navbar.test.jsx
git commit -m "feat: More dropdown in the navbar, fed by admin-created pages"
```

---

### Task 6: CollectionPage + route

**Files:**
- Create: `src/pages/CollectionPage.jsx`
- Modify: `src/App.jsx`
- Test: `src/__tests__/App.routes.test.jsx`

**Interfaces:**
- Consumes: `useCollections` (Task 3), `Layout`'s `morePages` (Task 5), existing `handleOpenLightbox(url, index, list)` and `setVideoModalUrl`.
- Produces: route `/more/:slug`; `CollectionPage({ collections, loading, onOpenLightbox, onOpenVideo })`.

- [ ] **Step 1: Add failing route tests**

In `App.routes.test.jsx`, extend the `useContent` mock with `useCollections: () => ({ data: MOCK_COLLECTIONS, loading: false, error: null })` where:

```js
const MOCK_COLLECTIONS = [{
  id: 'c-1',
  slug: 'travels',
  title: 'Travels',
  description: 'On the road with couples.',
  items: [
    { id: 'i-1', url: '/images/x/1.jpg', videoEmbedUrl: null, caption: null },
    { id: 'i-2', url: '', videoEmbedUrl: 'https://www.youtube.com/embed/abc', caption: 'Teaser' },
  ],
}];
```

and add tests (using the file's existing renderAt/route helper):

```js
describe('/more/:slug', () => {
  it('renders a published collection page with its photos and videos', () => {
    renderAt('/more/travels');
    expect(screen.getByRole('heading', { name: 'Travels' })).toBeInTheDocument();
    expect(screen.getByText('On the road with couples.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view photo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play video/i })).toBeInTheDocument();
  });

  it('shows the not-found content for an unknown slug once loaded', () => {
    renderAt('/more/nope');
    expect(screen.getByText(/page not found|nothing here/i)).toBeInTheDocument();
  });

  it('shows the More menu in the navbar when pages exist', () => {
    renderAt('/');
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });
});
```

(Read `NotFoundPage.jsx` first and match its actual copy in the second assertion.)

- [ ] **Step 2: Run to verify failures.**

- [ ] **Step 3: Implement**

`src/pages/CollectionPage.jsx`:

```jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import NotFoundPage from './NotFoundPage';

// An admin-created "More" page: Gallery-style two-up sharp-cornered grid.
// Photo items open the lightbox over this page's photos; video items show
// their poster (or a quiet placeholder) and open the existing video modal.
// While the collections list is still loading, an unknown slug renders
// nothing rather than flashing NotFound at someone following a direct link.
export default function CollectionPage({ collections, loading, onOpenLightbox, onOpenVideo }) {
  const { slug } = useParams();
  const collection = collections.find((candidate) => candidate.slug === slug);

  if (!collection) {
    return loading ? null : <NotFoundPage />;
  }

  const photoItems = collection.items.filter((item) => !item.videoEmbedUrl);
  const photoList = photoItems.map((item) => ({ id: item.id, url: item.url, title: item.caption || collection.title }));

  return (
    <>
      <PageHeader title={collection.title} />
      <section className="py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {collection.description && (
            <p className="text-center text-sm text-charcoal-700 max-w-2xl mx-auto mb-10">{collection.description}</p>
          )}
          {collection.items.length === 0 && (
            <p className="text-center text-charcoal-500 py-16">This page is being curated.</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {collection.items.map((item) => (
              item.videoEmbedUrl ? (
                <button
                  key={item.id}
                  onClick={() => onOpenVideo(item.videoEmbedUrl)}
                  aria-label={`Play video${item.caption ? `: ${item.caption}` : ''}`}
                  className="relative block overflow-hidden group aspect-square bg-pitch-900"
                >
                  {item.url && (
                    <img src={item.url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-[1.03] transition-transform duration-700" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-12 h-12 rounded-full bg-offwhite-50/90 flex items-center justify-center">
                      <Play className="w-5 h-5 text-pitch-900 translate-x-[1px]" aria-hidden="true" />
                    </span>
                  </span>
                  {item.caption && (
                    <span className="absolute bottom-0 inset-x-0 bg-pitch-950/60 text-offwhite-50 text-[10px] uppercase tracking-widest py-1.5 px-2 text-left truncate">
                      {item.caption}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  key={item.id}
                  onClick={() => onOpenLightbox(item.url, photoList.findIndex((p) => p.id === item.id), photoList)}
                  aria-label={item.caption ? `View photo: ${item.caption}` : 'View photo'}
                  className="block overflow-hidden group"
                >
                  <img src={item.url} alt={item.caption || ''} loading="lazy" className="aspect-square w-full object-cover group-hover:scale-[1.03] transition-transform duration-700" />
                </button>
              )
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
```

`src/App.jsx`: `const { data: collections, loading: collectionsLoading } = useCollections();` (extend the import), pass `morePages={collections.map(({ title, slug }) => ({ title, slug }))}` to `Layout`, and add before the `*` route:

```jsx
          <Route
            path="more/:slug"
            element={
              <CollectionPage
                collections={collections}
                loading={collectionsLoading}
                onOpenLightbox={handleOpenLightbox}
                onOpenVideo={(url) => setVideoModalUrl(url)}
              />
            }
          />
```

- [ ] **Step 4: Run `src/__tests__/App.routes.test.jsx` + Navbar + lint** — pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CollectionPage.jsx src/App.jsx src/__tests__/App.routes.test.jsx
git commit -m "feat: /more/:slug collection pages wired into routes and the More menu"
```

---

### Task 7: Admin queries — collections resource (slug retry) + collection items

**Files:**
- Create: `src/admin/resources/collections.js`, `src/lib/queries/adminCollectionItems.js`
- Test: `src/admin/resources/__tests__/collections.test.js`, `src/lib/queries/__tests__/adminCollectionItems.test.js`

**Interfaces:**
- Consumes: `makeResourceQueries(table, columns, options)` (existing), the Task 1 tables.
- Produces:
  - `collectionsResource` — `{ key: 'pages', label: 'Pages', table: 'collections', columns: ['id', 'slug', 'title', 'description', 'sort_order', 'status'], defaultSort: 'sort_order', listColumns: [{ name: 'title', label: 'Title' }, { name: 'slug', label: 'URL' }, { name: 'status', label: 'Status' }], fields: [title (text, required), description (textarea, optional, emptyValue null)] }`.
  - `collectionsQueries` — the factory's queries with `create(values)` overridden: derive `slugify(title) || 'page'`; on a unique-violation error (message matches `/duplicate key|unique/i`) retry ONCE with `-${crypto.randomUUID().split('-')[0]}` appended; any other error rethrows.
  - `adminCollectionItems.js` — `listCollectionItems(collectionId)` → `[{ id, mediaId, videoEmbedUrl, caption, sortOrder, storagePath, altText }]`; `addCollectionPhoto(collectionId, mediaId)`; `addCollectionVideo(collectionId, { videoEmbedUrl, posterMediaId = null, caption = null })`; `removeCollectionItem(id)`; `reorderCollectionItems(orderedIds)` (items have their own uuid `id`, so reorder keys by it — unlike wedding_photos). Both adds append after the current max `sort_order` (same two-step read/insert as `addWeddingPhoto`, same tolerated race, same comment).

- [ ] **Step 1: Write failing tests**

`collections.test.js` follows `src/admin/resources/__tests__/gallery.test.js`'s mock pattern (mock `makeResourceQueries`); assert: called with `('collections', collectionsResource.columns, {})` — no thumbnailColumn; the config's key/label/fields shapes; and the slug behaviour by mocking the base `create`:

```js
  it('creates with a clean slug from the title', async () => {
    baseCreate.mockResolvedValue({ id: 'c-1' });
    await collectionsQueries.create({ title: 'Travel Diaries!' });
    expect(baseCreate).toHaveBeenCalledWith(expect.objectContaining({ slug: 'travel-diaries' }));
  });

  it('retries once with a suffix when the slug collides', async () => {
    baseCreate
      .mockRejectedValueOnce(new Error('collections: create failed: duplicate key value violates unique constraint "collections_slug_key"'))
      .mockResolvedValueOnce({ id: 'c-2' });
    await collectionsQueries.create({ title: 'Travels' });
    expect(baseCreate).toHaveBeenCalledTimes(2);
    expect(baseCreate.mock.calls[1][0].slug).toMatch(/^travels-[0-9a-f]{8}$/);
  });

  it('rethrows non-collision errors without retrying', async () => {
    baseCreate.mockRejectedValue(new Error('collections: create failed: permission denied'));
    await expect(collectionsQueries.create({ title: 'Travels' })).rejects.toThrow(/permission denied/);
    expect(baseCreate).toHaveBeenCalledTimes(1);
  });
```

`adminCollectionItems.test.js` follows `adminWeddingPhotos.test.js`'s chain-stub pattern: list maps snake→camel with the media join; addCollectionPhoto inserts `{ collection_id, media_id, sort_order: max+1 }`; addCollectionVideo inserts `{ collection_id, video_embed_url, media_id: posterMediaId, caption, sort_order }`; removeCollectionItem deletes by `id` and never touches `media`; reorder writes index as sort_order per id; every function throws prefixed errors.

- [ ] **Step 2: Run to verify failures.**

- [ ] **Step 3: Implement**

`src/admin/resources/collections.js` — reuse weddings.js's local `slugify` (copy it with the same comment pointing at weddings.js's original):

```js
import { makeResourceQueries } from '../../lib/queries/adminContent';

function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const collectionsResource = {
  key: 'pages',
  label: 'Pages',
  table: 'collections',
  columns: ['id', 'slug', 'title', 'description', 'sort_order', 'status'],
  defaultSort: 'sort_order',
  listColumns: [
    { name: 'title', label: 'Title' },
    { name: 'slug', label: 'URL' },
    { name: 'status', label: 'Status' },
  ],
  fields: [
    {
      name: 'title', label: 'Title', type: 'text', required: true, help: 'Shown in the More menu and as the page heading.',
    },
    {
      name: 'description', label: 'Description', type: 'textarea', required: false, emptyValue: null, help: 'Optional intro shown under the page heading.',
    },
  ],
};

const baseQueries = makeResourceQueries(collectionsResource.table, collectionsResource.columns, {});

export const collectionsQueries = {
  ...baseQueries,
  // Clean slugs normally (/more/travels), collision-proof always: only when
  // the unique constraint refuses the clean slug does a short random suffix
  // get appended — unlike weddings, where every slug carries one, a page's
  // slug is a visitor-visible URL worth keeping pretty.
  async create(values) {
    const base = slugify(values?.title) || 'page';
    try {
      return await baseQueries.create({ ...values, slug: base });
    } catch (err) {
      if (!/duplicate key|unique/i.test(err?.message ?? '')) throw err;
      const suffix = crypto.randomUUID().split('-')[0];
      return baseQueries.create({ ...values, slug: `${base}-${suffix}` });
    }
  },
};
```

`src/lib/queries/adminCollectionItems.js` — mirror `adminWeddingPhotos.js`'s structure and comments (single-id key instead of composite):

```js
import { supabase } from '../supabase';

// Hand-written like adminWeddingPhotos.js and for the same reasons: no
// status column for a publish toggle, an append-at-max add, and the same
// standing rule — removing an item must NEVER delete the underlying media
// row. `media` is never named in a delete anywhere in this module.

const ITEM_SELECT = 'id, media_id, video_embed_url, caption, sort_order, media:media_id (storage_path, alt_text)';

function toItem(row) {
  return {
    id: row.id,
    mediaId: row.media_id,
    videoEmbedUrl: row.video_embed_url,
    caption: row.caption,
    sortOrder: row.sort_order,
    storagePath: row.media?.storage_path ?? null,
    altText: row.media?.alt_text ?? '',
  };
}

export async function listCollectionItems(collectionId) {
  const { data, error } = await supabase
    .from('collection_items')
    .select(ITEM_SELECT)
    .eq('collection_id', collectionId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`listCollectionItems(${collectionId}): ${error.message}`);
  return (data ?? []).map(toItem);
}

// Same two-step append (read max, insert max+1) and the same deliberately
// tolerated race as addWeddingPhoto — see that function's comment.
async function nextSortOrder(collectionId, label) {
  const { data, error } = await supabase
    .from('collection_items')
    .select('sort_order')
    .eq('collection_id', collectionId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (error) throw new Error(`${label}: ${error.message}`);
  return data?.length ? data[0].sort_order + 1 : 0;
}

export async function addCollectionPhoto(collectionId, mediaId) {
  const label = `addCollectionPhoto(${collectionId}, ${mediaId})`;
  const sortOrder = await nextSortOrder(collectionId, label);
  const { data, error } = await supabase
    .from('collection_items')
    .insert({ collection_id: collectionId, media_id: mediaId, sort_order: sortOrder })
    .select(ITEM_SELECT)
    .single();
  if (error) throw new Error(`${label}: ${error.message}`);
  return toItem(data);
}

export async function addCollectionVideo(collectionId, { videoEmbedUrl, posterMediaId = null, caption = null }) {
  const label = `addCollectionVideo(${collectionId})`;
  const sortOrder = await nextSortOrder(collectionId, label);
  const { data, error } = await supabase
    .from('collection_items')
    .insert({
      collection_id: collectionId,
      video_embed_url: videoEmbedUrl,
      media_id: posterMediaId,
      caption,
      sort_order: sortOrder,
    })
    .select(ITEM_SELECT)
    .single();
  if (error) throw new Error(`${label}: ${error.message}`);
  return toItem(data);
}

export async function removeCollectionItem(id) {
  const { error } = await supabase.from('collection_items').delete().eq('id', id);
  if (error) throw new Error(`removeCollectionItem(${id}): ${error.message}`);
  return { id };
}

export async function reorderCollectionItems(orderedIds) {
  const results = await Promise.all(orderedIds.map((id, index) => supabase
    .from('collection_items')
    .update({ sort_order: index })
    .eq('id', id)));
  const failed = results.find((result) => result.error);
  if (failed) throw new Error(`reorderCollectionItems: ${failed.error.message}`);
  return { ok: true };
}
```

- [ ] **Step 4: Run both test files + lint.**

- [ ] **Step 5: Commit**

```bash
git add src/admin/resources/collections.js src/lib/queries/adminCollectionItems.js src/admin/resources/__tests__/collections.test.js src/lib/queries/__tests__/adminCollectionItems.test.js
git commit -m "feat(admin): collections resource with pretty-slug retry + collection item queries"
```

---

### Task 8: CollectionItems — the page's content manager

**Files:**
- Create: `src/admin/CollectionItems.jsx`
- Test: `src/admin/__tests__/CollectionItems.test.jsx`

**Interfaces:**
- Consumes: Task 7's `adminCollectionItems` functions, `listMedia`, `MediaPickerDialog`, `MediaSlot`, `useResource`, `mediaUrl`.
- Produces: `CollectionItems({ collectionId })` — mounted by Task 9's Pages form view with `key={collectionId}`.

- [ ] **Step 1: Write failing tests**

Model the file on `WeddingPhotos.test.jsx` (mock `../../lib/queries/adminCollectionItems`, `../../lib/queries/media`, `../../hooks/useMediaUpload`; `vi.resetModules()` + stubEnv render helper). Cover:

```js
  it('lists items with a ▶ badge on videos and captions shown', ...)   // listCollectionItems rows: one photo, one video with caption
  it('attaches photographs through the dialog, which stays open', ...) // click "Add photographs" → dialog → Select → addCollectionPhoto called, dialog still open
  it('marks already-attached photographs as selected', ...)            // photo item's mediaId appears ✓ Selected; clicking calls addCollectionPhoto zero times
  it('adds a video with URL validation', async () => {
    const user = userEvent.setup();
    await renderItems();
    await user.click(screen.getByRole('button', { name: /add video/i }));
    await user.type(screen.getByLabelText(/video embed url/i), 'not-a-url');
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/must start with http/i);
    expect(addCollectionVideo).not.toHaveBeenCalled();
  });
  it('adds a valid video with caption', ...)  // type https://www.youtube.com/embed/abc + caption → addCollectionVideo called with { videoEmbedUrl, posterMediaId: null, caption }
  it('removes an item after confirm, keeping the photograph', ...)     // confirm(true) → removeCollectionItem(id)
  it('reorders with the arrows', ...)                                  // move down → reorderCollectionItems([secondId, firstId])
```

- [ ] **Step 2: Run to verify failure (module missing).**

- [ ] **Step 3: Implement `src/admin/CollectionItems.jsx`**

Clone `WeddingPhotos.jsx`'s structure (useResource over memoized queries keyed by `collectionId`; separate media useResource; `runAction`; the same error-copy block) with these differences:

- Queries object: `{ list: () => listCollectionItems(collectionId), addPhoto: (mediaId) => addCollectionPhoto(collectionId, mediaId), addVideo: (video) => addCollectionVideo(collectionId, video), remove: (id) => removeCollectionItem(id), reorder: (ids) => reorderCollectionItems(ids) }`.
- Item tile: photo items render their image; video items render poster (via `mediaUrl(item.storagePath)`) or a `bg-pitch-900` block, with a small `▶` badge (`<span aria-hidden>▶</span>` + sr-only "Video") and the caption beneath when set. Controls per tile: ↑ / ↓ / Remove (confirm copy: `Remove this item from the page? Photographs stay in the media library.`).
- Below the grid, two buttons: **Add photographs** (opens `MediaPickerDialog` — `title="Add photographs to this page"`, `selectedIds` = photo items' mediaIds (`items.filter((i) => !i.videoEmbedUrl).map((i) => i.mediaId)`), `onSelect` adds when not already attached, stays open, `onUploaded` adds + reloads media, `closeLabel="Done"`) and **Add video** (toggles an inline form).
- The video form (local state `{ videoEmbedUrl: '', caption: '' }`, `posterId` via a `MediaSlot` labelled "Poster (optional)" fed by the media resource): labelled inputs "Video Embed URL" (help text mirroring films': an embed URL, not a watch-page link) and "Caption (optional)". Its Add button validates `/^https?:\/\//i` — failure renders a `role="alert"` "Must start with http:// or https://." and does not call `addVideo`; success calls `runAction('addVideo', { videoEmbedUrl, posterMediaId: posterId, caption: caption.trim() || null })`, clears, and collapses the form.

- [ ] **Step 4: Run the file's tests + lint.**

- [ ] **Step 5: Commit**

```bash
git add src/admin/CollectionItems.jsx src/admin/__tests__/CollectionItems.test.jsx
git commit -m "feat(admin): collection items manager — batch photo attach + video adds"
```

---

### Task 9: Pages tab + overview card

**Files:**
- Modify: `src/admin/App.jsx`, `src/lib/queries/adminOverview.js`, `src/admin/DashboardOverview.jsx`
- Test: `src/admin/__tests__/App.test.jsx`, `src/lib/queries/__tests__/adminOverview.test.js`, `src/admin/__tests__/DashboardOverview.test.jsx`

**Interfaces:**
- Consumes: Tasks 7–8.
- Produces: tab key `pages` (hash-persisted automatically via `TAB_KEYS`); `getOverviewCounts()` result gains `pages: { published, draft }`.

- [ ] **Step 1: Update tests**

- `adminOverview.test.js`: extend the existing counts assertions with `pages` sourced from the `collections` table (read the file; it stubs `countWhere`-style chains — add the table to the expected `from` calls and result).
- `DashboardOverview.test.jsx`: counts fixture gains `pages: { published: 1, draft: 2 }`; assert a "Pages" card renders and clicking it calls `onNavigate('pages')` (match the file's existing card test).
- `App.test.jsx`: add a `vi.mock('../resources/collections.js', ...)` with a small fixture config (key `'pages'`, label `'Pages'`, table `'collections'`, columns `['id', 'slug', 'title', 'sort_order', 'status']`, listColumns title/slug/status, fields: title required + sortOrder) and `collectionsQueries` fns; mock `../../lib/queries/adminCollectionItems` (list resolving `[]`, add/remove/reorder fns). `getOverviewCounts` fixture gains `pages: { published: 0, draft: 0 }`. Add a describe mirroring the Weddings tab's: switching to Pages lists via `collectionsList` (not before); creating through the form calls `collectionsCreate`; editing an existing page ALSO renders the items manager (assert the "Add photographs" button appears on edit but not on create — `view.item?.id` gating, same as WeddingPhotos).

- [ ] **Step 2: Run to verify the new tests fail.**

- [ ] **Step 3: Implement**

- `adminOverview.js`: add `pages: statusPair('collections')` to the `Promise.all` and result (keep alphabetical-ish placement; update the module comment's count).
- `DashboardOverview.jsx`: add a Pages card next to the existing content cards, `onNavigate('pages')`.
- `admin/App.jsx`: import `collectionsResource, collectionsQueries` and `CollectionItems`; add `{ key: 'pages', label: 'Pages' }` to `DASHBOARD_TABS` between Testimonials and Settings; add a `PagesDashboard` — copy `WeddingsDashboard`'s body exactly (view state, `useScrollToTop(view.mode)`, `runListAction`, `handleSubmit`, `CreatedDraftBanner` with `label={justCreated.title ?? ''}`, `listActionError` block), with `collectionsResource`/`collectionsQueries`, headings "Edit Page"/"Add Page"/"Pages", keys `page-form-*`, and the child manager:

```jsx
        {view.item?.id && (
          <CollectionItems key={`page-items-${view.item.id}`} collectionId={view.item.id} />
        )}
```

- Render `{tab === 'pages' && <PagesDashboard />}` in `AdminDashboard`.

- [ ] **Step 4: Run the three test files + lint, then `npm test`.**

- [ ] **Step 5: Commit**

```bash
git add src/admin/App.jsx src/lib/queries/adminOverview.js src/admin/DashboardOverview.jsx src/admin/__tests__/App.test.jsx src/lib/queries/__tests__/adminOverview.test.js src/admin/__tests__/DashboardOverview.test.jsx
git commit -m "feat(admin): Pages tab — create, publish, and fill More pages"
```

---

### Task 10: ManagedList — the shared list manager

**Files:**
- Create: `src/admin/ManagedList.jsx`
- Test: `src/admin/__tests__/ManagedList.test.jsx`

**Interfaces:**
- Produces: `ManagedList({ title, itemNoun, items, status, error, onRetry, onAdd, onRename, onReorder, onDelete, pending = false, actionError = null })` — presentational. `items` is `[{ id, name, sortOrder }]`. `onAdd(name)`, `onRename(item, nextName)`, `onReorder(orderedIds)`, `onDelete(item)`. Delete confirms via `window.confirm(`Delete "${name}"?`)`. Tasks 11–12 mount it.

- [ ] **Step 1: Write failing tests**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { default: ManagedList } = await import('../ManagedList.jsx');

const ITEMS = [
  { id: 'a', name: 'Pre-Wedding', sortOrder: 0 },
  { id: 'b', name: 'Wedding', sortOrder: 1 },
];

function baseProps(overrides = {}) {
  return {
    title: 'Manage categories',
    itemNoun: 'category',
    items: ITEMS,
    status: 'ready',
    error: null,
    onRetry: vi.fn(),
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onReorder: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

describe('ManagedList', () => {
  it('lists items in sortOrder with rename, reorder, and delete controls', () => {
    render(<ManagedList {...baseProps()} />);
    expect(screen.getByText('Manage categories')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /rename/i })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /move down: pre-wedding/i })).toBeInTheDocument();
  });

  it('adds a trimmed new item and clears the input; ignores blank', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<ManagedList {...props} />);
    const input = screen.getByLabelText(/new category/i);
    await user.type(input, '  Travel Diaries  ');
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    expect(props.onAdd).toHaveBeenCalledWith('Travel Diaries');
    expect(input).toHaveValue('');
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    expect(props.onAdd).toHaveBeenCalledTimes(1);
  });

  it('renames inline: Rename → edit → Save calls onRename; Cancel does not', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<ManagedList {...props} />);
    await user.click(screen.getAllByRole('button', { name: /rename/i })[0]);
    const editInput = screen.getByDisplayValue('Pre-Wedding');
    await user.clear(editInput);
    await user.type(editInput, 'Pre Wedding Shoots');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(props.onRename).toHaveBeenCalledWith(ITEMS[0], 'Pre Wedding Shoots');
  });

  it('reorders via arrows', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<ManagedList {...props} />);
    await user.click(screen.getByRole('button', { name: /move down: pre-wedding/i }));
    expect(props.onReorder).toHaveBeenCalledWith(['b', 'a']);
  });

  it('deletes only after confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    const props = baseProps();
    render(<ManagedList {...props} />);
    await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
    expect(props.onDelete).not.toHaveBeenCalled();
    confirmSpy.mockReturnValue(true);
    await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
    expect(props.onDelete).toHaveBeenCalledWith(ITEMS[0]);
    confirmSpy.mockRestore();
  });

  it('shows the action error and the load-error/retry state', () => {
    const props = baseProps({ actionError: { message: 'Cannot delete "Wedding" — 24 photograph(s) still use it.' } });
    render(<ManagedList {...props} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/24 photograph/);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

Presentational; local state only for the add-input value and which id is being renamed (plus its draft text). Sorted defensively by `sortOrder` (same reasoning comment as ResourceList). Layout: a bordered `section` with the `title` as a small bold heading; rows (name, then Rename/↑/↓/Delete buttons with `aria-label={`Move up: ${name}`}` etc., styled with the admin's existing small-button classes); rename swaps the name for an input + Save/Cancel; the footer row is a labelled input (`New {itemNoun}`) + **Add** button (disabled while `pending`); `status === 'error'` renders the standard could-not-load + Retry block; `actionError` renders `role="alert"` with `actionError.message`.

- [ ] **Step 4: Run the file's tests + lint.**

- [ ] **Step 5: Commit**

```bash
git add src/admin/ManagedList.jsx src/admin/__tests__/ManagedList.test.jsx
git commit -m "feat(admin): ManagedList — shared add/rename/reorder/delete list manager"
```

---

### Task 11: Gallery categories — admin queries, manager panel, dynamic select

**Files:**
- Create: `src/lib/queries/adminGalleryCategories.js`
- Modify: `src/admin/App.jsx` (GalleryDashboard)
- Test: `src/lib/queries/__tests__/adminGalleryCategories.test.js`, `src/admin/__tests__/App.test.jsx`

**Interfaces:**
- Consumes: `ManagedList` (Task 10), the `rename_gallery_category` RPC (Task 1).
- Produces: `listGalleryCategories()` → `[{ id, name, sortOrder }]`; `addGalleryCategory(name)`; `renameGalleryCategory(oldName, newName)` (RPC); `reorderGalleryCategories(orderedIds)`; `removeGalleryCategory(id, name)` — counts `gallery_photos` with that category first and throws `Cannot delete "<name>" — <n> photograph(s) still use it.` when n > 0.

- [ ] **Step 1: Write failing query tests**

Chain-stub pattern. Cover: list maps and orders; add inserts `{ name, sort_order: max+1 }` (same two-step append as Task 7 — read max first); rename calls `supabase.rpc('rename_gallery_category', { p_old: 'A', p_new: 'B' })` and throws prefixed on error; reorder writes indexes; remove with 0 usages deletes by id; remove with 3 usages throws the exact refusal copy and NEVER calls delete:

```js
  it('refuses to delete a category photographs still use, naming the count', async () => {
    const countChain = { select: vi.fn(() => countChain), eq: vi.fn(() => Promise.resolve({ count: 3, error: null })) };
    mockFrom.mockReturnValueOnce(countChain);
    const { removeGalleryCategory } = await import('../adminGalleryCategories.js');
    await expect(removeGalleryCategory('cat-1', 'Wedding')).rejects.toThrow('Cannot delete "Wedding" — 3 photograph(s) still use it.');
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
```

(The count query: `from('gallery_photos').select('id', { count: 'exact', head: true }).eq('category', name)` — the `adminOverview.js` pattern.)

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement the query module**

All functions throw errors prefixed `gallery_categories:`. `removeGalleryCategory(id, name)`: head-count first; if `count > 0` throw the refusal copy verbatim; else `delete().eq('id', id)`.

- [ ] **Step 4: Wire GalleryDashboard (with failing App.test first)**

App.test.jsx: mock `../../lib/queries/adminGalleryCategories` (list resolves the four; fns captured); add tests to the Gallery describe: opening the Gallery tab shows "Manage categories" with the four; the Add Gallery Photo form's Category select offers exactly the mocked list's names (open the form, assert `screen.getByRole('option', { name: 'Haldi & Mehendi' })`); adding calls `addGalleryCategory('Travel Diaries')`; renaming calls `renameGalleryCategory('Pre-Wedding', 'X')`; a failed delete's message renders as an alert.

Then in `GalleryDashboard`: a second `useResource` over memoized `{ list: listGalleryCategories, add: addGalleryCategory, rename: renameGalleryCategory, reorder: reorderGalleryCategories, remove: removeGalleryCategory }`; a `categoriesActionError` state + `runCategoriesAction(name, ...args)` (same catch shape as `runListAction`); the form config goes dynamic:

```jsx
  const formConfig = useMemo(() => {
    if (!categories.length) return galleryResource;
    return {
      ...galleryResource,
      fields: galleryResource.fields.map((field) => (
        field.name === 'category'
          ? { ...field, options: categories.map((c) => ({ value: c.name, label: c.name })) }
          : field
      )),
    };
  }, [categories]);
```

(`formConfig` replaces `galleryResource` in the `ResourceForm` call only — `ResourceList` keeps the static config.) The list view renders, between the banner block and `ResourceList`:

```jsx
      <ManagedList
        title="Manage categories"
        itemNoun="category"
        items={categories}
        status={categoriesStatus}
        error={categoriesError}
        onRetry={reloadCategories}
        onAdd={(name) => runCategoriesAction('add', name)}
        onRename={(item, next) => runCategoriesAction('rename', item.name, next)}
        onReorder={(ids) => runCategoriesAction('reorder', ids)}
        onDelete={(item) => runCategoriesAction('remove', item.id, item.name)}
        actionError={categoriesActionError}
      />
```

- [ ] **Step 5: Run adminGalleryCategories + App.test + lint, then `npm test`.**

- [ ] **Step 6: Commit**

```bash
git add src/lib/queries/adminGalleryCategories.js src/admin/App.jsx src/lib/queries/__tests__/adminGalleryCategories.test.js src/admin/__tests__/App.test.jsx
git commit -m "feat(admin): gallery categories managed from the Gallery tab, form select goes dynamic"
```

---

### Task 12: Booking services — admin queries + Settings panel

**Files:**
- Create: `src/lib/queries/adminBookingServices.js`
- Modify: `src/admin/App.jsx` (SettingsDashboard)
- Test: `src/lib/queries/__tests__/adminBookingServices.test.js`, `src/admin/__tests__/App.test.jsx`

**Interfaces:**
- Consumes: `ManagedList` (Task 10).
- Produces: `listBookingServices()` → `[{ id, name, sortOrder }]`; `addBookingService(name)` (append-at-max); `renameBookingService(id, name)` (plain update — historical inquiries untouched); `reorderBookingServices(orderedIds)`; `removeBookingService(id)` (no usage guard — removal only affects the form going forward).

- [ ] **Step 1: Failing query tests** — same chain-stub shapes as Task 11 minus the RPC and the refusal (rename asserts `update({ name }).eq('id', id)`; remove asserts plain delete). Errors prefixed `booking_services:`.

- [ ] **Step 2: Run to verify failure. Implement the module. Run again.**

- [ ] **Step 3: Wire SettingsDashboard (failing App.test first)**

App.test.jsx: mock `../../lib/queries/adminBookingServices` (list resolves the four); Settings-tab tests: the "Booking services" panel renders under the settings form with the four; adding calls `addBookingService('Album Design')`. Then in `SettingsDashboard`: a services `useResource` (memoized `{ list, add, rename, reorder, remove }` mapping to the module fns — `rename: (item, next) => renameBookingService(item.id ?? item, next)`; simplest is `rename: renameBookingService` with the callback below passing `(item.id, next)`), `servicesActionError` + runner, and after `<SettingsForm ... />`:

```jsx
      <div className="mt-10">
        <ManagedList
          title="Booking services"
          itemNoun="service"
          items={services}
          status={servicesStatus}
          error={servicesError}
          onRetry={reloadServices}
          onAdd={(name) => runServicesAction('add', name)}
          onRename={(item, next) => runServicesAction('rename', item.id, next)}
          onReorder={(ids) => runServicesAction('reorder', ids)}
          onDelete={(item) => runServicesAction('remove', item.id)}
          actionError={servicesActionError}
        />
        <p className="mt-2 text-xs text-charcoal-500">
          Changes apply to the contact form going forward — past inquiries keep the services they were sent with.
        </p>
      </div>
```

- [ ] **Step 4: Run both test files + lint, then `npm test`.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/adminBookingServices.js src/admin/App.jsx src/lib/queries/__tests__/adminBookingServices.test.js src/admin/__tests__/App.test.jsx
git commit -m "feat(admin): booking services managed from Settings"
```

---

### Task 13: verify:admin legs, docs, full gates

**Files:**
- Modify: `scripts/verify-admin.mjs`, `docs/DATA-MODEL.md`, `docs/ARCHITECTURE.md`, `docs/COMPONENTS.md`, `docs/ROADMAP.md`

**Interfaces:**
- Consumes: everything above, running against the live local stack.

- [ ] **Step 1: Add the three legs to `scripts/verify-admin.mjs`**

Follow the settings leg's structure exactly (session = authenticated admin client, anon = anon client, `check(...)` assertions, module-level crash-cleanup markers, restore in `clean()`). Import the real public modules next to `getWeddingBySlug`:

```js
const { getCollections } = await import('../src/lib/queries/collections.js');
const { getGalleryCategories } = await import('../src/lib/queries/gallery.js');
const { getBookingServices } = await import('../src/lib/queries/bookingServices.js');
```

Module-level markers: `let probeCollectionId = null; let probeCategoryId = null; let probeServiceId = null;` — `clean()` additionally deletes (via `admin`) `collections` rows with slug like `verify-page-%`, `gallery_categories` and `booking_services` rows with name like `VERIFY %`, then nulls the markers.

Leg A — pages (after the settings leg in `main()`):

```js
  // ---- Pages (collections) leg ----
  const pageSlug = `verify-page-${Date.now()}`;
  const { data: anyMedia } = await session.from('media').select('id').limit(1).single();
  const { data: createdPage, error: pageCreateErr } = await session
    .from('collections')
    .insert({ slug: pageSlug, title: 'VERIFY page', status: 'draft' })
    .select('id')
    .single();
  check('pages: admin creates a draft page', !pageCreateErr, pageCreateErr?.message);
  probeCollectionId = createdPage?.id ?? null;

  await session.from('collection_items').insert([
    { collection_id: probeCollectionId, media_id: anyMedia.id, sort_order: 0 },
    { collection_id: probeCollectionId, video_embed_url: 'https://www.youtube.com/embed/VERIFY', caption: 'probe', sort_order: 1 },
  ]);

  const beforePublish = await getCollections();
  check('pages: a draft page is invisible to the public', !beforePublish.some((c) => c.slug === pageSlug));

  await session.from('collections').update({ status: 'published' }).eq('id', probeCollectionId);
  const afterPublish = await getCollections();
  const publicPage = afterPublish.find((c) => c.slug === pageSlug);
  check('pages: published page reaches the public read path', Boolean(publicPage));
  check('pages: both items came through in order', publicPage?.items?.length === 2
    && Boolean(publicPage.items[0].url) && publicPage.items[1].videoEmbedUrl === 'https://www.youtube.com/embed/VERIFY');

  const { error: pageDeleteErr } = await session.from('collections').delete().eq('id', probeCollectionId);
  const { count: orphanCount } = await admin.from('collection_items').select('id', { count: 'exact', head: true }).eq('collection_id', probeCollectionId);
  check('pages: delete cascades to items', !pageDeleteErr && orphanCount === 0);
  if (!pageDeleteErr) probeCollectionId = null;
```

Leg B — categories: session inserts `{ name: 'VERIFY Category', sort_order: 999 }` (marker `probeCategoryId`), calls `session.rpc('rename_gallery_category', { p_old: 'VERIFY Category', p_new: 'VERIFY Renamed' })`, `getGalleryCategories()` must include `'VERIFY Renamed'` and not `'VERIFY Category'`, then deletes by id and clears the marker. Also check the anon client CANNOT call the RPC (`anon.rpc(...)` errors).

Leg C — services: session inserts `{ name: 'VERIFY Service', sort_order: 999 }`, `getBookingServices()` includes it, delete, clear marker.

- [ ] **Step 2: Run the live gates**

Run: `npm run verify:inquiry` then `npm run verify:admin` (with the stack's env mapped as the script's header documents; the session sees the incremental migration already applied in Task 1).
Expected: every existing check still ok + the new pages/categories/services checks ok.

- [ ] **Step 3: Docs**

- `docs/DATA-MODEL.md`: document the three tables (columns, RLS summary, seeds) and the `rename_gallery_category` RPC; note `gallery_photos.category` stays text with `gallery_categories` as its managed vocabulary.
- `docs/ARCHITECTURE.md`: the routes list gains `/more/:slug`; the admin-app paragraph gains one sentence (Pages tab; categories and services managed in-admin; More menu fed by published collections).
- `docs/COMPONENTS.md`: update prop rows for `Navbar` (`morePages`), `Layout` (`morePages`), `PhotoGallery` (`categoryOrder`), `BookingForm` (`services`); add the `CollectionPage` row to the Pages table (`/more/:slug`).
- `docs/ROADMAP.md`: `v0.4e` row (3e — Admin extensibility | More pages, managed categories, managed services | New sections/categories/services need no code change | local) + a Phase 3e paragraph after 3d's, linking the spec.

- [ ] **Step 4: Full gates, each standalone**

```bash
npm test
npm run lint
npm run check:docs
npm run build
git checkout -- dist/ && git clean -fx dist/
```

- [ ] **Step 5: Live smoke in a real browser**

With dev server + stack up: sign into the admin, create a "Travels" page with one photo and one video, publish, refresh the public site — the More menu appears; open `/more/travels`; screenshot both (Playwright script like Phase 3d's) and LOOK at them. Add a probe category in Gallery's Manage categories, confirm it appears in the photo form's select, then delete it. Delete the Travels probe page afterwards (this is the owner's real database — leave nothing behind).

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-admin.mjs docs/DATA-MODEL.md docs/ARCHITECTURE.md docs/COMPONENTS.md docs/ROADMAP.md
git commit -m "feat: verify:admin proves pages/categories/services round-trips; Phase 3e docs"
```

---

## After the last task

Use superpowers:finishing-a-development-branch: full suite on the branch, present the integration menu (the owner's standing pattern is merge to `main` locally + tag `v0.4e`; never push without asking).
