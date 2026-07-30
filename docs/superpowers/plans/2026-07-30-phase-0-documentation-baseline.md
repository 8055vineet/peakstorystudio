# Phase 0 (v0.1) — Documentation Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document the existing Peak Story Studio frontend so a new engineer can run and understand it from the docs alone, and fix the repository hygiene problems that would leak secrets in Phase 1.

**Architecture:** Documentation-only phase. No component behaviour changes. A Node script (`scripts/check-docs.mjs`, zero dependencies) acts as the test harness: it verifies every component is documented, every cited source path exists, and every internal link resolves. Each documentation task is gated by that script rather than by unit tests, because the deliverables are prose.

**Tech Stack:** Markdown, Node 20+ built-ins only (`node:fs`, `node:path`). No new runtime dependencies.

## Global Constraints

- **No component behaviour changes.** The only non-documentation edits permitted in this phase are `.gitignore`, `.env.example`, `package.json`, and the new `scripts/` directory. Source files under `src/` must not be modified.
- **No placeholders in deliverables.** No "TBD", no "coming soon". If a fact is unknown, verify it against the code before writing.
- **All facts must be verified against the code**, not recalled. Counts, token names, and file paths in this plan were verified on 2026-07-30 against commit `8ef6d5e`.
- **Verified project facts** (use these exact values):
  - 23 components in `src/components/`, 1 hook in `src/hooks/`, 1 data module in `src/data/`
  - 3 localStorage keys: `peak_story_stories`, `peak_story_photos`, `peak_story_user`
  - Dev server port: `3000`, with `open: true` (`vite.config.js`)
  - Runtime dependencies: `react`, `react-dom`, `lucide-react`, `canvas-confetti`
  - Fonts loaded via Google Fonts in `index.html`: Cinzel, Cormorant Garamond, Plus Jakarta Sans
- **Convention for prose deliverables:** each documentation task specifies the exact file path, the required headings, and the specific facts that must appear. The implementer writes the prose; the plan fixes the structure and the facts so nothing is invented.
- **Commit after every task.** Conventional Commits format (`docs:`, `chore:`, `test:`).
- **Branch:** `phase-0/documentation-baseline` (already exists, currently at `89a8a12`).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `.gitignore` (modify) | Ignore all `.env*` variants, not just `.env` |
| `.env.example` (create) | Document required environment variables without values |
| `package.json` (modify) | Declare `playwright` as a devDependency; add `check:docs` script |
| `scripts/check-docs.mjs` (create) | Documentation integrity harness — the test gate for this phase |
| `README.md` (create) | Entry point: what it is, quickstart, scripts, layout |
| `CLAUDE.md` (create) | Conventions for future agent sessions |
| `docs/ARCHITECTURE.md` (create) | App shell, render flow, state ownership, styling approach |
| `docs/COMPONENTS.md` (create) | Inventory of all 23 components |
| `docs/DATA-MODEL.md` (create) | Current content shapes and localStorage contract |
| `docs/DESIGN-SYSTEM.md` (create) | Palette, type, animation catalogue, dead-code inventory |
| `docs/ROADMAP.md` (create) | Phase/version table from the spec |
| `docs/KNOWN-ISSUES.md` (create) | Open audit findings with severity |
| `docs/adr/000{1..5}-*.md` (create) | Architecture decision records |

**Task ordering rationale:** documentation that only cites `src/` paths is written first; `README.md` and `CLAUDE.md` come near the end because they link to the other documents, which must exist first for the link checker to pass.

---

## Task 1: Repository hygiene

Fixes the secret-leak risk before Phase 1 creates any key, and makes the dependency tree honest.

**Files:**
- Modify: `.gitignore`
- Create: `.env.example`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `npm run check:docs` script name, used by every later task

**Context the implementer needs:** `playwright` is currently present in `node_modules` but absent from `package.json` — it was installed with `--no-save` during an earlier screenshot session. A fresh `npm ci` would therefore not install it, but the Phase 2 end-to-end test depends on it. Declaring it now makes the tree reproducible.

- [ ] **Step 1: Verify the secret-leak bug exists**

Run:
```bash
cd "/Users/vineetpatel/Projects/Peak Story Studio"
printf 'SECRET=leaked\n' > .env.local
git check-ignore -v .env.local || echo "NOT IGNORED — bug confirmed"
```

Expected: prints `NOT IGNORED — bug confirmed`. `.gitignore` lists `.env` exactly, which does not match `.env.local`.

- [ ] **Step 2: Fix `.gitignore`**

Change the line `.env` to `.env*`, then add an exception so the example file stays tracked. The file becomes:

```gitignore
node_modules/
dist/
.env*
!.env.example
.DS_Store
```

- [ ] **Step 3: Verify the fix**

Run:
```bash
git check-ignore -v .env.local && echo "IGNORED — fixed"
rm .env.local
```

Expected: prints a `.gitignore:3:.env*` match followed by `IGNORED — fixed`.

- [ ] **Step 4: Create `.env.example`**

```bash
# Peak Story Studio — environment variables
# Copy to .env.local and fill in. Never commit .env.local.

# Phase 1 onward: Supabase project credentials.
# Safe to expose in the browser bundle — Row Level Security enforces access.
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Phase 1 only: temporary migration switch. Remove in Phase 3.
# static   = read content from src/data/weddingData.js
# supabase = read content from the database
VITE_DATA_SOURCE=static
```

- [ ] **Step 5: Declare `playwright` and add the `check:docs` script**

In `package.json`, add `"check:docs": "node scripts/check-docs.mjs"` to `scripts`, and add `"playwright": "^1.62.0"` to `devDependencies` in alphabetical position.

Leave the existing `"lint": "vite build"` untouched. It is wrong, but replacing it with a real ESLint config is a Phase 1 quality-gate task; changing it here would exceed this phase's scope. It is recorded in `KNOWN-ISSUES.md` in Task 7.

- [ ] **Step 6: Verify the dependency tree is reproducible**

Run:
```bash
npm install
npm ls playwright --depth=0
npm run build
```

Expected: `npm ls` shows `playwright@1.62.x` without an `(empty)` or missing marker, and the build succeeds with `✓ built in` in the output.

- [ ] **Step 7: Confirm no secret was staged**

Run:
```bash
git status --short
git diff --cached
```

Expected: `.env.local` does not appear anywhere. Only `.gitignore`, `.env.example`, `package.json`, and `package-lock.json` are changed.

- [ ] **Step 8: Commit**

```bash
git add .gitignore .env.example package.json package-lock.json
git commit -m "chore: ignore all .env variants and declare playwright dependency

.gitignore listed '.env' exactly, which does not match '.env.local' — the
file Phase 1 will put Supabase keys in. Now '.env*' with an exception for
.env.example.

playwright was present in node_modules but absent from package.json after
an earlier --no-save install, so 'npm ci' would not have installed it. The
Phase 2 inquiry E2E test depends on it."
```

---

## Task 2: Documentation integrity harness

The test gate for every later task in this phase.

**Files:**
- Create: `scripts/check-docs.mjs`

**Interfaces:**
- Consumes: `check:docs` npm script from Task 1
- Produces: `npm run check:docs`, exit code 0 on success and 1 on failure, used by Tasks 3–11

**Context the implementer needs:** documentation rots when it drifts from code. This script makes drift a build failure. It uses only Node built-ins so it adds no dependency. `import.meta.dirname` requires Node 20.11 or newer.

- [ ] **Step 1: Write the harness**

Create `scripts/check-docs.mjs`:

```javascript
#!/usr/bin/env node
// Verifies the docs stay consistent with the codebase.
// Run: npm run check:docs
//
// Checks:
//   1. every required doc exists
//   2. every component in src/components is mentioned in docs/COMPONENTS.md
//   3. every src/... path cited in any doc actually exists
//   4. every relative markdown link resolves

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const errors = [];
const fail = (msg) => errors.push(msg);

const REQUIRED_DOCS = [
  'README.md',
  'CLAUDE.md',
  'docs/ARCHITECTURE.md',
  'docs/COMPONENTS.md',
  'docs/DATA-MODEL.md',
  'docs/DESIGN-SYSTEM.md',
  'docs/ROADMAP.md',
  'docs/KNOWN-ISSUES.md',
];

for (const doc of REQUIRED_DOCS) {
  if (!existsSync(join(ROOT, doc))) fail(`missing required doc: ${doc}`);
}

function walkMarkdown(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(full, out);
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const markdownFiles = [
  ...['README.md', 'CLAUDE.md'].map((f) => join(ROOT, f)).filter((f) => existsSync(f)),
  ...walkMarkdown(join(ROOT, 'docs')),
];

// Check 2: every component documented
const componentsDoc = join(ROOT, 'docs/COMPONENTS.md');
if (existsSync(componentsDoc)) {
  const text = readFileSync(componentsDoc, 'utf8');
  const components = readdirSync(join(ROOT, 'src/components'))
    .filter((f) => f.endsWith('.jsx'))
    .map((f) => f.replace(/\.jsx$/, ''));
  for (const name of components) {
    if (!text.includes(name)) fail(`COMPONENTS.md does not document: ${name}`);
  }
}

// Check 3: cited source paths exist
const SRC_PATH = /\b(src\/[A-Za-z0-9_\-./]+\.(?:jsx?|css))/g;
for (const file of markdownFiles) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(SRC_PATH)) {
    if (!existsSync(join(ROOT, match[1]))) {
      fail(`${relative(ROOT, file)} cites a missing source path: ${match[1]}`);
    }
  }
}

// Check 4: relative markdown links resolve
const MD_LINK = /\[[^\]]*\]\(([^)]+)\)/g;
for (const file of markdownFiles) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(MD_LINK)) {
    const raw = match[1].trim();
    if (/^(https?:|mailto:|tel:|#)/.test(raw)) continue;
    const target = raw.split('#')[0];
    if (!target) continue;
    if (!existsSync(resolve(dirname(file), target))) {
      fail(`${relative(ROOT, file)} has a broken link: ${raw}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`check:docs FAILED — ${errors.length} problem(s)`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`check:docs passed — ${markdownFiles.length} markdown file(s) checked`);
```

- [ ] **Step 2: Run it and confirm it fails correctly**

Run: `npm run check:docs`

Expected: exit code 1, and output listing exactly 8 `missing required doc:` errors — one per entry in `REQUIRED_DOCS`. This failure is correct: none of the documents exist yet. Each later task reduces this count.

Verify the exit code:
```bash
npm run check:docs; echo "exit=$?"
```
Expected: `exit=1`.

- [ ] **Step 3: Prove check 3 catches a bad path**

Temporarily append a deliberately wrong path to the spec, run the checker, then revert:

```bash
printf '\nBogus reference to src/components/DoesNotExist.jsx\n' >> docs/superpowers/specs/2026-07-30-end-to-end-platform-design.md
npm run check:docs 2>&1 | grep "DoesNotExist" && echo "check 3 works"
git checkout -- docs/superpowers/specs/2026-07-30-end-to-end-platform-design.md
```

Expected: prints a `cites a missing source path` line for `DoesNotExist.jsx`, then `check 3 works`. Confirm the revert with `git status --short` showing the spec unmodified.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-docs.mjs
git commit -m "test: add documentation integrity harness

Zero-dependency Node script gating the Phase 0 docs: verifies required
docs exist, every component is documented, cited src/ paths resolve, and
internal links are not broken. Currently fails with 8 missing docs, which
is expected — Tasks 3-10 bring it to green."
```

---

## Task 3: `docs/ARCHITECTURE.md`

**Files:**
- Create: `docs/ARCHITECTURE.md`

**Interfaces:**
- Consumes: `npm run check:docs`
- Produces: the architecture reference that `README.md` (Task 9) and `CLAUDE.md` (Task 10) link to

**Required headings and the facts each must state:**

1. `## Overview` — Vite + React 18 SPA, Tailwind for styling, no router, no backend, no tests. Single page composed of stacked sections.
2. `## Render flow` — `index.html` → `src/main.jsx` (mounts into `#root` inside `React.StrictMode`) → `src/App.jsx`. State that `App.jsx` is the single stateful shell and everything below it is presentational apart from local UI state.
3. `## State ownership` — table of the 8 state values in `src/App.jsx`: `stories`, `photos`, `user`, `lightboxState`, `videoModalUrl`, `contentManagerOpen`, `authModalOpen`, `clientGalleryOpen`, `splashDone`. For each: what it holds, whether it persists to localStorage, and which components consume it. Note explicitly that modal visibility is 6 independent values with no mutual exclusion, so two modals can be open simultaneously, ordered only by ad hoc z-index (`z-50` vs `z-[100]`).
4. `## Section order` — the render order inside `<main>` in `src/App.jsx`: Hero, FeaturedStories, FilmsGallery, ColorGradingSlider, HorizontalGallery, PhotoGallery, FilmStrip, AboutSection, Testimonials, BookingForm, with `SectionDivider` between several. Note that divider colours are passed as raw hex strings that duplicate Tailwind tokens.
5. `## Styling approach` — Tailwind utilities inline, with `src/index.css` holding a custom layer (paper-grain body overlay, scrollbar styling, keyframes, image and scroll helpers). Point to `docs/DESIGN-SYSTEM.md` for the token and animation catalogue.
6. `## Data flow today` — content is imported directly from `src/data/weddingData.js`; user-added content is written to localStorage and merged in `App.jsx`. State that there is no network layer at all, and link to the platform spec for where it is going.
7. `## Known architectural limits` — no routing (so no shareable or indexable URLs), no error boundary, three independent scroll listeners (`src/components/Navbar.jsx`, `src/components/ScrollProgressBar.jsx`, `src/components/Hero.jsx`) of which only Hero's is passive. Link to `docs/KNOWN-ISSUES.md`.

- [ ] **Step 1: Write `docs/ARCHITECTURE.md`** covering the seven sections above. Verify every claim against the source before writing it. Cite files as inline code paths, for example `src/App.jsx`.

- [ ] **Step 2: Verify**

Run: `npm run check:docs`

Expected: exit 1, but the error list is now 7 `missing required doc:` entries — `docs/ARCHITECTURE.md` is gone from the list. Confirm no `cites a missing source path` and no `broken link` errors appear; if any do, the document references a path that does not exist and must be corrected.

- [ ] **Step 3: Verify state count against the code**

Run:
```bash
grep -c "useState" src/App.jsx
```
Expected: `9`. The document must account for all of them (the 8 named above plus `splashDone`; confirm the exact set and correct the document if the grep disagrees).

- [ ] **Step 4: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: document application architecture"
```

---

## Task 4: `docs/COMPONENTS.md`

**Files:**
- Create: `docs/COMPONENTS.md`

**Interfaces:**
- Consumes: `npm run check:docs`
- Produces: the component inventory; check 2 of the harness asserts all 23 are present

**Required structure:** a `## Component inventory` table with one row per component file in `src/components/`, columns: **Component**, **Purpose** (one line), **Props**, **Local state**, **Notable dependencies**. All 23 must appear, spelled exactly as the filename without extension:

`AboutSection`, `AnimatedCounter`, `AuthModal`, `BookingForm`, `ClientGalleryModal`, `ColorGradingSlider`, `ContentManagerModal`, `CustomCursor`, `FeaturedStories`, `FilmStrip`, `FilmsGallery`, `Footer`, `Hero`, `HorizontalGallery`, `LightboxModal`, `Navbar`, `PhotoGallery`, `ScrollProgressBar`, `ScrollReveal`, `SectionDivider`, `SplashScreen`, `StoryDetailModal`, `Testimonials`

Then these additional sections:

- `## Hooks` — `src/hooks/useScrollReveal.js`: IntersectionObserver-based one-shot reveal, returns `{ ref, isVisible }`, unobserves after first intersection.
- `## Shared patterns` — record that `ScrollReveal` wraps sections for entrance animation, and that `data-cursor` attributes drive the `CustomCursor` label (grep `data-cursor` to list which components set it).
- `## Duplication to consolidate` — the repeated pill-button and badge markup. Name the files that carry near-identical class strings and state that a shared `Button`/`Badge` component is the fix. Cross-reference `docs/KNOWN-ISSUES.md`.
- `## Components with hardcoded data` — `FilmStrip` and `HorizontalGallery` each define their own image arrays inline rather than reading `src/data/weddingData.js`, so the content manager cannot reach them.

- [ ] **Step 1: Enumerate components and their props from source**

Run:
```bash
ls src/components/*.jsx | wc -l
grep -n "^export default function" src/components/*.jsx
grep -rn "data-cursor=" src/components/ | sed 's/:.*data-cursor=/ -> /'
```

Expected: the count is `23`. Use the second command's output for exact prop lists, and the third to fill the `data-cursor` inventory.

- [ ] **Step 2: Write `docs/COMPONENTS.md`** with the structure above.

- [ ] **Step 3: Verify**

Run: `npm run check:docs`

Expected: exit 1 with 6 `missing required doc:` entries, and **zero** `COMPONENTS.md does not document:` errors. Any such error names a component missing from the table — add it.

- [ ] **Step 4: Commit**

```bash
git add docs/COMPONENTS.md
git commit -m "docs: add component inventory"
```

---

## Task 5: `docs/DATA-MODEL.md`

**Files:**
- Create: `docs/DATA-MODEL.md`

**Interfaces:**
- Consumes: `npm run check:docs`
- Produces: the current-shape reference that Phase 1's migration work reads

**Required headings and facts:**

1. `## Content modules` — the four exports of `src/data/weddingData.js`: `INITIAL_STORIES` (3 entries), `INITIAL_PHOTOS` (8 entries), `INITIAL_FILMS` (3 entries), `TESTIMONIALS` (3 entries). Give the field list for each, with the actual field names.
2. `## Field-level problems` — the shapes that Phase 1 must correct, each with the reason:
   - `date: "November 2024"` is a display string, not sortable
   - `duration: "4:32 mins"` is a display string, not a number
   - `span: "col-span-1 md:col-span-2 row-span-2"` embeds Tailwind classes in data, coupling content to presentation
   - photo `id` values are strings (`"photo-1"`); content-manager-created ids are `` `photo-user-${Date.now()}` ``; testimonial `id` values are **numbers** — an inconsistency that already caused the client-gallery favourites bug fixed in commit `8ef6d5e`
   - no `slug` field, so per-wedding URLs are impossible without one
   - `alt` text is not stored; components pass the title as `alt`
   - image dimensions are not stored, so layout shift is unavoidable
3. `## localStorage contract` — the three keys, written by which effect in `src/App.jsx`, and read by which initializer. State the quota risk: `src/components/ContentManagerModal.jsx` stores uploaded images as base64 data URLs via `FileReader.readAsDataURL`, so a handful of photos exhausts the roughly 5 MB origin quota.
4. `## Image sources` — content mixes local `/public/images/*` files with hotlinked `images.unsplash.com` URLs. List the local files present. Note the third-party dependency risk.
5. `## Target schema` — link to `docs/superpowers/specs/2026-07-30-end-to-end-platform-design.md` rather than duplicating the schema.

- [ ] **Step 1: Verify the data facts**

Run:
```bash
grep -c "id:" src/data/weddingData.js
grep -n "export const" src/data/weddingData.js
grep -rn "peak_story_" src/App.jsx
ls public/images/
```

Expected: four `export const` lines; three `peak_story_*` keys appearing in both an initializer and an effect; a listing of local image files. Record the real counts per collection.

- [ ] **Step 2: Write `docs/DATA-MODEL.md`** with the five sections above.

- [ ] **Step 3: Verify**

Run: `npm run check:docs`

Expected: exit 1 with 5 `missing required doc:` entries, and no path or link errors. The link to the spec must resolve — if a `broken link` error appears, correct the relative path.

- [ ] **Step 4: Commit**

```bash
git add docs/DATA-MODEL.md
git commit -m "docs: document current data model and localStorage contract"
```

---

## Task 6: `docs/DESIGN-SYSTEM.md`

**Files:**
- Create: `docs/DESIGN-SYSTEM.md`

**Interfaces:**
- Consumes: `npm run check:docs`
- Produces: the visual-language reference; the dead-code inventory feeds `KNOWN-ISSUES.md` in Task 7

**Required headings and facts.** Usage counts below were verified on 2026-07-30; re-verify before writing.

1. `## Palette` — table of every token in `tailwind.config.js` with its hex value and usage count. Mark these **unused**: `charcoal-800`, `charcoal-900`, `gold-500`, `gold-600`, `offwhite-400`, `pitch-600`, `pitch-700`. Note that `gold-400` appears only twice, both as an icon tint (`src/components/HorizontalGallery.jsx`, `src/components/ColorGradingSlider.jsx`), so the gold ramp is effectively vestigial. State the real identity: oxblood (`pitch-900` `#3D0C1A`) on warm off-white (`offwhite-100` `#faf9f6`).
2. `## Typography` — the three families and their roles: Cinzel (display, `font-cinzel`), Cormorant Garamond (italic editorial voice, `font-garamond`), Plus Jakarta Sans (UI and body, `font-sans`). Record that all six section headers repeat one pattern — uppercase Cinzel with an italic Garamond second line — and that this repetition is what makes the page read as templated.
3. `## Animation catalogue` — table of every `@keyframes` in `src/index.css` and every `animation` in `tailwind.config.js`, with the utility class name and usage count. Mark **unused**: `glass-panel-light`, `animate-scroll-up`, `animate-scroll-left`, `animate-scroll-right`, `animate-logo-pulse`, `animate-splash-out`, `animate-progress-fill`, `img-blur-up`, `horizontal-scroll`, `animate-pulse-slow`. Mark **in use**: `animate-fade-in` (13), `img-zoom-container` (5), `minimal-card` (2), `animate-marquee` (1), `section-wave` (1), `animate-float` (1).
4. `## Locally injected styles` — `src/components/Testimonials.jsx` and `src/components/HorizontalGallery.jsx` inject their own `<style>` blocks instead of using `src/index.css`. Note that `Testimonials` defines a `fillProgress` keyframe duplicating the unused `animate-progress-fill`.
5. `## Motion and accessibility` — no `prefers-reduced-motion` handling exists anywhere. State this plainly as a gap.
6. `## Film and camera vernacular` — the distinctive visual language: the viewfinder HUD in `src/components/SplashScreen.jsx` (corner ticks, `f/1.4`, `1/500s`, `ISO 100`, aperture-blade SVG), film-stock captions in `src/components/FilmStrip.jsx`, and the three inconsistent image-stamp treatments (`PSS / CATEGORY` in `src/components/PhotoGallery.jsx`, `PEAK STORY / DATE` in `src/components/FeaturedStories.jsx`, `KODAK 400TX` in `src/components/FilmStrip.jsx`). Record that this vernacular appears in only two components and is the strongest candidate for the site's signature, and that the three stamp formats should be unified.

- [ ] **Step 1: Re-verify token and class usage**

Run:
```bash
for t in charcoal-800 charcoal-900 gold-400 gold-500 gold-600 offwhite-300 offwhite-400 pitch-600 pitch-700; do
  echo "$t: $(grep -ro "$t" src | wc -l | tr -d ' ')"
done
for c in glass-panel-light minimal-card animate-marquee animate-fade-in animate-scroll-up animate-logo-pulse animate-splash-out animate-progress-fill img-blur-up img-zoom-container horizontal-scroll section-wave animate-float animate-pulse-slow; do
  echo "$c: $(grep -ro "$c" src | grep -v '^src/index.css' | wc -l | tr -d ' ')"
done
grep -n "@keyframes" src/index.css
```

Expected: matches the counts in the headings above. If any differ, the document uses the fresh numbers.

- [ ] **Step 2: Write `docs/DESIGN-SYSTEM.md`** with the six sections above.

- [ ] **Step 3: Verify**

Run: `npm run check:docs`

Expected: exit 1 with 4 `missing required doc:` entries, no path errors, no link errors.

- [ ] **Step 4: Commit**

```bash
git add docs/DESIGN-SYSTEM.md
git commit -m "docs: document design system and dead-style inventory"
```

---

## Task 7: `docs/KNOWN-ISSUES.md` and `docs/ROADMAP.md`

Both derive from the approved spec, so they are one task.

**Files:**
- Create: `docs/KNOWN-ISSUES.md`
- Create: `docs/ROADMAP.md`

**Interfaces:**
- Consumes: `npm run check:docs`; the dead-code inventory from Task 6
- Produces: the issue register that later phases close against

**`docs/KNOWN-ISSUES.md` structure:** a table with columns **ID**, **Issue**, **Severity**, **Location**, **Planned phase**. Use IDs `PS-001` upward. Rows, all currently open:

| Issue | Severity | Location | Phase |
| --- | --- | --- | --- |
| Any client PIN unlocks every client's photos; no per-client scoping | Critical | `src/components/AuthModal.jsx`, `src/components/ClientGalleryModal.jsx` | 6 |
| Fabricated press credentials ("AS FEATURED IN" Vogue, Harper's Bazaar, Filmfare, WedMeGood; "Vogue Fine Art Choice" badge) and real Bollywood celebrities named as clients | Critical (legal) | `src/components/AboutSection.jsx`, `src/data/weddingData.js` | 7 |
| Booking form reports success unconditionally; submissions are discarded | High | `src/components/BookingForm.jsx` | 2 |
| Uploaded images stored as base64 in localStorage; exceeds the ~5 MB quota | High | `src/components/ContentManagerModal.jsx` | 3 |
| Export Config JSON button sets a "Copied!" label but copies nothing | High | `src/components/ContentManagerModal.jsx` | 3 |
| No routing; no shareable or indexable per-wedding URLs | High | app-wide | 5 |
| Modals do not trap focus, lock body scroll, or close on Escape | Medium | all modals except `src/components/LightboxModal.jsx` | 3 |
| No error boundary; a render throw blanks the page | Medium | `src/App.jsx` | 1 |
| `npm run lint` runs `vite build` and lints nothing; no tests exist | Medium | `package.json` | 1 |
| No `prefers-reduced-motion` handling | Medium | `src/index.css`, app-wide | 5 |
| Three scroll listeners; only Hero's is passive | Low | `src/components/Navbar.jsx`, `src/components/ScrollProgressBar.jsx`, `src/components/Hero.jsx` | 5 |
| Duplicated pill-button and badge markup across many components | Low | app-wide | 3 |
| `FilmStrip` and `HorizontalGallery` hardcode their own image arrays | Low | those files | 1 |
| 10 unused CSS rules and 7 unused palette tokens | Low | `src/index.css`, `tailwind.config.js` | 3 |
| Icon-only buttons use `title` instead of `aria-label` | Low | `src/components/PhotoGallery.jsx` and others | 3 |
| Hotlinked Unsplash images with no width/height; layout shift and third-party dependency | Low | `src/data/weddingData.js` | 3 |
| `dist/` build output is committed to git while also listed in `.gitignore`, so every build produces spurious diffs on tracked files | Low | `.gitignore`, `dist/` | 4 |

Add a `## Resolved` section listing the four fixes already made in commit `8ef6d5e`: doubled custom cursor, client-gallery favourites ID mismatch, unguarded `JSON.parse` of localStorage, and colour-slider resize drift. Include the caveat that the cursor fix hides the native caret on text inputs at widths of 1024px and above, and leaves a brief no-cursor window before the first mouse movement.

**`docs/ROADMAP.md` structure:** reproduce the phase/version table from section 3 of the spec (v0.1 through v1.0, phases 0–7, with deliverable, definition of done, and where it runs). Add a `## Current position` line stating that Phase 0 is in progress on branch `phase-0/documentation-baseline`. Link to the spec for full rationale.

- [ ] **Step 1: Verify the two issues not previously confirmed**

Run:
```bash
grep -n "handleCopyJSON" -A 5 src/components/ContentManagerModal.jsx
grep -rn "prefers-reduced-motion" src/ || echo "no reduced-motion handling — confirmed"
grep -rn "passive" src/components/Navbar.jsx src/components/ScrollProgressBar.jsx src/components/Hero.jsx
```

Expected: `handleCopyJSON` only sets a `copied` flag with no clipboard call, confirming the export button is cosmetic; no `prefers-reduced-motion` matches; `passive` appears only in `Hero.jsx`.

- [ ] **Step 2: Write both documents.**

- [ ] **Step 3: Verify**

Run: `npm run check:docs`

Expected: exit 1 with exactly 2 `missing required doc:` entries — `README.md` and `CLAUDE.md`. No path or link errors.

- [ ] **Step 4: Commit**

```bash
git add docs/KNOWN-ISSUES.md docs/ROADMAP.md
git commit -m "docs: add known-issues register and phase roadmap"
```

---

## Task 8: Architecture decision records

**Files:**
- Create: `docs/adr/0001-record-architecture-decisions.md`
- Create: `docs/adr/0002-supabase-as-backend.md`
- Create: `docs/adr/0003-cloudflare-pages-hosting.md`
- Create: `docs/adr/0004-keep-vite-spa-defer-nextjs.md`
- Create: `docs/adr/0005-client-state-in-localstorage.md`

**Interfaces:**
- Consumes: `npm run check:docs`
- Produces: decision history that `README.md` and `CLAUDE.md` link to

**Every ADR uses exactly these headings:** `# NNNN. Title`, then `## Status`, `## Context`, `## Decision`, `## Consequences`. Status is `Accepted` for all five.

Required content per record:

- **0001** — Status Accepted. Context: decisions were being made in conversation with no durable record. Decision: record architecturally significant decisions as numbered ADRs in `docs/adr/`, never edited once accepted; a reversal is a new ADR superseding the old. Consequences: history is auditable; a small writing cost per decision.
- **0002 Supabase as backend** — Context: a real studio needs persistence, auth, private media, and low ops cost, maintained by one person. Decision: Supabase. Alternatives rejected: Firebase (document model fits this relational content poorly, and vendor query language lock-in), hand-rolled Express and Postgres (owner must run auth, migrations, and backups). Consequences: Postgres with Row Level Security; the browser can hold the anon key safely because RLS is enforced in the database; free tier caps storage at 1 GB, which forces the Phase 3 storage decision; free-tier projects pause when idle.
- **0003 Cloudflare Pages hosting** — Context: the site is commercial and the budget is effectively zero. Decision: Cloudflare Pages. **The deciding fact: Vercel's Hobby tier prohibits commercial use, so a studio taking bookings would need Vercel Pro at about 20 USD per month.** Alternatives rejected: Vercel Hobby (terms violation), Vercel Pro (unnecessary cost), Netlify (permits commercial use but caps bandwidth where Cloudflare does not — a real difference for an image-heavy site). Consequences: git-push deploys with preview URLs; pairs naturally with Cloudflare R2 and Turnstile later; the owner originally expected Vercel, so this reversal is recorded deliberately.
- **0004 Keep the Vite SPA, defer Next.js** — Context: the stated priority is working inquiries and a live site, not a rebuild. Decision: add the backend additively; keep the SPA. Alternative rejected: migrating 26 components to Next.js now, which delays the priority and requires SSR-safe rework of the splash screen, custom cursor, and scroll-reveal hooks. Consequences: no server rendering, so search visibility is weak until Phase 5; secrets must live in Edge Functions; the admin bundle must be lazy-loaded so it is not shipped to visitors. Phase 5 reassesses, with static prerendering via `vite-react-ssg` as the lighter candidate.
- **0005 Client state in localStorage (current state, to be replaced)** — Context: with no backend, `src/App.jsx` persists content and session to localStorage. Decision: documented as the pre-Phase-1 state, not endorsed. Consequences: data is per-browser and lost on cache clear; base64 images exhaust the quota; a malformed value previously blanked the app until the guard added in `8ef6d5e`; the session is trivially forgeable because a `user` object with `role: "admin"` can be written by hand in devtools. Superseded by ADR 0002 from Phase 1 onward.

- [ ] **Step 1: Verify the localStorage privilege-escalation claim before documenting it**

Run:
```bash
grep -n "peak_story_user" -A 3 src/App.jsx
grep -n "role === 'admin'" src/components/Navbar.jsx
```

Expected: `user` is restored verbatim from localStorage with no signature or server check, and `Navbar` grants admin UI purely on `user.role === 'admin'`. This confirms the claim; write it as fact in ADR 0005.

- [ ] **Step 2: Write all five ADRs** with the exact heading structure above.

- [ ] **Step 3: Verify**

Run:
```bash
ls docs/adr/*.md | wc -l
grep -L "## Consequences" docs/adr/*.md || echo "all ADRs have Consequences"
npm run check:docs
```

Expected: `5`; `all ADRs have Consequences`; and `check:docs` still reporting exactly 2 missing docs with no path or link errors.

- [ ] **Step 4: Commit**

```bash
git add docs/adr/
git commit -m "docs: add ADRs 0001-0005 recording platform decisions"
```

---

## Task 9: `README.md`

Written after the documents it links to, so the link checker can pass.

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: every document from Tasks 3–8; `npm run check:docs`
- Produces: the repository entry point

**Required headings and facts:**

1. Title and a one-line description: cinematic wedding films and fine-art photography studio site.
2. `## Status` — Phase 0 (v0.1), documentation baseline. Frontend only; no backend yet. Link to `docs/ROADMAP.md`.
3. `## Quickstart` — the real commands:
   ```bash
   npm install
   npm run dev      # http://localhost:3000, opens automatically
   ```
   Note Node 20.11 or newer, required by `scripts/check-docs.mjs`.
4. `## Scripts` — table of all five: `dev`, `build`, `preview`, `lint`, `check:docs`. State plainly that `lint` currently runs `vite build` and does not lint; a real ESLint config arrives in Phase 1. Documenting the defect is the point.
5. `## Project layout` — annotated tree of `src/` (`components/`, `data/`, `hooks/`, `App.jsx`, `main.jsx`, `index.css`), `public/images/`, `docs/`, `scripts/`.
6. `## Tech stack` — React 18.2, Vite 5, Tailwind 3.4, `lucide-react` for icons, `canvas-confetti` on booking submit. Fonts from Google Fonts.
7. `## Documentation` — a link list to `docs/ARCHITECTURE.md`, `docs/COMPONENTS.md`, `docs/DATA-MODEL.md`, `docs/DESIGN-SYSTEM.md`, `docs/ROADMAP.md`, `docs/KNOWN-ISSUES.md`, `docs/adr/`, and the spec. Every link must be relative and must resolve.
8. `## Environment` — copy `.env.example` to `.env.local`; never commit it. Variables are unused until Phase 1.
9. `## Deployment` — not yet deployed. Cloudflare Pages from Phase 4, custom domain at Phase 7. Link to `docs/adr/0003-cloudflare-pages-hosting.md`.

- [ ] **Step 1: Verify the quickstart actually works from a clean install**

`npm ci` is the correct check here rather than `npm install`: it installs strictly from `package-lock.json` into a fresh `node_modules`, which is what a new engineer or a CI runner actually gets. It also proves Task 1's `playwright` declaration took effect.

```bash
npm ci
npm ls playwright --depth=0
npm run build
node --version
```

Expected: `npm ci` succeeds, `playwright` is listed, the build prints `✓ built in`, and Node is 20.11 or newer. If the documented commands do not work, fix the README rather than the expectation.

- [ ] **Step 2: Write `README.md`** with the nine sections above.

- [ ] **Step 3: Verify**

Run: `npm run check:docs`

Expected: exit 1 with exactly **1** `missing required doc:` entry — `CLAUDE.md`. Critically, **zero** `broken link` errors: every link in the documentation index must resolve. Fix any that do not.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with quickstart, scripts, and doc index"
```

---

## Task 10: `CLAUDE.md`

**Files:**
- Create: `CLAUDE.md`

**Interfaces:**
- Consumes: every document from Tasks 3–9; `npm run check:docs`
- Produces: conventions inherited by future agent sessions. This is the task that turns `check:docs` green.

**Required headings and facts:**

1. `## Project` — one paragraph: commercial wedding-photography studio site, Vite + React + Tailwind SPA, Supabase backend arriving by phase. Link to `docs/ROADMAP.md` and the spec.
2. `## Before changing anything` — read `docs/ARCHITECTURE.md` and `docs/KNOWN-ISSUES.md` first. Do not fix a known issue outside its planned phase without saying so.
3. `## Conventions` —
   - Plain JavaScript, `.jsx` for components. No TypeScript; see the spec's out-of-scope list.
   - Tailwind utilities inline; add to `src/index.css` only for what utilities cannot express.
   - Use existing palette tokens; do not introduce raw hex values. `SectionDivider` already violates this and is a known issue.
   - Components stay presentational; state lives in `src/App.jsx` until Phase 1 introduces `src/lib/queries/`.
   - From Phase 1: components never import the Supabase client directly — they call hooks, hooks call queries.
4. `## Commands` — `npm run dev`, `npm run build`, `npm run check:docs`. State that `npm run lint` does not lint yet.
5. `## Documentation duties` — any change touching components must keep `docs/COMPONENTS.md` accurate; `npm run check:docs` enforces it and runs in CI from Phase 1.
6. `## Git` — Conventional Commits; one branch per phase named `phase-N/<slug>`; tag at phase completion (`v0.1`, `v0.2`, …); never commit to `main` directly.
7. `## Content integrity` — a standing rule: never add fabricated press credentials, awards, statistics, or testimonials attributed to real people. The existing instances are tracked as `PS-002` and are removed in Phase 7. This exists because the seeded template shipped several.

- [ ] **Step 1: Write `CLAUDE.md`** with the seven sections above.

- [ ] **Step 2: Verify the harness is finally green**

Run:
```bash
npm run check:docs; echo "exit=$?"
```

Expected: `check:docs passed — N markdown file(s) checked` and `exit=0`. This is the first time the harness passes. If any error remains, fix the document rather than the harness.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with project conventions

check:docs now passes: all required docs present, all 23 components
documented, all cited source paths and internal links resolve."
```

---

## Task 11: Phase verification and release

**Files:**
- Modify: none (verification and tagging only)

**Interfaces:**
- Consumes: everything from Tasks 1–10
- Produces: tag `v0.1`, the baseline later phases branch from

- [ ] **Step 1: Full verification sweep**

Run:
```bash
npm run check:docs
npm run build
git status --short
```

Expected: `check:docs passed`; build prints `✓ built in`; `git status --short` is empty except possibly regenerated `dist/` artifacts.

- [ ] **Step 2: Confirm no source file was modified in this phase**

Run:
```bash
git diff --stat 8ef6d5e..HEAD -- src/
```

Expected: **empty output.** This phase must not have touched `src/`. If anything appears, it violates the global constraint and must be reverted or justified.

- [ ] **Step 3: Discard regenerated build artifacts**

`dist/` is both committed to this repository **and** listed in `.gitignore` — a pre-existing inconsistency (tracked files override `.gitignore`, so the committed ones still show as modified while newly built ones are invisible to plain `git status`). A build therefore rewrites hashed filenames as an unrelated side effect.

Because the new files are untracked *and* ignored, `git clean -n` will not list them; the `-x` flag is required to see ignored files.

```bash
git checkout -- dist/ 2>/dev/null || true   # restore tracked dist files
git clean -nx dist/                          # preview ignored+untracked build output
```

Review that preview, then delete exactly those files with `git clean -fx dist/`. Confirm `git status --short` is clean afterwards.

This inconsistency is recorded as an issue in Task 7 rather than fixed here; resolving it belongs to Phase 4, when CI takes over building.

- [ ] **Step 4: Confirm no secrets are tracked**

Run:
```bash
git ls-files | grep -E "^\.env" || echo "no .env files tracked"
git log -p 8ef6d5e..HEAD | grep -inE "api[_-]?key\s*[:=]\s*\S|secret\s*[:=]\s*\S" || echo "no secret-like assignments in new commits"
```

Expected: only `.env.example` may appear from the first command; the second reports no secret-like assignments.

- [ ] **Step 5: Verify the documentation goal is actually met**

Read `README.md` as though seeing the repository for the first time and confirm each is answerable from the docs alone: what the project is, how to run it, where a given component lives, what state exists and who owns it, what is deliberately broken, what is planned next, and why Supabase and Cloudflare were chosen. Any question that cannot be answered indicates a gap to fill before tagging.

- [ ] **Step 6: Tag the release**

```bash
git tag -a v0.1 -m "v0.1 — Phase 0: documentation baseline

Documentation for the existing frontend: architecture, all 23 components,
data model and localStorage contract, design system with dead-style
inventory, known-issues register, roadmap, and 5 ADRs.

Also: .gitignore now ignores all .env variants (it previously did not match
.env.local), playwright is a declared devDependency, and check-docs.mjs
gates documentation drift.

No src/ changes in this phase."
git tag -n5 v0.1
```

- [ ] **Step 7: Report to the maintainer**

Summarise: what was documented, that `check:docs` passes, that `src/` is untouched, and that Phase 1 is next and needs its own spec. Ask whether to merge `phase-0/documentation-baseline` into `main` and whether to push (the tag and branch are local until then).

---

## Notes for the executor

- **The harness fails on purpose until Task 10.** Expected missing-doc counts: 8 after Task 2, 7 after Task 3, 6 after Task 4, 5 after Task 5, 4 after Task 6, 2 after Task 7, 2 after Task 8, 1 after Task 9, 0 after Task 10. A count that does not match means a document was missed or misnamed.
- **Verify, do not recall.** Every count in this plan was checked against commit `8ef6d5e` on 2026-07-30, but re-run the verification commands. If a number disagrees, the code is right and the plan is stale.
- **Do not fix known issues in this phase.** Recording an issue is the deliverable; fixing it belongs to its planned phase. The one exception is Task 1's `.gitignore` fix, which is authorised because Phase 1 would otherwise risk committing keys.
- **A dev server may already be running** on port 3000 from an earlier session. Check with `lsof -ti:3000 -sTCP:LISTEN` before starting another.
