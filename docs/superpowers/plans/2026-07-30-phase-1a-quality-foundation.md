# Phase 1a (v0.2a) — Quality Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the project real linting, real tests, and a crash barrier, then fix the two robustness defects those tools expose — so that Phase 1b's backend code is gated from its first line.

**Architecture:** Test infrastructure first (Vitest + React Testing Library), then ESLint together with the violations it finds — including a Rules of Hooks defect that is statically detectable but, as measured, not reliably reproducible at runtime, so the linter rather than a test is its gate. Error boundary and data extraction follow, then CI wires all four gates together.

**Tech Stack:** Vitest, @testing-library/react, jsdom, ESLint 9 flat config with eslint-plugin-react-hooks, GitHub Actions. All additions are devDependencies — no new runtime dependency.

## Global Constraints

- **Branch:** `phase-1/quality-foundation` (already created, currently at the Phase 0 merge commit `db12e99`).
- **Node 20.11 or newer** — required by `scripts/check-docs.mjs` (`import.meta.dirname`).
- **No new runtime dependencies.** Everything installed in this phase is a devDependency. `dependencies` in `package.json` must remain exactly: `canvas-confetti`, `lucide-react`, `react`, `react-dom`.
- **Every task must end green on all four gates:** `npm run lint`, `npm test`, `npm run check:docs`, and a clean `git status --short`. A task that leaves a gate red is not done.
- **Conventional Commits** for every commit.
- **`dist/` is committed to git AND listed in `.gitignore`** (issue `PS-019`). Do not run `npm run build` casually. If you must, clean up afterwards with `git checkout -- dist/` then `git clean -fx dist/`.
- **Tests live in `src/components/__tests__/`**, never co-located as `src/components/*.test.jsx`. Reason: `scripts/check-docs.mjs` scans `src/components/*.jsx` and requires every match to be documented in `docs/COMPONENTS.md`; a co-located test file would be mistaken for an undocumented component. Task 1 also hardens the harness against this, but the convention stands.
- **Any new file in `src/components/` must be added to `docs/COMPONENTS.md` in the same task**, or `npm run check:docs` fails. This applies to Task 3's `ErrorBoundary.jsx`.
- **Do not repeat fabricated content.** Per `CLAUDE.md`, never add press credentials, awards, statistics, or testimonials attributed to real people. Test fixtures must use obviously-fictional names.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `vite.config.js` (modify) | Add Vitest `test` block — jsdom, globals, setup file |
| `src/test/setup.js` (create) | Registers jest-dom matchers for every test run |
| `src/components/__tests__/*.test.jsx` (create) | Component tests, out of the harness's component scan |
| `scripts/check-docs.mjs` (modify) | Exclude `*.test.jsx` from the component scan |
| `eslint.config.js` (create) | ESLint 9 flat config: React 18 + hooks rules |
| `src/components/LightboxModal.jsx` (modify) | Move hooks above the early return |
| `src/components/StoryDetailModal.jsx` (modify) | Move hook above the early return |
| `src/components/ErrorBoundary.jsx` (create) | Class component catching render throws |
| `src/main.jsx` (modify) | Wrap `<App />` in the boundary |
| `src/data/weddingData.js` (modify) | Absorb the two hardcoded arrays |
| `src/components/FilmStrip.jsx` (modify) | Import `FILM_STRIP_FRAMES` instead of defining it |
| `src/components/HorizontalGallery.jsx` (modify) | Import `EDITORIAL_GALLERY` instead of defining it |
| `.github/workflows/ci.yml` (create) | Run all four gates on push and PR |
| `package.json` (modify) | Real `lint` script, `test` scripts, version `0.1.0` |
| `docs/*` (modify) | Keep documentation true as the code changes |

**Ordering rationale:** test infrastructure first, so later tasks have regression cover. ESLint and the hooks fix are one task because the linter is what proves the defect exists — an earlier split assumed a runtime test could show it red-before, and measurement disproved that (see Task 2's preamble). CI last, once there are four real gates to run.

---

## Task 1: Test infrastructure

**Files:**
- Modify: `vite.config.js`
- Create: `src/test/setup.js`
- Create: `src/components/__tests__/SectionDivider.test.jsx`
- Modify: `scripts/check-docs.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm test` (single run) and `npm run test:watch`; the `src/components/__tests__/` convention every later task uses.

**Context:** the project has no tests at all. `SectionDivider` is the smallest component (27 lines, pure presentational, props in → SVG out), which makes it the right first subject: if its test passes, the harness itself is proven working.

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Verify they landed in `devDependencies` and that `dependencies` is untouched:
```bash
node -e "const p=require('./package.json'); console.log('deps:', Object.keys(p.dependencies).join(', '))"
```
Expected: `deps: canvas-confetti, lucide-react, react, react-dom` — exactly those four.

- [ ] **Step 2: Add the Vitest config block**

In `vite.config.js`, add a `test` key to the object passed to `defineConfig`:

```javascript
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
```

- [ ] **Step 3: Create the setup file**

Create `src/test/setup.js`:

```javascript
// Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveClass, …)
// for every test file. Referenced by vite.config.js -> test.setupFiles.
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add the test scripts**

In `package.json` `scripts`, add:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

Leave `lint` alone for now — Task 2 replaces it.

- [ ] **Step 5: Write the first test**

Create `src/components/__tests__/SectionDivider.test.jsx`:

```jsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SectionDivider from '../SectionDivider';

describe('SectionDivider', () => {
  it('applies the background colour to the wrapper and the wave colour to the path', () => {
    const { container } = render(
      <SectionDivider color="#faf9f6" bgColor="#ffffff" />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveStyle({ backgroundColor: '#ffffff' });

    const path = container.querySelector('svg path');
    expect(path).toHaveAttribute('fill', '#faf9f6');
  });

  it('flips vertically only when the flip prop is set', () => {
    const { container: normal } = render(<SectionDivider />);
    expect(normal.firstChild).toHaveStyle({ transform: 'none' });

    const { container: flipped } = render(<SectionDivider flip />);
    expect(flipped.firstChild).toHaveStyle({ transform: 'scaleY(-1)' });
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `npm test`

Expected: 2 passing tests. If the run fails because jsdom or the setup file is not found, fix the config — do not weaken the test.

- [ ] **Step 7: Harden the docs harness against co-located tests**

`scripts/check-docs.mjs` requires every `src/components/*.jsx` file to be named in `docs/COMPONENTS.md`. A future co-located `Foo.test.jsx` would therefore demand documentation for a component called "Foo.test". Tests live in `__tests__/` by convention, but make the harness robust anyway.

Find the component-collection code in check 2 and add a `.test.jsx` exclusion, so it reads:

```javascript
  const components = readdirSync(join(ROOT, 'src/components'))
    // Test files are not components. They live in __tests__/ by convention
    // (not scanned, since readdirSync is not recursive), but a co-located
    // *.test.jsx would otherwise be demanded as an undocumented component.
    .filter((f) => f.endsWith('.jsx') && !f.endsWith('.test.jsx'))
    .map((f) => f.replace(/\.jsx$/, ''));
```

- [ ] **Step 8: Verify the harness still works**

Run:
```bash
npm run check:docs; echo "exit=$?"
```
Expected: `check:docs passed` and `exit=0`.

Now prove the exclusion did not disable check 2 — create a fake component, confirm it is still demanded, then remove it:
```bash
printf 'export default function TempProbe() { return null; }\n' > src/components/TempProbe.jsx
npm run check:docs 2>&1 | grep "TempProbe" && echo "check 2 still works"
rm src/components/TempProbe.jsx
npm run check:docs; echo "exit=$?"
```
Expected: an error naming `TempProbe`, then `check 2 still works`, then a clean pass at `exit=0` after removal.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.js src/test/setup.js src/components/__tests__/SectionDivider.test.jsx scripts/check-docs.mjs
git commit -m "test: add Vitest and React Testing Library

No tests existed (PS-011). Adds Vitest with jsdom, jest-dom matchers, and
a first test covering SectionDivider's colour and flip props.

Tests live in src/components/__tests__/ so they are not caught by
check-docs.mjs's component scan; the harness now also excludes
*.test.jsx explicitly so a future co-located test cannot be mistaken
for an undocumented component."
```

---

## Task 2: ESLint, and the violations it finds (PS-011 and PS-006)

**Files:**
- Create: `eslint.config.js`
- Modify: `package.json`
- Modify: `src/components/LightboxModal.jsx`
- Modify: `src/components/StoryDetailModal.jsx`
- Create: `src/components/__tests__/LightboxModal.test.jsx`
- Create: `src/components/__tests__/StoryDetailModal.test.jsx`
- Possibly modify: other source files ESLint flags

**Interfaces:**
- Consumes: `npm test` from Task 1.
- Produces: `npm run lint` that genuinely lints, and two components whose hooks run unconditionally.

### Why this task merges linting with a bug fix

**Read this before starting — it explains the shape of the task and why an earlier attempt was abandoned.**

`PS-006` records a Rules of Hooks violation: `src/components/LightboxModal.jsx:5` and `src/components/StoryDetailModal.jsx:5` both call `useState` *after* an early conditional `return null`. React requires the same hooks in the same order on every render of an instance.

A first attempt tried to prove this with a runtime test — render with a falsy prop, rerender with a truthy one, expect "Rendered more hooks than during the previous render". **That test passes against the broken code, so it is not proof of anything.** The reason is precise: the guard is the very first statement, so on a falsy render zero hooks execute and the fiber's `memoizedState` stays `null`. React's dispatcher check (`current.memoizedState === null`) then treats the following render as a fresh mount rather than an update, so there is no previous hook list to overrun and no crash. The reverse order (truthy then falsy) was also measured and does not throw either.

The conclusion is that this defect is **statically detectable and not reliably reproducible at runtime.** The correct gate is therefore ESLint's `react-hooks/rules-of-hooks` rule, which flags it with certainty. That is why linting and the fix are one task: installing the linter produces the red state, and fixing the components turns it green.

The component tests in this task are still required, but their job is different: they prove the reordering did not change rendering behaviour. Do not write them as red-before proof — write them as behaviour tests that pass before and after.

**Do not weaken this into "just fix the lint errors."** The two component fixes are the point; the linter is how you know they are needed and how they stay fixed.

- [ ] **Step 1: Install ESLint and plugins**

```bash
npm install -D eslint @eslint/js globals eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh
```

- [ ] **Step 2: Create the flat config**

Create `eslint.config.js`:

```javascript
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    // .mjs is included so scripts/check-docs.mjs is actually linted; without
    // it that file matches no rules block and is silently skipped.
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: '18.2' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // The project uses the automatic JSX runtime, so React need not be in scope.
      'react/react-in-jsx-scope': 'off',
      // Prop types are not used in this codebase; documentation lives in docs/COMPONENTS.md.
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Test files import describe/it/expect/vi explicitly from 'vitest', so no
    // test-runner globals need declaring here — only Node's, for setup files.
    // (Do not reach for `globals.vitest`; the globals package does not export
    // that key, and spreading undefined would silently declare nothing.)
    files: ['src/**/__tests__/**/*.{js,jsx}', 'src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Node scripts, not browser code.
    files: ['scripts/**/*.mjs', '*.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
```

- [ ] **Step 3: Replace the lying lint script**

In `package.json`, change `"lint": "vite build"` to:

```json
    "lint": "eslint .",
```

- [ ] **Step 4: Run ESLint and record every violation — this is the red state**

Run: `npm run lint`

Record the COMPLETE output in your report. This is the most important evidence in the task.

You must see `react-hooks/rules-of-hooks` errors naming `src/components/LightboxModal.jsx` and `src/components/StoryDetailModal.jsx` — something of the form "React Hook useState is called conditionally. React Hooks must be called in the exact same order in every component render."

**If those two errors do NOT appear, stop and report BLOCKED.** It would mean the rule is not active, and the fix in Step 6 would be unverified. Do not proceed by fixing the components anyway.

Expect other findings too — the codebase has never been linted. A known one: `src/components/ClientGalleryModal.jsx` imports `Share2` but never renders it.

- [ ] **Step 5: Fix the non-hooks violations**

Work through everything except the two hooks errors, which Step 6 owns. Guidance by category:

- **Unused imports or variables** — delete them. They are dead weight.
- **`react-hooks/exhaustive-deps`** — these are warnings, not errors. Do NOT restructure component logic to satisfy them here; that risks behaviour changes with no test coverage. Record them in your report; they become a tracked issue in the final task of this phase.
- **`react/no-unescaped-entities`** — fix by escaping, or disable for the specific line with a justification comment.

**Never disable a rule to make an error disappear.** Fix the code. If a fix would change runtime behaviour rather than delete dead code, stop and report it instead of guessing.

- [ ] **Step 6: Fix the two hooks violations**

Move the hooks above the guard in each component. **The guard stays** — both components are rendered conditionally by their parents and must still return `null` for a falsy prop. You are moving the hooks, not deleting the guard.

In `src/components/LightboxModal.jsx`, all three hooks (`useState` ×2, `useEffect`) run first:

```jsx
export default function LightboxModal({ activeImage, activeIndex, imagesList, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(activeIndex || 0);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && imagesList?.length) {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : imagesList.length - 1));
      }
      if (e.key === 'ArrowRight' && imagesList?.length) {
        setCurrentIndex((prev) => (prev < imagesList.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imagesList, onClose]);

  if (!activeImage) return null;

  const currentPhoto = imagesList && imagesList[currentIndex] ? imagesList[currentIndex] : { url: activeImage };
  const imageUrl = currentPhoto.url || activeImage;
```

In `src/components/StoryDetailModal.jsx`:

```jsx
export default function StoryDetailModal({ story, onClose, onSelectImage, onOpenVideo }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  if (!story) return null;

  const images = story.fullGallery || [story.coverImage];
```

**Non-hook derivations must stay below the guard.** `currentPhoto` and `imageUrl` read `activeImage`; `images` dereferences `story`. If they move above the guard they will run when the component should render nothing, and `images` will throw on a null story.

Change nothing else in either component — no markup, no class names, no behaviour.

- [ ] **Step 7: Confirm the linter is now green**

Run: `npm run lint; echo "lint=$?"`

Expected: `lint=0` and no output. The two `rules-of-hooks` errors from Step 4 are gone. This is the red-to-green transition that proves the fix.

- [ ] **Step 8: Write behaviour tests for the two components**

These prove the reordering did not change rendering. They are expected to pass — they are regression cover, not red-before proof.

Create `src/components/__tests__/LightboxModal.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LightboxModal from '../LightboxModal';

const photos = [
  { url: '/images/one.jpg', title: 'First Frame' },
  { url: '/images/two.jpg', title: 'Second Frame' },
];

describe('LightboxModal', () => {
  it('renders nothing when there is no active image', () => {
    const { container } = render(
      <LightboxModal activeImage="" activeIndex={0} imagesList={[]} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the active image with its title as alt text', () => {
    render(
      <LightboxModal activeImage="/images/one.jpg" activeIndex={0} imagesList={photos} onClose={vi.fn()} />
    );
    expect(screen.getByAltText('First Frame')).toBeInTheDocument();
  });

  it('shows the position counter when several images are supplied', () => {
    render(
      <LightboxModal activeImage="/images/one.jpg" activeIndex={0} imagesList={photos} onClose={vi.fn()} />
    );
    expect(screen.getByText('(1 / 2)')).toBeInTheDocument();
  });

  it('survives a prop change in both directions while staying mounted', () => {
    const onClose = vi.fn();
    const { rerender, container } = render(
      <LightboxModal activeImage="" activeIndex={0} imagesList={photos} onClose={onClose} />
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <LightboxModal activeImage="/images/one.jpg" activeIndex={0} imagesList={photos} onClose={onClose} />
    );
    expect(screen.getByAltText('First Frame')).toBeInTheDocument();

    rerender(
      <LightboxModal activeImage="" activeIndex={0} imagesList={photos} onClose={onClose} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

Create `src/components/__tests__/StoryDetailModal.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StoryDetailModal from '../StoryDetailModal';

const story = {
  title: 'A Harbour Wedding',
  couple: 'Test Couple',
  location: 'Test Harbour',
  date: 'March 2026',
  summary: 'A fictional story used only in tests.',
  coverImage: '/images/cover.jpg',
  fullGallery: ['/images/cover.jpg', '/images/second.jpg'],
  tags: ['Test'],
};

describe('StoryDetailModal', () => {
  it('renders nothing without a story', () => {
    const { container } = render(
      <StoryDetailModal story={null} onClose={vi.fn()} onSelectImage={vi.fn()} onOpenVideo={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the story title and couple', () => {
    render(
      <StoryDetailModal story={story} onClose={vi.fn()} onSelectImage={vi.fn()} onOpenVideo={vi.fn()} />
    );
    expect(screen.getByText('A Harbour Wedding')).toBeInTheDocument();
  });

  it('reports the gallery size', () => {
    render(
      <StoryDetailModal story={story} onClose={vi.fn()} onSelectImage={vi.fn()} onOpenVideo={vi.fn()} />
    );
    expect(screen.getByText(/Full Album Gallery \(2 Photographs\)/)).toBeInTheDocument();
  });

  it('survives a prop change in both directions while staying mounted', () => {
    const props = { onClose: vi.fn(), onSelectImage: vi.fn(), onOpenVideo: vi.fn() };
    const { rerender, container } = render(<StoryDetailModal story={null} {...props} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<StoryDetailModal story={story} {...props} />);
    expect(screen.getByText('A Harbour Wedding')).toBeInTheDocument();

    rerender(<StoryDetailModal story={null} {...props} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 9: Run the tests**

Run: `npm test`

Expected: all tests pass — the 2 from Task 1 plus the 8 added here, 10 total.

- [ ] **Step 10: Prove the rule guards the fix**

Confirm `react-hooks/rules-of-hooks` will catch a regression, by reintroducing the bug and restoring it:

```bash
cp src/components/StoryDetailModal.jsx /tmp/sdm-backup.jsx
node -e "
const fs=require('fs');
const p='src/components/StoryDetailModal.jsx';
let s=fs.readFileSync(p,'utf8');
const fixed='  const [activeImageIndex, setActiveImageIndex] = useState(0);\n\n  if (!story) return null;';
const broken='  if (!story) return null;\n  const [activeImageIndex, setActiveImageIndex] = useState(0);';
if (!s.includes(fixed)) { console.error('PATTERN NOT FOUND — check the fix shape'); process.exit(1); }
fs.writeFileSync(p, s.replace(fixed, broken));
"
npm run lint 2>&1 | grep -i "rules-of-hooks" && echo "rules-of-hooks is live"
cp /tmp/sdm-backup.jsx src/components/StoryDetailModal.jsx
rm /tmp/sdm-backup.jsx
git diff --stat src/components/StoryDetailModal.jsx
```

Expected: a `react-hooks/rules-of-hooks` error, then `rules-of-hooks is live`, then an EMPTY `git diff --stat` proving the file was restored byte-for-byte. If the diff is not empty, restore with `git checkout -- src/components/StoryDetailModal.jsx`.

- [ ] **Step 11: Verify all gates**

Run:
```bash
npm run lint; echo "lint=$?"
npm test
npm run check:docs; echo "docs=$?"
git status --short
```
Expected: `lint=0`, all tests passing, `docs=0`.

- [ ] **Step 12: Commit**

```bash
git add eslint.config.js package.json package-lock.json
git add src/components/LightboxModal.jsx src/components/StoryDetailModal.jsx
git add src/components/__tests__/LightboxModal.test.jsx src/components/__tests__/StoryDetailModal.test.jsx
git add -u src/
git commit -m "build: add real ESLint and fix the violations it found

PS-011: 'npm run lint' ran 'vite build' — it linted nothing and dirtied
the committed dist/ directory as a side effect. Replaced with ESLint 9
flat config plus the React and react-hooks plugins.

PS-006: the linter immediately flagged what a runtime test could not.
LightboxModal and StoryDetailModal called useState after a conditional
'return null', so hook order was not stable across renders. Hooks now
run unconditionally and the guard follows them.

The hook-order defect is statically detectable but not reliably
reproducible at runtime: with the guard as the first statement, zero
hooks run on a falsy render, so React leaves memoizedState null and
treats the next render as a fresh mount rather than an update. Both
prop-change directions were measured and neither throws. The added
component tests are therefore behaviour cover for the reordering;
react-hooks/rules-of-hooks is the gate that keeps the fix in place."

---
## Task 3: Error boundary (PS-010)

**Files:**
- Create: `src/components/ErrorBoundary.jsx`
- Create: `src/components/__tests__/ErrorBoundary.test.jsx`
- Modify: `src/main.jsx`
- Modify: `docs/COMPONENTS.md`

**Interfaces:**
- Consumes: `npm test` from Task 1.
- Produces: `<ErrorBoundary>` wrapping the app; a render throw no longer blanks the page.

**Context:** the app has no error boundary. Any render throw unmounts the whole tree and leaves a white page. This nearly happened for real: before the guard added in commit `8ef6d5e`, a malformed `localStorage` value made `JSON.parse` throw during the first render.

**Copy guidance** (from `CLAUDE.md` and the project's writing conventions): the fallback explains what happened and what to do next. It does not apologise, is not vague, and is written in the interface's voice. It must not invent a cause it cannot know.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/ErrorBoundary.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

function Boom() {
  throw new Error('render exploded');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught render errors to console.error; silence it so the
    // expected failure does not look like a broken test run.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>Gallery content</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('Gallery content')).toBeInTheDocument();
  });

  it('renders the fallback instead of unmounting when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload the page/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npm test`

Expected: FAIL — `Cannot find module '../ErrorBoundary'`.

- [ ] **Step 3: Implement the boundary**

Create `src/components/ErrorBoundary.jsx`. It must be a class component: `componentDidCatch`/`getDerivedStateFromError` have no hook equivalent.

```jsx
import React from 'react';

/**
 * Catches render-time errors anywhere below it and shows a recovery screen
 * instead of unmounting the tree to a blank page (PS-010).
 *
 * Must be a class: getDerivedStateFromError and componentDidCatch have no
 * hook equivalent.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Phase 7 replaces this with real error monitoring.
    console.error('Unhandled render error:', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-offwhite-100 text-pitch-900 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-5">
          <h1 className="font-cinzel text-2xl font-bold tracking-tight">
            Something went wrong
          </h1>
          <p className="font-garamond text-lg text-charcoal-700 italic">
            This page stopped loading before it finished. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-full bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-[0.2em] font-semibold hover:bg-pitch-800 transition-colors"
          >
            Reload the page
          </button>
          <p className="text-xs text-charcoal-500">
            If it keeps happening, email inquiries@peakstorystudio.com and tell us what you were viewing.
          </p>
        </div>
      </div>
    );
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`

Expected: both `ErrorBoundary` tests pass, all earlier tests still pass.

- [ ] **Step 5: Wrap the app**

In `src/main.jsx`, wrap `<App />`:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
```

- [ ] **Step 6: Document the new component**

`scripts/check-docs.mjs` requires every file in `src/components/` to be named in `docs/COMPONENTS.md`. Add an `ErrorBoundary` row to the inventory table, matching the existing column format (Component / Purpose / Props / Local state / Notable dependencies). Its props are `children`; its local state is `hasError`.

Confirm the harness would have caught an omission:
```bash
npm run check:docs; echo "exit=$?"
```
Expected: `exit=0`. If it reports `COMPONENTS.md does not document: ErrorBoundary`, the row is missing or misspelled.

- [ ] **Step 7: Verify all gates**

Run:
```bash
npm run lint; echo "lint=$?"
npm test
npm run check:docs; echo "docs=$?"
git status --short
```
Expected: `lint=0`, all tests pass, `docs=0`.

- [ ] **Step 8: Commit**

```bash
git add src/components/ErrorBoundary.jsx src/components/__tests__/ErrorBoundary.test.jsx src/main.jsx docs/COMPONENTS.md
git commit -m "feat: add an error boundary around the app

PS-010. A render throw previously unmounted the whole tree to a blank
page with no recovery path — which nearly shipped, since a malformed
localStorage value used to throw during first render before the guard
in 8ef6d5e.

The fallback names what happened and offers a reload, without inventing
a cause it cannot know."
```

---

## Task 4: Move hardcoded image data into the data module (PS-015)

**Files:**
- Modify: `src/data/weddingData.js`
- Modify: `src/components/FilmStrip.jsx`
- Modify: `src/components/HorizontalGallery.jsx`
- Create: `src/components/__tests__/FilmStrip.test.jsx`
- Modify: `docs/DATA-MODEL.md`
- Modify: `docs/COMPONENTS.md`

**Interfaces:**
- Consumes: `npm test` from Task 1.
- Produces: `FILM_STRIP_FRAMES` and `EDITORIAL_GALLERY` exported from `src/data/weddingData.js` — Phase 1b's migration will move these into the database alongside the other collections.

**Context:** `FilmStrip` defines `btsFrames` inside the component body and `HorizontalGallery` defines `galleryItems` at module scope. Every other section reads from `src/data/weddingData.js`, so these two are invisible to the content manager and would be missed by Phase 1b's migration. Defining `btsFrames` inside the component body also rebuilds the array on every render.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/FilmStrip.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FilmStrip from '../FilmStrip';
import { FILM_STRIP_FRAMES } from '../../data/weddingData';

describe('FilmStrip', () => {
  it('renders every frame from the shared data module, duplicated for the marquee loop', () => {
    render(<FilmStrip />);
    const firstLocation = FILM_STRIP_FRAMES[0].location;
    // The marquee renders the list twice so the scroll can loop seamlessly.
    expect(screen.getAllByAltText(firstLocation)).toHaveLength(2);
  });

  it('sources its frames from weddingData rather than a local array', () => {
    expect(Array.isArray(FILM_STRIP_FRAMES)).toBe(true);
    expect(FILM_STRIP_FRAMES.length).toBeGreaterThan(0);
    for (const frame of FILM_STRIP_FRAMES) {
      expect(frame).toHaveProperty('title');
      expect(frame).toHaveProperty('location');
      expect(frame).toHaveProperty('img');
    }
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npm test`

Expected: FAIL — `FILM_STRIP_FRAMES` is not exported from `src/data/weddingData.js`.

- [ ] **Step 3: Move the data**

Open `src/components/FilmStrip.jsx` and `src/components/HorizontalGallery.jsx` and copy their arrays verbatim into `src/data/weddingData.js`, appended after the existing exports:

- `btsFrames` becomes `export const FILM_STRIP_FRAMES = [...]` — keep every entry and every field (`title`, `location`, `img`) exactly as they are.
- `galleryItems` becomes `export const EDITORIAL_GALLERY = [...]` — keep every entry and every field (`id`, `image`, `title`, `location`) exactly as they are.

Do not rename fields, reorder entries, or change any URL. This is a move, not a redesign — Phase 1b handles schema shape.

Add a short comment above each explaining what consumes it.

- [ ] **Step 4: Update the two components to import**

In `src/components/FilmStrip.jsx`, delete the local `btsFrames` array and import instead:

```jsx
import { FILM_STRIP_FRAMES } from '../data/weddingData';
```

Replace the `[...btsFrames, ...btsFrames]` usage with `[...FILM_STRIP_FRAMES, ...FILM_STRIP_FRAMES]`.

In `src/components/HorizontalGallery.jsx`, delete the module-scope `galleryItems` array and import instead:

```jsx
import { EDITORIAL_GALLERY } from '../data/weddingData';
```

Replace the `galleryItems.map(...)` usage with `EDITORIAL_GALLERY.map(...)`.

Change nothing else in either component — no markup, no classes, no behaviour.

- [ ] **Step 5: Run the tests**

Run: `npm test`

Expected: all tests pass, including the two new ones.

- [ ] **Step 6: Prove nothing visually changed**

The arrays moved but the rendered output must be identical. Verify the counts survived the move:

```bash
node -e "
import('./src/data/weddingData.js').then(m => {
  console.log('FILM_STRIP_FRAMES:', m.FILM_STRIP_FRAMES.length);
  console.log('EDITORIAL_GALLERY:', m.EDITORIAL_GALLERY.length);
});
"
grep -c "btsFrames\|galleryItems" src/components/FilmStrip.jsx src/components/HorizontalGallery.jsx
```

Expected: `FILM_STRIP_FRAMES: 6` and `EDITORIAL_GALLERY: 5` (confirm against the original arrays before you moved them — if your counts differ, entries were lost). The `grep -c` must report `0` for both files, proving no stale reference to the old names remains.

- [ ] **Step 7: Update the documentation**

Both documents describe the old arrangement and are now wrong:

- `docs/DATA-MODEL.md` — its "Content modules" section lists the exports of `src/data/weddingData.js`. Add `FILM_STRIP_FRAMES` and `EDITORIAL_GALLERY` with their entry counts and field lists. Also revisit the section noting Unsplash hotlinks in `FilmStrip.jsx` and `HorizontalGallery.jsx`: those URLs now live in the data module, so update the location it cites.
- `docs/COMPONENTS.md` — its "Components with hardcoded data" section names `FilmStrip` and `HorizontalGallery` as holding their own arrays. That is no longer true. Rewrite that section to record the issue as resolved and point at the data module.

- [ ] **Step 8: Verify all gates**

Run:
```bash
npm run lint; echo "lint=$?"
npm test
npm run check:docs; echo "docs=$?"
git status --short
```
Expected: `lint=0`, tests pass, `docs=0`.

- [ ] **Step 9: Commit**

```bash
git add src/data/weddingData.js src/components/FilmStrip.jsx src/components/HorizontalGallery.jsx src/components/__tests__/FilmStrip.test.jsx docs/DATA-MODEL.md docs/COMPONENTS.md
git commit -m "refactor: move hardcoded image arrays into the data module

PS-015. FilmStrip and HorizontalGallery each defined their own image
array, so they were invisible to the content manager and would have been
missed by the Phase 1b migration that reads from weddingData.js.

Exported as FILM_STRIP_FRAMES and EDITORIAL_GALLERY. A pure move: no
field renamed, no entry reordered, no URL changed."
```

---

## Task 5: CI, issue register, and version

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `docs/KNOWN-ISSUES.md`
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `npm run lint`, `npm test`, `npm run check:docs` from Tasks 1–5.
- Produces: the CI gate every later phase must pass.

**Context:** the spec's quality-gates section requires GitHub Actions to run lint, test, and build on every pull request. Four issues close in this phase and the documentation still describes the old state.

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20.11'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Check documentation
        run: npm run check:docs

      - name: Build
        run: npm run build
```

Note the step order: the three fast gates run before the build, so a lint or test failure reports in seconds rather than after a full bundle.

- [ ] **Step 2: Validate the workflow file parses**

Run:
```bash
node -e "
const fs=require('fs');
const text=fs.readFileSync('.github/workflows/ci.yml','utf8');
if (!/^name:\s*CI/m.test(text)) throw new Error('missing name');
if (!/npm run lint/.test(text)) throw new Error('missing lint step');
if (!/npm test/.test(text)) throw new Error('missing test step');
if (!/npm run check:docs/.test(text)) throw new Error('missing check:docs step');
if (!/npm run build/.test(text)) throw new Error('missing build step');
console.log('workflow contains all four gates');
"
```
Expected: `workflow contains all four gates`.

CI itself cannot be verified without pushing, and nothing is pushed in this phase. Say so plainly in your report rather than claiming CI passes.

- [ ] **Step 3: Correct the package version**

`package.json` declares `"version": "1.0.0"`, but the roadmap reserves `v1.0` for Phase 7 go-live. Change it to:

```json
  "version": "0.1.0",
```

- [ ] **Step 4: Close the resolved issues**

In `docs/KNOWN-ISSUES.md`, move `PS-006`, `PS-010`, `PS-011`, and `PS-015` out of the open table and into the Resolved section, each with a one-line note on how it was resolved. Follow the format the existing Resolved entries use.

Add any `react-hooks/exhaustive-deps` warnings you recorded in Task 2 as a new issue row, using the next free `PS-` id, severity Low, planned phase 3. These are real but require behaviour-changing refactors that belong with the component work in Phase 3, not here.

- [ ] **Step 5: Update the command documentation**

Both files describe `npm run lint` as a script that does not lint. That is no longer true.

- `README.md` — its Scripts table must show `lint` running ESLint and add `test` and `test:watch`. The `dist/` warning attached to `lint` should now attach only to `build`, since `lint` no longer builds.
- `CLAUDE.md` — the Commands section needs the same correction, plus `npm test`. Its Documentation duties section should note that CI runs all four gates.

- [ ] **Step 6: Verify all gates**

Run:
```bash
npm run lint; echo "lint=$?"
npm test
npm run check:docs; echo "docs=$?"
git status --short
```
Expected: `lint=0`, all tests pass, `docs=0`, clean tree after commit.

- [ ] **Step 7: Confirm the documentation is now true**

Spot-check that the docs match reality:
```bash
grep -n '"lint"' package.json
grep -n "lint" README.md | head -5
grep -rn "PS-006\|PS-010\|PS-011\|PS-015" docs/KNOWN-ISSUES.md | head -8
```
Expected: `lint` maps to `eslint .`; the README describes it as linting; all four issue ids appear in the Resolved section rather than the open table.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/ci.yml package.json docs/KNOWN-ISSUES.md README.md CLAUDE.md
git commit -m "ci: run lint, test, docs, and build on every push and PR

Wires the four gates this phase created into GitHub Actions, so later
phases cannot merge past them.

Also closes PS-006, PS-010, PS-011, and PS-015, and corrects the package
version from 1.0.0 to 0.1.0 — the roadmap reserves v1.0 for the Phase 7
go-live, so the manifest was claiming a release that does not exist."
```

---

## Notes for the executor

- **Every task ends green on four gates.** `npm run lint`, `npm test`, `npm run check:docs`, and a clean `git status --short`. If any is red, the task is not finished.
- **Task 2's ESLint run is the red state.** The two `react-hooks/rules-of-hooks` errors must appear in Step 4 before you fix anything. If they do not, stop — the fix would be unverified.
- **Never disable a lint rule to make an error go away.** Fix the code, or report why the rule is wrong for this codebase.
- **`exhaustive-deps` warnings are out of scope here.** Record them; the final task files them as an issue for Phase 3. Chasing them now means behaviour-changing refactors without adequate test coverage.
- **Avoid `npm run build`.** `dist/` is committed and gitignored (`PS-019`), so a build creates spurious diffs. If you run one, clean up with `git checkout -- dist/` then `git clean -fx dist/`. After Task 2, `npm run lint` no longer builds, so this stops being a trap.
- **Do not touch `src/data/weddingData.js` content in Tasks 1–4.** Task 4 owns it, and it is a pure move.
- **Nothing is pushed in this phase.** CI is configured but unverified until the branch reaches GitHub. Report that honestly.
