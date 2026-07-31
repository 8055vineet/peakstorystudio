# Phase 1b (v0.2b) — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the site's content out of a JavaScript file and into a real Postgres database behind Row Level Security, reachable through a data-access layer that components consume via hooks.

**Architecture:** Supabase running locally in Docker. Schema and policies are applied only through migration files, never by editing the database. The browser talks to Supabase directly using the anon key; RLS in Postgres — not client code — is what makes that safe. Components call hooks, hooks call queries, queries call Supabase; no component imports the client. A `VITE_DATA_SOURCE` flag keeps the static file working as a fallback during the migration.

**Tech Stack:** Supabase CLI 2.110.0, Docker, Postgres 15 (via Supabase), `@supabase/supabase-js`, Vitest.

## Global Constraints

- **Branch:** `phase-1/backend-foundation` (already created, currently at the Phase 1a merge commit `ae21ca9`).
- **`@supabase/supabase-js` is the one new runtime dependency** this phase adds, and the first the project has taken on since its initial commit. `dependencies` becomes exactly: `@supabase/supabase-js`, `canvas-confetti`, `lucide-react`, `react`, `react-dom`. Nothing else may be added to `dependencies`.
- **Schema changes go in `supabase/migrations/` only.** Never edit the running database directly — local and hosted must stay reproducible from the migration files.
- **Never commit a real key.** `.env.local` is git-ignored (`.env*` with an exception for `.env.example`). Local Supabase keys are printed by `supabase start` and are the same well-known demo keys on every machine, but they still belong in `.env.local`, not in a committed file.
- **`npm test` must never require a database.** Vitest tests use a mocked Supabase client so CI — which has no Postgres — stays green. Database checks live in a separate `npm run db:verify` script that CI does not run.
- **Every task must end green on:** `npm run lint`, `npm test`, `npm run check:docs`, and a clean `git status --short`.
- **Conventional Commits** for every commit.
- **`dist/` is committed to git AND `.gitignore`d** (`PS-019`). Do not run `npm run build` casually; if you do, clean up with `git checkout -- dist/` then `git clean -fx dist/`.
- **Any new file in `src/components/` must be added to `docs/COMPONENTS.md`** in the same task or `check:docs` fails.
- **Do not repeat fabricated content.** Per `CLAUDE.md`, never introduce press credentials, awards, statistics, or testimonials attributed to real people. The seed carries existing content across unchanged; correcting it is `PS-002`, scheduled for Phase 7.

### Scope boundary worth stating

`src/data/weddingData.js` exports six collections. The approved schema in the spec covers four of them: `INITIAL_STORIES`, `INITIAL_PHOTOS`, `INITIAL_FILMS`, `TESTIMONIALS`.

`FILM_STRIP_FRAMES` and `EDITORIAL_GALLERY` — moved into that file during Phase 1a — have **no table in the approved schema** and stay static in this phase. They are decorative strips whose editing story only matters once the CMS exists. Task 6 files an issue for them rather than inventing unapproved tables here.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/config.toml` (generated) | Local stack configuration from `supabase init` |
| `supabase/migrations/<ts>_initial_schema.sql` (create) | The eight tables |
| `supabase/migrations/<ts>_row_level_security.sql` (create) | RLS enable + policies + `is_admin()` |
| `scripts/seed-db.mjs` (create) | Copies `weddingData.js` into Postgres |
| `scripts/verify-db.mjs` (create) | Asserts schema and RLS behave; run by `npm run db:verify` |
| `src/lib/supabase.js` (create) | Client singleton — the only file importing `createClient` |
| `src/lib/queries/weddings.js` (create) | `getPublishedWeddings()`, `getWeddingBySlug(slug)` |
| `src/lib/queries/gallery.js` (create) | `getGalleryPhotos()` |
| `src/lib/queries/films.js` (create) | `getFilms()` |
| `src/lib/queries/testimonials.js` (create) | `getTestimonials()` |
| `src/lib/dataSource.js` (create) | Chooses static vs supabase from `VITE_DATA_SOURCE` |
| `src/hooks/useContent.js` (create) | `{ data, loading, error }` hooks over the queries |
| `src/App.jsx` (modify) | Reads content through hooks instead of importing the data file |
| `docs/*` (modify) | Keep documentation true as the data model moves |

**Ordering rationale:** schema before policies, because policies reference tables. Seed before the frontend layer, so the layer has real rows to read. Query layer before hooks, hooks before components — each is the interface the next one consumes.

---

## Task 1: Local Supabase and the schema migration

**Files:**
- Create: `supabase/` (via `supabase init`)
- Create: `supabase/migrations/<timestamp>_initial_schema.sql`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Produces: eight tables; `npm run db:start` / `npm run db:reset` scripts used by every later task.

**Context:** Docker is installed and running (daemon 29.6.2). Supabase CLI 2.110.0 is on PATH. Neither has been used in this repo yet.

- [ ] **Step 1: Initialise the local project**

```bash
supabase init
```

This creates `supabase/config.toml` and `supabase/.gitignore`. Answer no to any prompt about generating VS Code settings or Deno config — this project uses neither.

- [ ] **Step 2: Start the stack and record the credentials**

```bash
supabase start
```

First run pulls several container images and can take a few minutes. It prints an `API URL`, `anon key`, and `service_role key`. Record all three in your report — later tasks need them.

If it fails because Docker is unreachable, stop and report BLOCKED rather than working around it.

- [ ] **Step 3: Add the convenience scripts**

In `package.json` `scripts`, add:

```json
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
```

`db:reset` drops the local database and replays every migration from scratch — it is how each later task proves its migration works from nothing, not just from the current state.

- [ ] **Step 4: Create the schema migration**

```bash
supabase migration new initial_schema
```

Put this in the generated file. It is the schema from the approved spec, section 5.2:

```sql
-- Phase 1b: content schema. See docs/superpowers/specs/2026-07-30-end-to-end-platform-design.md section 5.2.

create table public.media (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  width int,
  height int,
  alt_text text not null default '',
  blurhash text,
  created_at timestamptz not null default now()
);

comment on column public.media.alt_text is
  'Accessibility text. Components previously passed the title as alt; this replaces that.';
comment on column public.media.blurhash is
  'Populated from Phase 3, when uploads exist. Feeds the .img-blur-up CSS in src/index.css.';

create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  couple text not null,
  location text not null,
  event_date date,
  summary text,
  cover_media_id uuid references public.media(id),
  video_url text,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','published')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wedding_photos (
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete restrict,
  sort_order int not null default 0,
  primary key (wedding_id, media_id)
);

create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id),
  title text not null,
  category text not null,
  couple text,
  location text,
  grid_span text,
  status text not null default 'published' check (status in ('draft','published')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.films (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  couple text,
  location text,
  duration_seconds int,
  thumbnail_media_id uuid references public.media(id),
  video_embed_url text not null,
  status text not null default 'published' check (status in ('draft','published')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  quote text not null,
  couple text not null,
  event text,
  status text not null default 'published' check (status in ('draft','published')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('admin','client')),
  display_name text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Admin is an explicit role, never merely an authenticated session. Phase 6 adds client
   sign-in, at which point every couple is authenticated too; policies testing only for
   authentication would hand couples full CRUD over site content.';

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  wedding_date date,
  venue text,
  services text[] not null default '{}',
  message text,
  status text not null default 'new' check (status in ('new','contacted','booked','archived')),
  source text not null default 'website',
  created_at timestamptz not null default now()
);

comment on table public.inquiries is
  'Written only by the Phase 2 Edge Function using the service-role key. Anon gets no access
   at all — see the RLS migration.';

create index weddings_status_sort_idx on public.weddings (status, sort_order);
create index gallery_photos_status_sort_idx on public.gallery_photos (status, sort_order);
create index films_status_sort_idx on public.films (status, sort_order);
create index testimonials_status_sort_idx on public.testimonials (status, sort_order);
create index wedding_photos_wedding_idx on public.wedding_photos (wedding_id, sort_order);
```

- [ ] **Step 5: Apply it from a clean database**

```bash
npm run db:reset
```

Expected: the reset completes and reports applying your migration. A syntax error surfaces here — fix the migration file and re-run, never patch the database by hand.

- [ ] **Step 6: Verify all eight tables exist**

```bash
supabase db reset >/dev/null 2>&1
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "\dt public.*"
```

Expected: exactly eight rows — `films`, `gallery_photos`, `inquiries`, `media`, `profiles`, `testimonials`, `wedding_photos`, `weddings`.

If `psql` is not installed on this machine, use the container instead:
```bash
docker exec -i "$(docker ps --format '{{.Names}}' | grep supabase_db)" psql -U postgres -d postgres -c "\dt public.*"
```
Record which method worked — later tasks reuse it.

- [ ] **Step 7: Keep local Supabase artefacts out of git**

`supabase init` writes its own `supabase/.gitignore`. Confirm what it covers, then check that nothing machine-local is staged:

```bash
git status --short
git check-ignore -v supabase/.branches supabase/.temp 2>/dev/null || true
```

`supabase/config.toml` and `supabase/migrations/` MUST be committed — they are the reproducible definition. `supabase/.branches/` and `supabase/.temp/` must not be.

- [ ] **Step 8: Verify the four gates and commit**

```bash
npm run lint; echo "lint=$?"
npm test
npm run check:docs; echo "docs=$?"
git status --short
```

```bash
git add supabase/ package.json .gitignore
git commit -m "feat: add local Supabase and the content schema

Eight tables from the approved spec: media, weddings, wedding_photos,
gallery_photos, films, testimonials, profiles, inquiries.

Schema lives in supabase/migrations and is applied only by replaying
migrations, so local and hosted stay reproducible from the same files.

profiles exists from the start so admin can be an explicit role rather
than 'any authenticated user' — Phase 6 adds client sign-in, and a
policy testing only for authentication would hand couples full CRUD."
```

---

## Task 2: Row Level Security

**Files:**
- Create: `supabase/migrations/<timestamp>_row_level_security.sql`
- Create: `scripts/verify-db.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: the tables from Task 1.
- Produces: `npm run db:verify` — a Node script asserting the policies actually behave. Later tasks re-run it.

**Context — why this matters more than it looks.** The anon key ships inside the browser bundle. What makes that safe is not secrecy but RLS: Postgres itself refuses anything the policies do not permit. If a policy is wrong, the key becomes a real hole. So this task ends by *proving* the policies with a script, not by reading them.

- [ ] **Step 1: Create the policy migration**

```bash
supabase migration new row_level_security
```

Put this in the generated file:

```sql
-- Phase 1b: RLS. See spec section 5.3.
-- The anon key is public by design; these policies are what make that safe.

-- security definer so the policies below can read profiles without
-- recursing through profiles' own RLS.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

alter table public.media           enable row level security;
alter table public.weddings        enable row level security;
alter table public.wedding_photos  enable row level security;
alter table public.gallery_photos  enable row level security;
alter table public.films           enable row level security;
alter table public.testimonials    enable row level security;
alter table public.profiles        enable row level security;
alter table public.inquiries       enable row level security;

-- Published content is world-readable.
create policy media_read_all on public.media
  for select using (true);

create policy weddings_read_published on public.weddings
  for select using (status = 'published');

create policy gallery_read_published on public.gallery_photos
  for select using (status = 'published');

create policy films_read_published on public.films
  for select using (status = 'published');

create policy testimonials_read_published on public.testimonials
  for select using (status = 'published');

create policy wedding_photos_read_published on public.wedding_photos
  for select using (
    exists (
      select 1 from public.weddings w
      where w.id = wedding_photos.wedding_id and w.status = 'published'
    )
  );

-- Admin gets full control of content.
create policy media_admin_all on public.media
  for all using (public.is_admin()) with check (public.is_admin());

create policy weddings_admin_all on public.weddings
  for all using (public.is_admin()) with check (public.is_admin());

create policy wedding_photos_admin_all on public.wedding_photos
  for all using (public.is_admin()) with check (public.is_admin());

create policy gallery_admin_all on public.gallery_photos
  for all using (public.is_admin()) with check (public.is_admin());

create policy films_admin_all on public.films
  for all using (public.is_admin()) with check (public.is_admin());

create policy testimonials_admin_all on public.testimonials
  for all using (public.is_admin()) with check (public.is_admin());

-- A user may read their own profile row; only admin may read or write any.
create policy profiles_read_own on public.profiles
  for select using (user_id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- inquiries: anon gets nothing at all. No select, no insert.
-- Phase 2's Edge Function writes with the service-role key, which bypasses RLS.
create policy inquiries_admin_read on public.inquiries
  for select using (public.is_admin());

create policy inquiries_admin_update on public.inquiries
  for update using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: Write the verification script**

Create `scripts/verify-db.mjs`. It uses `@supabase/supabase-js`, which Task 4 also needs — install it now:

```bash
npm install @supabase/supabase-js
```

```javascript
#!/usr/bin/env node
// Proves the RLS policies actually behave. Run: npm run db:verify
//
// Not part of `npm test`: this needs a running local Supabase, and CI has none.
// Reads credentials from the environment; `supabase status -o env` supplies them.

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Try: eval "$(supabase status -o env | sed \'s/^/export /')"');
  process.exit(2);
}

const anon = createClient(URL, ANON);
const service = createClient(URL, SERVICE, { auth: { persistSession: false } });

const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name} ${detail}`); failures.push(name); }
};

console.log('RLS checks:');

// Seed two weddings the test controls: one published, one draft.
const slugPub = 'rls-probe-published';
const slugDraft = 'rls-probe-draft';
await service.from('weddings').delete().in('slug', [slugPub, slugDraft]);
const { error: seedErr } = await service.from('weddings').insert([
  { slug: slugPub, title: 'Probe Published', couple: 'Probe Couple', location: 'Probe', status: 'published' },
  { slug: slugDraft, title: 'Probe Draft', couple: 'Probe Couple', location: 'Probe', status: 'draft' },
]);
if (seedErr) { console.error('could not seed probe rows:', seedErr.message); process.exit(2); }

const { data: pub } = await anon.from('weddings').select('slug').eq('slug', slugPub);
check('anon reads published weddings', Array.isArray(pub) && pub.length === 1);

const { data: draft } = await anon.from('weddings').select('slug').eq('slug', slugDraft);
check('anon cannot read draft weddings', Array.isArray(draft) && draft.length === 0);

const { error: insErr } = await anon
  .from('weddings')
  .insert({ slug: 'rls-probe-anon-write', title: 'x', couple: 'x', location: 'x' });
check('anon cannot insert weddings', Boolean(insErr));

const { error: updErr } = await anon.from('weddings').update({ title: 'hacked' }).eq('slug', slugPub);
const { data: afterUpd } = await service.from('weddings').select('title').eq('slug', slugPub).single();
check('anon cannot update weddings', Boolean(updErr) || afterUpd.title === 'Probe Published');

const { data: inqRead, error: inqReadErr } = await anon.from('inquiries').select('id');
check('anon cannot read inquiries', Boolean(inqReadErr) || (inqRead && inqRead.length === 0));

const { error: inqInsErr } = await anon
  .from('inquiries')
  .insert({ name: 'x', email: 'x@example.com', phone: '0' });
check('anon cannot insert inquiries', Boolean(inqInsErr));

await service.from('weddings').delete().in('slug', [slugPub, slugDraft, 'rls-probe-anon-write']);

console.log(failures.length ? `\n${failures.length} RLS check(s) FAILED` : '\nall RLS checks passed');
process.exit(failures.length ? 1 : 0);
```

- [ ] **Step 3: Add the script entry**

In `package.json` `scripts`:

```json
    "db:verify": "node scripts/verify-db.mjs",
```

Do NOT add it to `test`. CI has no database; wiring it into `npm test` would turn CI red.

- [ ] **Step 4: Apply and verify**

```bash
npm run db:reset
eval "$(supabase status -o env | sed 's/^/export /')"
npm run db:verify; echo "verify=$?"
```

Expected: every check prints `ok`, then `all RLS checks passed`, `verify=0`.

- [ ] **Step 5: Prove the verifier can actually fail**

A green check that cannot go red proves nothing. Temporarily loosen one policy, confirm the script catches it, then restore:

```bash
eval "$(supabase status -o env | sed 's/^/export /')"
psql "$DB_URL" -c "alter policy weddings_read_published on public.weddings using (true);"
npm run db:verify; echo "expected non-zero: $?"
npm run db:reset >/dev/null
npm run db:verify; echo "back to green: $?"
```

Expected: the middle run FAILS on "anon cannot read draft weddings" with a non-zero exit, and the final run returns to 0. If the middle run passes, the verifier is not actually testing the policy — fix it before continuing.

(If `psql` is unavailable, apply the `alter policy` through the container method you recorded in Task 1 Step 6.)

- [ ] **Step 6: Verify gates and commit**

```bash
npm run lint; echo "lint=$?"
npm test
npm run check:docs; echo "docs=$?"
git status --short
```

```bash
git add supabase/migrations scripts/verify-db.mjs package.json package-lock.json
git commit -m "feat: enable row level security with a verifier that can fail

The anon key ships in the browser bundle; RLS is what makes that safe.
Anon may read published content only, and gets no access to inquiries at
all — not even insert, since Phase 2's Edge Function writes with the
service-role key.

Admin is checked through a security-definer is_admin() reading profiles,
so the policy does not recurse through profiles' own RLS.

scripts/verify-db.mjs asserts the policies behave, and was itself proven
able to fail by loosening a policy and watching it go red. It is not part
of npm test — CI has no database."
```

---

## Task 3: Seed the database from the static content

**Files:**
- Create: `scripts/seed-db.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: schema from Task 1, `@supabase/supabase-js` from Task 2.
- Produces: `npm run db:seed`; a database whose row counts match `src/data/weddingData.js`.

**Context:** the seed is a translation, not a redesign. Two shape changes are required because the schema uses real types where the JavaScript used display strings:

- `date: "November 2024"` → `event_date` as a real `date`. Parse it; if a value cannot be parsed, leave `event_date` null rather than guessing.
- `duration: "4:32 mins"` → `duration_seconds` as an integer. `"4:32 mins"` is 272.

Every image becomes a `media` row first, because `weddings.cover_media_id`, `gallery_photos.media_id` and `films.thumbnail_media_id` are foreign keys. `alt_text` is set from the item's title, which is what the components pass today — Phase 3 improves it.

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-db.mjs`:

```javascript
#!/usr/bin/env node
// Copies src/data/weddingData.js into Postgres. Idempotent: clears content
// tables first, so re-running produces the same result rather than duplicates.
// Run: npm run db:seed

import { createClient } from '@supabase/supabase-js';
import {
  INITIAL_STORIES,
  INITIAL_PHOTOS,
  INITIAL_FILMS,
  TESTIMONIALS,
} from '../src/data/weddingData.js';

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Try: eval "$(supabase status -o env | sed \'s/^/export /')"');
  process.exit(2);
}
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "November 2024" -> 2024-11-01. Unparseable -> null, never a guess.
function toDate(value) {
  if (!value) return null;
  const parsed = Date.parse(`1 ${value}`);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

// "4:32 mins" -> 272. Unparseable -> null.
function toSeconds(value) {
  if (!value) return null;
  const m = /(\d+):(\d+)/.exec(value);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

async function insertMedia(url, altText) {
  const { data, error } = await db
    .from('media')
    .insert({ storage_path: url, alt_text: altText || '' })
    .select('id')
    .single();
  if (error) throw new Error(`media insert failed for ${url}: ${error.message}`);
  return data.id;
}

async function main() {
  // Order matters: children before parents, media last, because of foreign keys.
  for (const t of ['wedding_photos', 'gallery_photos', 'films', 'testimonials', 'weddings']) {
    const { error } = await db.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error && t !== 'wedding_photos') throw new Error(`clearing ${t}: ${error.message}`);
  }
  await db.from('wedding_photos').delete().neq('wedding_id', '00000000-0000-0000-0000-000000000000');
  await db.from('media').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  let n = { media: 0, weddings: 0, wedding_photos: 0, gallery_photos: 0, films: 0, testimonials: 0 };

  for (const [i, story] of INITIAL_STORIES.entries()) {
    const coverId = await insertMedia(story.coverImage, story.title);
    n.media++;
    const { data: wed, error } = await db
      .from('weddings')
      .insert({
        slug: slugify(story.title),
        title: story.title,
        couple: story.couple,
        location: story.location,
        event_date: toDate(story.date),
        summary: story.summary,
        cover_media_id: coverId,
        video_url: story.videoUrl ?? null,
        tags: story.tags ?? [],
        status: 'published',
        sort_order: i,
      })
      .select('id')
      .single();
    if (error) throw new Error(`wedding insert failed for ${story.title}: ${error.message}`);
    n.weddings++;

    for (const [j, img] of (story.fullGallery ?? []).entries()) {
      const mediaId = await insertMedia(img, `${story.title} photograph ${j + 1}`);
      n.media++;
      const { error: linkErr } = await db
        .from('wedding_photos')
        .insert({ wedding_id: wed.id, media_id: mediaId, sort_order: j });
      if (linkErr) throw new Error(`wedding_photos insert failed: ${linkErr.message}`);
      n.wedding_photos++;
    }
  }

  for (const [i, photo] of INITIAL_PHOTOS.entries()) {
    const mediaId = await insertMedia(photo.url, photo.title);
    n.media++;
    const { error } = await db.from('gallery_photos').insert({
      media_id: mediaId,
      title: photo.title,
      category: photo.category,
      couple: photo.couple ?? null,
      location: photo.location ?? null,
      grid_span: photo.span ?? null,
      status: 'published',
      sort_order: i,
    });
    if (error) throw new Error(`gallery_photos insert failed for ${photo.title}: ${error.message}`);
    n.gallery_photos++;
  }

  for (const [i, film] of INITIAL_FILMS.entries()) {
    const thumbId = await insertMedia(film.thumbnail, film.title);
    n.media++;
    const { error } = await db.from('films').insert({
      title: film.title,
      couple: film.couple ?? null,
      location: film.location ?? null,
      duration_seconds: toSeconds(film.duration),
      thumbnail_media_id: thumbId,
      video_embed_url: film.videoEmbedUrl,
      status: 'published',
      sort_order: i,
    });
    if (error) throw new Error(`films insert failed for ${film.title}: ${error.message}`);
    n.films++;
  }

  for (const [i, t] of TESTIMONIALS.entries()) {
    const { error } = await db.from('testimonials').insert({
      quote: t.quote,
      couple: t.couple,
      event: t.event ?? null,
      status: 'published',
      sort_order: i,
    });
    if (error) throw new Error(`testimonials insert failed: ${error.message}`);
    n.testimonials++;
  }

  console.log('seeded:', JSON.stringify(n));
  console.log('source counts:', JSON.stringify({
    stories: INITIAL_STORIES.length,
    photos: INITIAL_PHOTOS.length,
    films: INITIAL_FILMS.length,
    testimonials: TESTIMONIALS.length,
  }));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
```

- [ ] **Step 2: Add the script entry**

```json
    "db:seed": "node scripts/seed-db.mjs",
```

- [ ] **Step 3: Run it against a clean database**

```bash
npm run db:reset
eval "$(supabase status -o env | sed 's/^/export /')"
npm run db:seed; echo "seed=$?"
```

Expected: `seed=0`, and the printed counts must satisfy `weddings === stories`, `gallery_photos === photos`, `films === films`, `testimonials === testimonials`. Record the actual numbers. As of this writing the source has 3 stories, 8 photos, 3 films and 3 testimonials — verify against the file rather than trusting those numbers.

- [ ] **Step 4: Prove it is idempotent**

```bash
npm run db:seed >/dev/null && npm run db:seed
```

Expected: identical counts on the second run. A doubling means the clear step failed and the script would corrupt data on any re-run.

- [ ] **Step 5: Check the two type conversions landed correctly**

```bash
eval "$(supabase status -o env | sed 's/^/export /')"
node -e "
import('@supabase/supabase-js').then(async ({createClient})=>{
  const db=createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  const {data:w}=await db.from('weddings').select('title,event_date').order('sort_order');
  console.log('weddings:',JSON.stringify(w));
  const {data:f}=await db.from('films').select('title,duration_seconds').order('sort_order');
  console.log('films:',JSON.stringify(f));
});
"
```

Expected: every `event_date` is a real date or explicitly `null` — never a string like "November 2024". Every `duration_seconds` is an integer; a film listed as "4:32 mins" must read 272. Report anything that came back null and why.

- [ ] **Step 6: Verify gates and commit**

```bash
npm run lint; echo "lint=$?"
npm test
npm run check:docs; echo "docs=$?"
git status --short
```

```bash
git add scripts/seed-db.mjs package.json
git commit -m "feat: seed the database from the static content file

Translates src/data/weddingData.js into Postgres. Two conversions the
schema requires: 'November 2024' becomes a real date, '4:32 mins'
becomes 272 seconds. Unparseable values become null rather than a guess.

Every image becomes a media row first, since covers and thumbnails are
foreign keys into it.

Idempotent — it clears content tables before inserting, so re-running
does not duplicate."
```

---

## Task 4: Supabase client and the query layer

**Files:**
- Create: `src/lib/supabase.js`
- Create: `src/lib/queries/weddings.js`
- Create: `src/lib/queries/gallery.js`
- Create: `src/lib/queries/films.js`
- Create: `src/lib/queries/testimonials.js`
- Create: `src/lib/queries/__tests__/queries.test.js`
- Modify: `.env.example`

**Interfaces:**
- Consumes: the seeded database.
- Produces, for Task 5:
  - `getPublishedWeddings()` → `Promise<Array<{ id, slug, title, couple, location, eventDate, summary, coverImage, videoUrl, tags, gallery: string[] }>>`
  - `getWeddingBySlug(slug)` → `Promise<object|null>` — same shape
  - `getGalleryPhotos()` → `Promise<Array<{ id, title, url, category, couple, location, span }>>`
  - `getFilms()` → `Promise<Array<{ id, title, couple, location, duration, thumbnail, videoEmbedUrl }>>`
  - `getTestimonials()` → `Promise<Array<{ id, quote, couple, event }>>`

**Context — the shapes above are deliberate.** They match what the components already consume from `weddingData.js`, so Task 5 can swap the source without rewriting any JSX. The query layer is where database column names (`event_date`, `storage_path`, `grid_span`) become the camelCase the components expect. `duration_seconds` is formatted back to a display string here, because `FilmsGallery` renders `film.duration` directly.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/queries/__tests__/queries.test.js`. These mock `../../supabase`, so they need no database and run in CI:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

const { getGalleryPhotos } = await import('../gallery');
const { getFilms } = await import('../films');
const { getTestimonials } = await import('../testimonials');

function selectResult(rows, error = null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => Promise.resolve({ data: rows, error }),
  };
  return chain;
}

beforeEach(() => { mockFrom.mockReset(); });

describe('getGalleryPhotos', () => {
  it('maps database columns to the shape components already use', async () => {
    mockFrom.mockReturnValue(selectResult([
      {
        id: 'p1', title: 'Courtyard Walk', category: 'Royal', couple: 'A & B',
        location: 'Jodhpur', grid_span: 'col-span-1', media: { storage_path: '/images/a.jpg' },
      },
    ]));
    const photos = await getGalleryPhotos();
    expect(photos).toEqual([{
      id: 'p1', title: 'Courtyard Walk', url: '/images/a.jpg', category: 'Royal',
      couple: 'A & B', location: 'Jodhpur', span: 'col-span-1',
    }]);
  });

  it('throws with a useful message when the query errors', async () => {
    mockFrom.mockReturnValue(selectResult(null, { message: 'permission denied' }));
    await expect(getGalleryPhotos()).rejects.toThrow(/permission denied/);
  });
});

describe('getFilms', () => {
  it('formats duration_seconds back into the display string components render', async () => {
    mockFrom.mockReturnValue(selectResult([
      {
        id: 'f1', title: 'The Palace Symphony', couple: 'A & B', location: 'Jodhpur',
        duration_seconds: 272, video_embed_url: 'https://example.com/embed',
        thumbnail: { storage_path: '/images/t.jpg' },
      },
    ]));
    const films = await getFilms();
    expect(films[0].duration).toBe('4:32 mins');
    expect(films[0].thumbnail).toBe('/images/t.jpg');
  });

  it('leaves duration empty when the database has no value', async () => {
    mockFrom.mockReturnValue(selectResult([
      { id: 'f2', title: 'x', duration_seconds: null, video_embed_url: 'u', thumbnail: null },
    ]));
    const films = await getFilms();
    expect(films[0].duration).toBe('');
  });
});

describe('getTestimonials', () => {
  it('returns the quote, couple and event', async () => {
    mockFrom.mockReturnValue(selectResult([
      { id: 't1', quote: 'A fictional quote.', couple: 'Test Couple', event: 'Test Event' },
    ]));
    expect(await getTestimonials()).toEqual([
      { id: 't1', quote: 'A fictional quote.', couple: 'Test Couple', event: 'Test Event' },
    ]);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm test`

Expected: FAIL — the modules under `src/lib/queries/` do not exist.

- [ ] **Step 3: Create the client singleton**

Create `src/lib/supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

// The anon key is public by design: it ships in the browser bundle, and Row
// Level Security in Postgres — not this file — is what constrains it.
// See supabase/migrations/*_row_level_security.sql.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
```

- [ ] **Step 4: Create the query modules**

`src/lib/queries/gallery.js`:

```javascript
import { supabase } from '../supabase';

export async function getGalleryPhotos() {
  const { data, error } = await supabase
    .from('gallery_photos')
    .select('id, title, category, couple, location, grid_span, media:media_id (storage_path)')
    .eq('status', 'published')
    .order('sort_order');

  if (error) throw new Error(`getGalleryPhotos: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    url: row.media?.storage_path ?? '',
    category: row.category,
    couple: row.couple,
    location: row.location,
    span: row.grid_span,
  }));
}
```

`src/lib/queries/films.js`:

```javascript
import { supabase } from '../supabase';

// The database stores an integer; FilmsGallery renders film.duration directly,
// so the display string is rebuilt here rather than in the component.
function formatDuration(seconds) {
  if (seconds == null) return '';
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs} mins`;
}

export async function getFilms() {
  const { data, error } = await supabase
    .from('films')
    .select('id, title, couple, location, duration_seconds, video_embed_url, thumbnail:thumbnail_media_id (storage_path)')
    .eq('status', 'published')
    .order('sort_order');

  if (error) throw new Error(`getFilms: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    couple: row.couple,
    location: row.location,
    duration: formatDuration(row.duration_seconds),
    thumbnail: row.thumbnail?.storage_path ?? '',
    videoEmbedUrl: row.video_embed_url,
  }));
}
```

`src/lib/queries/testimonials.js`:

```javascript
import { supabase } from '../supabase';

export async function getTestimonials() {
  const { data, error } = await supabase
    .from('testimonials')
    .select('id, quote, couple, event')
    .eq('status', 'published')
    .order('sort_order');

  if (error) throw new Error(`getTestimonials: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    quote: row.quote,
    couple: row.couple,
    event: row.event,
  }));
}
```

`src/lib/queries/weddings.js`:

```javascript
import { supabase } from '../supabase';

const WEDDING_SELECT = `
  id, slug, title, couple, location, event_date, summary, video_url, tags,
  cover:cover_media_id (storage_path),
  wedding_photos (sort_order, media:media_id (storage_path))
`;

function toWedding(row) {
  const gallery = (row.wedding_photos ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((wp) => wp.media?.storage_path)
    .filter(Boolean);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    couple: row.couple,
    location: row.location,
    eventDate: row.event_date,
    summary: row.summary,
    coverImage: row.cover?.storage_path ?? '',
    videoUrl: row.video_url,
    tags: row.tags ?? [],
    gallery,
  };
}

export async function getPublishedWeddings() {
  const { data, error } = await supabase
    .from('weddings')
    .select(WEDDING_SELECT)
    .eq('status', 'published')
    .order('sort_order');

  if (error) throw new Error(`getPublishedWeddings: ${error.message}`);
  return (data ?? []).map(toWedding);
}

export async function getWeddingBySlug(slug) {
  const { data, error } = await supabase
    .from('weddings')
    .select(WEDDING_SELECT)
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(`getWeddingBySlug(${slug}): ${error.message}`);
  return data ? toWedding(data) : null;
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test`

Expected: all pass — the 14 from earlier phases plus the 5 added here, 19 total.

- [ ] **Step 6: Document the environment variables**

`.env.example` already lists `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_DATA_SOURCE`. Confirm the names match exactly what `src/lib/supabase.js` reads, and correct `.env.example` if they differ. Do not add real values.

- [ ] **Step 7: Verify gates and commit**

```bash
npm run lint; echo "lint=$?"
npm test
npm run check:docs; echo "docs=$?"
git status --short
```

```bash
git add src/lib package.json package-lock.json .env.example
git commit -m "feat: add the Supabase client and query layer

src/lib/supabase.js is the only module that constructs a client. Query
modules translate database columns into the shapes the components
already consume, so wiring them up needs no JSX changes: event_date
becomes eventDate, storage_path becomes url, and duration_seconds is
formatted back to the '4:32 mins' string FilmsGallery renders.

Tests mock the client, so they need no database and run in CI."
```

---

## Task 5: Hooks, the data-source switch, and wiring the components

**Files:**
- Create: `src/lib/dataSource.js`
- Create: `src/hooks/useContent.js`
- Create: `src/hooks/__tests__/useContent.test.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: the query functions from Task 4.
- Produces: `useWeddings()`, `useGalleryPhotos()`, `useFilms()`, `useTestimonials()`, each returning `{ data, loading, error }`.

**Context:** `src/App.jsx` currently imports the four collections directly and holds `stories` and `photos` in state persisted to `localStorage`. This task routes content through hooks instead. The `VITE_DATA_SOURCE` flag decides where the data comes from:

- `static` (the default): the hooks resolve immediately from `src/data/weddingData.js`, exactly as today.
- `supabase`: the hooks call the query layer.

Keeping `static` as the default means the site behaves identically for anyone who has not configured Supabase, and gives a one-variable rollback if the database misbehaves. Per the spec this flag is temporary and is removed in Phase 3.

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/__tests__/useContent.test.jsx`:

```jsx
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getGalleryPhotos = vi.fn();
vi.mock('../../lib/queries/gallery', () => ({ getGalleryPhotos: (...a) => getGalleryPhotos(...a) }));
vi.mock('../../lib/queries/weddings', () => ({ getPublishedWeddings: vi.fn(), getWeddingBySlug: vi.fn() }));
vi.mock('../../lib/queries/films', () => ({ getFilms: vi.fn() }));
vi.mock('../../lib/queries/testimonials', () => ({ getTestimonials: vi.fn() }));

const { useGalleryPhotos } = await import('../useContent');

beforeEach(() => { getGalleryPhotos.mockReset(); });

describe('useGalleryPhotos', () => {
  it('starts loading, then resolves with data', async () => {
    getGalleryPhotos.mockResolvedValue([{ id: 'p1', title: 'One' }]);
    const { result } = renderHook(() => useGalleryPhotos('supabase'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 'p1', title: 'One' }]);
    expect(result.current.error).toBeNull();
  });

  it('exposes the error and stops loading when the query rejects', async () => {
    getGalleryPhotos.mockRejectedValue(new Error('permission denied'));
    const { result } = renderHook(() => useGalleryPhotos('supabase'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/permission denied/);
    expect(result.current.data).toEqual([]);
  });

  it('uses the static file without touching the query layer', async () => {
    const { result } = renderHook(() => useGalleryPhotos('static'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getGalleryPhotos).not.toHaveBeenCalled();
    expect(result.current.data.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm test`

Expected: FAIL — `../useContent` does not exist.

- [ ] **Step 3: Create the data-source switch**

Create `src/lib/dataSource.js`:

```javascript
import { isSupabaseConfigured } from './supabase';

// Temporary migration scaffolding (spec section 5.5). Removed in Phase 3,
// once the database is authoritative.
//
// 'static'   read content from src/data/weddingData.js
// 'supabase' read content from the database
//
// Asking for 'supabase' without credentials would leave the client null and
// crash on the first query, so an unconfigured environment stays on 'static'.
const requested = import.meta.env.VITE_DATA_SOURCE;

export const DATA_SOURCE =
  requested === 'supabase' && isSupabaseConfigured ? 'supabase' : 'static';
```

- [ ] **Step 4: Create the hooks**

Create `src/hooks/useContent.js`:

```javascript
import { useEffect, useState } from 'react';
import {
  INITIAL_STORIES,
  INITIAL_PHOTOS,
  INITIAL_FILMS,
  TESTIMONIALS,
} from '../data/weddingData';
import { DATA_SOURCE } from '../lib/dataSource';
import { getPublishedWeddings } from '../lib/queries/weddings';
import { getGalleryPhotos } from '../lib/queries/gallery';
import { getFilms } from '../lib/queries/films';
import { getTestimonials } from '../lib/queries/testimonials';

// One implementation, four thin wrappers. `source` is injectable so tests can
// exercise both paths without touching import.meta.env.
function useContent(staticData, query, source) {
  const [state, setState] = useState({ data: staticData, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    if (source !== 'supabase') {
      setState({ data: staticData, loading: false, error: null });
      return () => { cancelled = true; };
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    query()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        // Fall back to the static content rather than rendering an empty page.
        if (!cancelled) setState({ data: [], loading: false, error: err.message });
      });

    return () => { cancelled = true; };
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

export const useWeddings = (source = DATA_SOURCE) =>
  useContent(INITIAL_STORIES, getPublishedWeddings, source);

export const useGalleryPhotos = (source = DATA_SOURCE) =>
  useContent(INITIAL_PHOTOS, getGalleryPhotos, source);

export const useFilms = (source = DATA_SOURCE) =>
  useContent(INITIAL_FILMS, getFilms, source);

export const useTestimonials = (source = DATA_SOURCE) =>
  useContent(TESTIMONIALS, getTestimonials, source);
```

Note the single `eslint-disable-line` for `exhaustive-deps`: `staticData` and `query` are module-level constants that never change identity, and listing them would add noise without changing behaviour. This is the only disable permitted in this phase, and it carries this justification.

- [ ] **Step 5: Run the tests**

Run: `npm test`

Expected: all pass — 19 from Task 4 plus the 3 added here, 22 total.

- [ ] **Step 6: Wire `src/App.jsx`**

Replace the direct imports of `INITIAL_STORIES`, `INITIAL_PHOTOS`, `INITIAL_FILMS` and `TESTIMONIALS` with the hooks. Keep every other behaviour intact — the modals, the lightbox, the splash screen and the `user` session all stay exactly as they are.

Two constraints on this edit:
- **`stories` and `photos` keep their `localStorage` persistence when `DATA_SOURCE` is `static`**, so the Content Manager keeps working as it does today. When the source is `supabase`, the database is authoritative and the effects that write those two keys must not run.
- `FILM_STRIP_FRAMES` and `EDITORIAL_GALLERY` are consumed inside `FilmStrip` and `HorizontalGallery`, not through `App.jsx`. Leave both untouched.

The `stories`/`photos` state is the subtle part, so here is the exact shape. Today `App.jsx` has, for each of the two:

```jsx
const [stories, setStories] = useState(() => {
  try {
    const saved = localStorage.getItem('peak_story_stories');
    return saved ? JSON.parse(saved) : INITIAL_STORIES;
  } catch {
    return INITIAL_STORIES;
  }
});

useEffect(() => {
  localStorage.setItem('peak_story_stories', JSON.stringify(stories));
}, [stories]);
```

It becomes:

```jsx
const { data: weddingData, loading: storiesLoading, error: storiesError } = useWeddings();

const [localStories, setLocalStories] = useState(() => {
  try {
    const saved = localStorage.getItem('peak_story_stories');
    return saved ? JSON.parse(saved) : INITIAL_STORIES;
  } catch {
    return INITIAL_STORIES;
  }
});

// The database is authoritative when it is the source; localStorage is only
// the Content Manager's store for the static path.
const stories = DATA_SOURCE === 'supabase' ? weddingData : localStories;
const setStories = setLocalStories;

useEffect(() => {
  if (DATA_SOURCE === 'supabase') return;
  localStorage.setItem('peak_story_stories', JSON.stringify(localStories));
}, [localStories]);
```

Apply the same shape to `photos` with `useGalleryPhotos()` and the `peak_story_photos` key. `films` and `testimonials` have no local state today — replace their direct imports with `useFilms()` and `useTestimonials()` and pass `.data` to the components.

Import `DATA_SOURCE` from `../lib/dataSource` and keep the `INITIAL_STORIES`/`INITIAL_PHOTOS` imports, which the localStorage initialisers still need.

- [ ] **Step 7: Verify both data sources render identically**

This is the real test of the phase, and it must be automated: `npm run dev` never exits, so running it in the foreground stalls. Start it detached, poll the port, drive it headlessly with the Playwright already installed in Phase 1a, then compare.

Write this throwaway comparison script to `/tmp/compare-sources.mjs`:

```javascript
import { chromium } from 'playwright';

const outPath = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 2400 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4000); // splash screen runs ~2.5s

const snapshot = await page.evaluate(() => {
  const textsUnder = (id, sel) =>
    [...(document.querySelector(id)?.querySelectorAll(sel) ?? [])]
      .map((n) => n.textContent.trim()).filter(Boolean);
  return {
    storyTitles: textsUnder('#stories', 'h3'),
    filmTitles: textsUnder('#films', 'h3'),
    galleryImageCount: document.querySelectorAll('#gallery img').length,
    storyImageCount: document.querySelectorAll('#stories img').length,
    filmImageCount: document.querySelectorAll('#films img').length,
    testimonialQuote: document.querySelector('section blockquote, section p.italic')?.textContent?.trim() ?? '',
    bodyTextLength: document.body.innerText.length,
  };
});

const fs = await import('node:fs');
fs.writeFileSync(outPath, JSON.stringify({ snapshot, errors }, null, 2));
console.log(outPath, 'written');
await browser.close();
```

Run it against each source in turn:

```bash
# --- static (reference) ---
rm -f .env.local
nohup npm run dev > /tmp/dev-static.log 2>&1 &
until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done
node /tmp/compare-sources.mjs /tmp/snap-static.json
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill

# --- supabase ---
eval "$(supabase status -o env | sed 's/^/export /')"
printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_ANON_KEY=%s\nVITE_DATA_SOURCE=supabase\n' \
  "$API_URL" "$ANON_KEY" > .env.local
nohup npm run dev > /tmp/dev-supabase.log 2>&1 &
until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done
node /tmp/compare-sources.mjs /tmp/snap-supabase.json
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill

# --- compare ---
node -e "
const a=require('/tmp/snap-static.json'), b=require('/tmp/snap-supabase.json');
console.log('static  :', JSON.stringify(a.snapshot));
console.log('supabase:', JSON.stringify(b.snapshot));
console.log('static errors  :', a.errors);
console.log('supabase errors:', b.errors);
const same=JSON.stringify(a.snapshot)===JSON.stringify(b.snapshot);
console.log(same?'IDENTICAL':'DIFFERENT — investigate');
"
```

Both snapshots must match and both error arrays must be empty. Paste both snapshots into your report verbatim.

**A difference here is a real defect in a query shape, not something to paper over.** Do not edit a component to make the comparison pass — report the difference and stop.

Note the environment variable names `supabase status -o env` emits may not be `API_URL`/`ANON_KEY`; check and substitute the real ones.

Then confirm the key file is ignored and clean up:
```bash
git check-ignore -v .env.local && echo "env ignored"
rm -f /tmp/compare-sources.mjs /tmp/snap-*.json /tmp/dev-*.log
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill 2>/dev/null || true
```

- [ ] **Step 8: Verify gates and commit**

```bash
npm run lint; echo "lint=$?"
npm test
npm run check:docs; echo "docs=$?"
git status --short
```

`.env.local` must NOT appear in `git status`.

```bash
git add src/lib/dataSource.js src/hooks/useContent.js src/hooks/__tests__/useContent.test.jsx src/App.jsx
git commit -m "feat: read content through hooks instead of the static import

Components now consume content via hooks, hooks call queries, queries
call Supabase — no component imports the client.

VITE_DATA_SOURCE selects the source and defaults to 'static', so the
site behaves identically without a database and the flag is a
one-variable rollback during the migration. It is temporary scaffolding
and is removed in Phase 3.

localStorage persistence is kept for the static path so the Content
Manager still works, and skipped when the database is authoritative."
```

---

## Task 6: Documentation, the deferred collections, and phase verification

**Files:**
- Modify: `docs/DATA-MODEL.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/KNOWN-ISSUES.md`
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: a documented, tagged `v0.2b`.

- [ ] **Step 1: Update `docs/DATA-MODEL.md`**

It currently describes a data model that lives entirely in a JavaScript file. Add a section covering the database: the eight tables, the two type conversions the seed performs, and the fact that `weddingData.js` is now a fallback rather than the source of truth when `VITE_DATA_SOURCE=supabase`. Keep the existing description of the static shapes — the static path still exists.

- [ ] **Step 2: Update `docs/ARCHITECTURE.md`**

Its "Data flow today" section says there is no network layer at all. That is no longer true. Describe the layering — components → hooks → queries → Supabase — and the `VITE_DATA_SOURCE` switch. Its "State ownership" table must reflect that `stories` and `photos` no longer come from a direct import.

- [ ] **Step 3: File the deferred collections**

`FILM_STRIP_FRAMES` and `EDITORIAL_GALLERY` have no table and stay static. Add a row to `docs/KNOWN-ISSUES.md` using the next free `PS-` id — check the highest existing one rather than assuming — severity Low, planned phase 3, noting that both are decorative strips whose editing story only matters once the CMS exists, and that migrating them needs a schema decision that the approved spec does not cover.

- [ ] **Step 4: Update the developer docs**

- `README.md`: add the database commands (`db:start`, `db:stop`, `db:reset`, `db:seed`, `db:verify`) to the Scripts table, and a short "Local database" section explaining that Docker must be running, that `supabase start` prints the keys, and that `.env.local` is where they go. State plainly that `db:verify` is not part of `npm test` because CI has no database.
- `CLAUDE.md`: record the layering rule as a convention — components never import the Supabase client; they call hooks, which call queries. Note that schema changes go only through `supabase/migrations/`.

- [ ] **Step 5: Full phase verification**

```bash
npm run lint; echo "lint=$?"
npm test
npm run check:docs; echo "docs=$?"
npm run db:reset && eval "$(supabase status -o env | sed 's/^/export /')" && npm run db:seed && npm run db:verify; echo "db=$?"
git status --short
```

Expected: all zero, tests passing, and a clean tree. This is the first run that proves the whole chain from an empty database: migrations apply, seed populates, policies hold.

- [ ] **Step 6: Confirm no key was committed**

```bash
git log -p ae21ca9..HEAD | grep -inE "eyJ[A-Za-z0-9_-]{20,}|service_role" | head -5 || echo "no JWT-shaped strings in this phase's commits"
git ls-files | grep -E "^\.env" || echo "only .env.example tracked"
```

Local Supabase keys are the same well-known demo values on every machine, but they still must not be committed. If anything appears, stop and report it.

- [ ] **Step 7: Commit and tag**

```bash
git add docs README.md CLAUDE.md
git commit -m "docs: document the database layer and defer two collections

Records the eight tables, the seed's two type conversions, and the
components-to-hooks-to-queries layering. Files the two decorative
collections that have no table in the approved schema."
```

```bash
git tag -a v0.2b -m "v0.2b — Phase 1b: backend foundation

Local Supabase, eight tables, row level security proven by a verifier
that was itself shown able to fail, a seed from the static content, and
a data-access layer components reach through hooks.

VITE_DATA_SOURCE defaults to 'static', so the site runs unchanged
without a database."
git tag -n3 v0.2b
```

- [ ] **Step 8: Report**

Summarise for the maintainer: the tables created, the row counts seeded, the RLS checks that passed, and the fact that both data paths were rendered and compared. State explicitly that nothing is pushed and no hosted Supabase project exists yet — that is Phase 4.

---

## Notes for the executor

- **Docker must be running** before any `supabase` command. If `supabase start` cannot reach the daemon, report BLOCKED rather than working around it.
- **Never edit the database directly.** Every schema change is a new migration file. `npm run db:reset` replaying from empty is the proof that the migrations are complete.
- **`npm test` must never need a database.** If you find yourself wanting a real connection in a Vitest file, the test belongs in `scripts/verify-db.mjs` instead.
- **One `eslint-disable` is permitted in this phase**, in `src/hooks/useContent.js`, with the justification given in Task 5 Step 4. Any other disable is a finding.
- **Local Supabase keys are not secret but are still not committed.** They go in `.env.local`, which `.gitignore` covers via `.env*`.
- **Task 5 Step 7 is the real test of this phase.** Rendering both data sources and comparing them is what proves the query shapes are right; the unit tests only prove the mapping code does what it says.
- **Nothing is pushed in this phase**, and no hosted Supabase project is created. Deployment is Phase 4.
