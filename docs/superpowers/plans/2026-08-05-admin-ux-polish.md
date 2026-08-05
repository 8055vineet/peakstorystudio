# Admin UX Polish (Phase 3d, `v0.4d`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every inline media grid in the admin with a compact photo slot + full-screen picker dialog (with search), add thumbnails to list rows, and make navigation scroll to top and survive refresh.

**Architecture:** Two new presentational components (`MediaPickerDialog`, `MediaSlot`) compose the existing `MediaPicker` grid; every form that needs a photograph renders the slot instead of the grid. The query factory gains an optional server-side thumbnail join; `AdminDashboard` keeps its tab in the URL hash and a tiny hook resets scroll on navigation. No schema, RLS, or public-site changes.

**Tech Stack:** React 18, Tailwind (inline utilities, existing palette tokens), Vitest + Testing Library (jsdom), Supabase JS (query layer only).

**Spec:** `docs/superpowers/specs/2026-08-05-admin-ux-polish-design.md` — the authority when this plan is ambiguous.

## Global Constraints

- Plain JavaScript with `.jsx` for components. **No TypeScript.**
- Tailwind utilities inline on JSX; only existing palette tokens (`offwhite`, `pitch`, `charcoal`, `gold`); **never a new raw hex value**. `gold-*`/`font-cinzel` are fine here (admin-only) but must not enter `src/components/` or `src/pages/`.
- **Components never import the Supabase client.** Components call hooks; hooks call `src/lib/queries/*`. (`src/lib/mediaUrl.js` is safe — it reads only env.)
- New components stay presentational: data and lifecycle arrive as props; the only state a component may own is its own UI state (dialog open, search query).
- ESLint must pass with 0 errors and exactly the 2 tracked `useScrollReveal` warnings (`npm run lint`). The react-hooks purity rules are enforced: no `Math.random()`/`Date.now()` in render, no synchronous `setState` inside effects (use mount-fresh components or the reloadKey pattern instead).
- jsdom quirks: `localStorage`, `matchMedia` are stubbed and `window.scrollTo` is no-op'd in `src/test/setup.js` — tests may `vi.spyOn(window, 'scrollTo')`.
- `mediaUrl(path)` passes through paths starting with `/` or `http(s)://` unchanged and returns `null` for bucket keys when `VITE_MEDIA_BASE_URL` is unset — test fixtures use `/images/...` paths so image rendering is deterministic without env stubs.
- Conventional Commits; work only on `phase-3d/admin-ux-polish`; never commit to `main`.
- **Run `npm run lint` and `npm test` as standalone commands (not `;`-chained) before every commit.** Two pre-existing typing-timing tests (UploadField alt-text, BookingForm WhatsApp prefill) can flake under parallel load — if one fails, rerun that file alone before assuming breakage.
- Copy rules from the spec, verbatim: empty slot text "No photograph yet"; buttons "Choose photograph" / "Change" / "Remove"; dialog default title "Choose a photograph"; wedding dialog title "Add photographs to this wedding" with `closeLabel` "Done"; count line "{filtered} of {total} photographs"; zero-match copy `No photographs match “{query}”.`

---

### Task 1: MediaPicker — `selectedIds`, `gridClass`, image-as-button

**Files:**
- Modify: `src/admin/MediaPicker.jsx`
- Test: `src/admin/__tests__/MediaPicker.test.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `MediaPicker` accepts three new optional props — `selectedIds` (array of media ids; a tile is highlighted when its id matches `selectedId` OR is in `selectedIds`), `gridClass` (string, default `'grid grid-cols-2 sm:grid-cols-3 gap-4'`, applied to the `<ul>`), and (behaviour, not prop) when `onSelect` is present the tile's image area is itself a `<button>` with accessible name `` `Select photograph: ${item.altText || 'Untitled photograph'}` `` that calls `onSelect(item)`. Tasks 2 and 6 rely on all three.

- [ ] **Step 1: Update the two existing tests that count Select buttons, and add three failing tests**

In `src/admin/__tests__/MediaPicker.test.jsx`:

1. In `'renders one entry per media row'`, the image buttons will double the `/select/i` matches. Replace the assertion:

```js
    expect(screen.getAllByRole('button', { name: /^select$/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /select photograph:/i })).toHaveLength(2);
```

2. `'marks the currently selected item so a click gives visible confirmation'` still passes unchanged (`/✓ selected/i` only ever names the text button) — leave it alone.

3. Append to the existing `describe('MediaPicker selection affordances', ...)` block:

```js
  it('highlights every id in selectedIds, for multi-attach callers', async () => {
    await renderPicker({
      items: ITEMS2, status: 'ready', error: null, onRetry: vi.fn(), onSelect: vi.fn(), selectedIds: ['m-1', 'm-2'],
    });
    expect(screen.getAllByRole('button', { name: /✓ selected/i })).toHaveLength(2);
  });

  it('makes the photograph itself a select control when onSelect is provided', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onSelect = vi.fn();
    await renderPicker({
      items: ITEMS2, status: 'ready', error: null, onRetry: vi.fn(), onSelect,
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /select photograph: one/i }));
    expect(onSelect).toHaveBeenCalledWith(ITEMS2[0]);
  });

  it('renders no image button at all without onSelect', async () => {
    await renderPicker({ items: ITEMS2, status: 'ready', error: null, onRetry: vi.fn() });
    expect(screen.queryByRole('button', { name: /select photograph:/i })).toBeNull();
  });

  it('applies a caller-supplied gridClass to the grid', async () => {
    await renderPicker({
      items: ITEMS2, status: 'ready', error: null, onRetry: vi.fn(), onSelect: vi.fn(), gridClass: 'grid grid-cols-6 gap-4',
    });
    expect(screen.getByRole('list')).toHaveClass('grid-cols-6');
  });
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/admin/__tests__/MediaPicker.test.jsx`
Expected: the four new/updated tests FAIL (no image buttons, no `gridClass` support yet); the rest pass.

- [ ] **Step 3: Implement in `src/admin/MediaPicker.jsx`**

Change the signature and the `<ul>`/tile rendering (error/loading/empty branches stay identical):

```jsx
export default function MediaPicker({
  items, status, error, onRetry, onSelect, selectedId, selectedIds, onAddToGallery,
  gridClass = 'grid grid-cols-2 sm:grid-cols-3 gap-4',
}) {
```

Replace `<ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">` with `<ul className={gridClass}>`.

Inside the map, replace the `isSelected` line and the image `<div>` with:

```jsx
        const isSelected = (selectedId != null && item.id === selectedId)
          || Boolean(selectedIds?.includes(item.id));
        const preview = url ? (
          <img
            src={url}
            alt={item.altText || 'Untitled photograph'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 p-2 text-center">
            <ImageOff className="w-6 h-6 text-charcoal-500" aria-hidden="true" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-charcoal-700">
              No Preview
            </span>
            <span className="text-[9px] text-charcoal-500">
              VITE_MEDIA_BASE_URL is not set
            </span>
          </div>
        );
```

and render the image area as a button when selectable (in a full-screen picker the natural gesture is clicking the photo, not the small button under it):

```jsx
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(item)}
                aria-pressed={isSelected}
                aria-label={`Select photograph: ${item.altText || 'Untitled photograph'}`}
                className="w-full aspect-square bg-offwhite-200 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-pitch-900/40"
              >
                {preview}
              </button>
            ) : (
              <div className="aspect-square bg-offwhite-200 flex items-center justify-center">
                {preview}
              </div>
            )}
```

Keep the `p-2` footer block (alt-text badge, Add to Gallery, Select button) exactly as is.

- [ ] **Step 4: Run the file's tests, then lint**

Run: `npx vitest run src/admin/__tests__/MediaPicker.test.jsx` — all pass.
Run: `npm run lint` — 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/MediaPicker.jsx src/admin/__tests__/MediaPicker.test.jsx
git commit -m "feat(admin): MediaPicker gains selectedIds, gridClass, and clickable photographs"
```

---

### Task 2: MediaPickerDialog — the full-screen picker overlay

**Files:**
- Create: `src/admin/MediaPickerDialog.jsx`
- Test: `src/admin/__tests__/MediaPickerDialog.test.jsx`

**Interfaces:**
- Consumes: `MediaPicker` (Task 1: `selectedIds`, `gridClass`), `UploadField` (existing: `{ onUploaded }`).
- Produces: `MediaPickerDialog({ open, title, items, status, error, onRetry, onUploaded, onSelect, onClose, selectedId, selectedIds, closeLabel = 'Cancel' })`. Renders `null` when `open` is false. Calls `onSelect(media)` on tile click **without closing itself** — callers close (or don't) in their handler. Esc / ✕ / footer button call `onClose`. Tasks 3 and 6 mount it.

- [ ] **Step 1: Write the failing test file**

`src/admin/__tests__/MediaPickerDialog.test.jsx`:

```jsx
import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The dialog embeds UploadField; its pipeline is proven elsewhere
// (useMediaUpload.test.jsx, UploadField.test.jsx) — mocked here exactly as
// ResourceForm.test.jsx mocks it, for the same reason.
const useMediaUpload = vi.fn();
vi.mock('../../hooks/useMediaUpload', () => ({
  useMediaUpload: (...args) => useMediaUpload(...args),
}));

const { default: MediaPickerDialog } = await import('../MediaPickerDialog.jsx');

// `/images/...` paths pass straight through mediaUrl() regardless of
// VITE_MEDIA_BASE_URL, so these tests never depend on env stubbing.
const ITEMS = [
  {
    id: 'm-1', storagePath: '/images/test/sunset.jpg', altText: 'Sunset couple', createdAt: '2026-08-02T10:00:00Z',
  },
  {
    id: 'm-2', storagePath: '/images/test/haldi-turmeric.jpg', altText: '', createdAt: '2026-08-01T10:00:00Z',
  },
];

beforeEach(() => {
  useMediaUpload.mockReset();
  useMediaUpload.mockReturnValue({
    status: 'idle', progress: 0, error: null, upload: vi.fn(), reset: vi.fn(),
  });
  document.body.style.overflow = '';
});

function baseProps(overrides = {}) {
  return {
    open: true,
    title: 'Choose a photograph',
    items: ITEMS,
    status: 'ready',
    error: null,
    onRetry: vi.fn(),
    onUploaded: vi.fn(),
    onSelect: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('MediaPickerDialog', () => {
  it('renders nothing at all when closed', () => {
    render(<MediaPickerDialog {...baseProps({ open: false })} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders a labelled modal dialog with search, upload, and the grid, and focuses the search box', () => {
    render(<MediaPickerDialog {...baseProps()} />);
    const dialog = screen.getByRole('dialog', { name: 'Choose a photograph' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(screen.getByLabelText(/photograph/i)).toHaveAttribute('type', 'file');
    expect(screen.getAllByRole('button', { name: /select photograph:/i })).toHaveLength(2);
    expect(screen.getByText('2 of 2 photographs')).toBeInTheDocument();
  });

  it('locks body scroll while open and restores it on unmount', () => {
    const { unmount } = render(<MediaPickerDialog {...baseProps()} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('filters by alt text as you type, with a live count', async () => {
    const user = userEvent.setup();
    render(<MediaPickerDialog {...baseProps()} />);
    await user.type(screen.getByRole('searchbox'), 'sunset');
    expect(screen.getAllByRole('button', { name: /select photograph:/i })).toHaveLength(1);
    expect(screen.getByText('1 of 2 photographs')).toBeInTheDocument();
  });

  it('filters by file name too, for photographs with no alt text', async () => {
    const user = userEvent.setup();
    render(<MediaPickerDialog {...baseProps()} />);
    await user.type(screen.getByRole('searchbox'), 'haldi');
    expect(screen.getAllByRole('button', { name: /select photograph:/i })).toHaveLength(1);
  });

  it('shows a zero-match message distinct from the empty-library state', async () => {
    const user = userEvent.setup();
    render(<MediaPickerDialog {...baseProps()} />);
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText(/no photographs match/i)).toBeInTheDocument();
    expect(screen.queryByText(/no media yet/i)).toBeNull();
  });

  it('calls onSelect on a tile click and does NOT close itself', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<MediaPickerDialog {...props} />);
    await user.click(screen.getByRole('button', { name: /select photograph: sunset couple/i }));
    expect(props.onSelect).toHaveBeenCalledWith(ITEMS[0]);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape, on the ✕ control, and on the footer button — whose label the caller sets', async () => {
    const user = userEvent.setup();
    const props = baseProps({ closeLabel: 'Done' });
    render(<MediaPickerDialog {...props} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  it('passes the load-error state through with its retry control', () => {
    const props = baseProps({ items: [], status: 'error', error: new Error('permission denied') });
    render(<MediaPickerDialog {...props} />);
    expect(screen.getByText(/could not load media/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/admin/__tests__/MediaPickerDialog.test.jsx`
Expected: FAIL — cannot resolve `../MediaPickerDialog.jsx`.

- [ ] **Step 3: Implement `src/admin/MediaPickerDialog.jsx`**

```jsx
import {
  useEffect, useId, useRef, useState,
} from 'react';
import { X } from 'lucide-react';
import MediaPicker from './MediaPicker.jsx';
import UploadField from './UploadField.jsx';

// The full-screen "choose a photograph" overlay every media-picking flow in
// this admin opens instead of embedding the library grid inline — the fix
// for the owner's "the form is at the bottom of 65 tiles" complaint.
// Presentational like MediaPicker itself: items and their load lifecycle
// arrive as props, and this file never fetches.
//
// Split into a mount-fresh inner component so open/close needs no effects
// that write state: the outer function renders null when closed, so every
// open mounts DialogInner from scratch — search resets, focus and the body
// scroll-lock run as plain mount/unmount effects, and there is nothing to
// synchronise. onSelect deliberately does NOT close the dialog — a
// single-pick caller closes in its own handler, and WeddingPhotos keeps it
// open on purpose to attach several photographs in one visit.

const DIALOG_GRID = 'grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4';

function fileName(storagePath) {
  return String(storagePath ?? '').split('/').pop() ?? '';
}

function matches(item, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (item.altText ?? '').toLowerCase().includes(q)
    || fileName(item.storagePath).toLowerCase().includes(q);
}

function DialogInner({
  title, items, status, error, onRetry, onUploaded, onSelect, onClose,
  selectedId, selectedIds, closeLabel,
}) {
  const [query, setQuery] = useState('');
  const headingId = useId();
  const searchRef = useRef(null);
  // Kept current via effect (never written during render, per the purity
  // rules) so the mount-only listener effect below never has to re-run —
  // re-running it would re-capture "previously focused" as the search box.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    searchRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event) {
      if (event.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  const filtered = items.filter((item) => matches(item, query));
  const activeQuery = query.trim();
  const zeroMatches = Boolean(activeQuery) && filtered.length === 0
    && items.length > 0 && status !== 'error';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      className="fixed inset-0 z-50 bg-offwhite-100 text-pitch-900 flex flex-col"
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-pitch-900/10">
        <h2 id={headingId} className="font-cinzel text-lg font-bold text-pitch-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-2 rounded-lg border border-pitch-900/20 text-pitch-900 hover:bg-offwhite-200 transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>
      <div className="px-6 py-4 border-b border-pitch-900/10 space-y-3">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by alt text or file name…"
          aria-label="Search photographs"
          className="w-full max-w-md px-4 py-2.5 rounded-lg bg-offwhite-50 border border-pitch-900/15 text-sm text-pitch-900 focus:outline-none focus:border-pitch-900"
        />
        {items.length > 0 && status !== 'error' && (
          <p className="text-xs text-charcoal-500">
            {filtered.length} of {items.length} photographs
          </p>
        )}
        <UploadField onUploaded={onUploaded} />
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {zeroMatches ? (
          <p className="p-8 text-center text-sm text-charcoal-700">
            No photographs match &ldquo;{activeQuery}&rdquo;.
          </p>
        ) : (
          <MediaPicker
            items={filtered}
            status={status}
            error={error}
            onRetry={onRetry}
            onSelect={onSelect}
            selectedId={selectedId}
            selectedIds={selectedIds}
            gridClass={DIALOG_GRID}
          />
        )}
      </div>
      <footer className="px-6 py-4 border-t border-pitch-900/10">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-3 rounded-lg border border-pitch-900/20 text-pitch-900 text-xs uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors"
        >
          {closeLabel}
        </button>
      </footer>
    </div>
  );
}

export default function MediaPickerDialog({
  open, closeLabel = 'Cancel', ...props
}) {
  if (!open) return null;
  return <DialogInner closeLabel={closeLabel} {...props} />;
}
```

- [ ] **Step 4: Run the file's tests, then lint**

Run: `npx vitest run src/admin/__tests__/MediaPickerDialog.test.jsx` — all pass.
Run: `npm run lint` — 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/MediaPickerDialog.jsx src/admin/__tests__/MediaPickerDialog.test.jsx
git commit -m "feat(admin): full-screen media picker dialog with search"
```

---

### Task 3: MediaSlot — the compact in-form photo control

**Files:**
- Create: `src/admin/MediaSlot.jsx`
- Test: `src/admin/__tests__/MediaSlot.test.jsx`

**Interfaces:**
- Consumes: `MediaPickerDialog` (Task 2), `mediaUrl` from `src/lib/mediaUrl.js`.
- Produces: `MediaSlot({ label, help = null, required = false, error = null, value, media, mediaStatus, mediaError, onRetryMedia, onUploaded, onChange })`. `value` is a media id or null. `onChange(mediaId | null)`. Renders a `fieldset`/`legend`. Tasks 4 and 5 mount it.

- [ ] **Step 1: Write the failing test file**

`src/admin/__tests__/MediaSlot.test.jsx`:

```jsx
import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useMediaUpload = vi.fn();
vi.mock('../../hooks/useMediaUpload', () => ({
  useMediaUpload: (...args) => useMediaUpload(...args),
}));

const { default: MediaSlot } = await import('../MediaSlot.jsx');

// `/images/...` paths pass through mediaUrl() untouched — no env stubbing.
const MEDIA = [
  { id: 'm-1', storagePath: '/images/test/one.jpg', altText: 'One' },
  { id: 'm-2', storagePath: '/images/test/two.jpg', altText: 'Two' },
];

beforeEach(() => {
  useMediaUpload.mockReset();
  useMediaUpload.mockReturnValue({
    status: 'idle', progress: 0, error: null, upload: vi.fn(), reset: vi.fn(),
  });
});

function baseProps(overrides = {}) {
  return {
    label: 'Cover Photo',
    help: null,
    required: false,
    error: null,
    value: null,
    media: MEDIA,
    mediaStatus: 'ready',
    mediaError: null,
    onRetryMedia: vi.fn(),
    onUploaded: vi.fn(),
    onChange: vi.fn(),
    ...overrides,
  };
}

describe('MediaSlot', () => {
  it('renders an empty slot with a Choose control and never an inline grid', () => {
    render(<MediaSlot {...baseProps()} />);
    expect(screen.getByRole('group', { name: /cover photo/i })).toBeInTheDocument();
    expect(screen.getByText(/no photograph yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose photograph/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: /select photograph:/i })).toBeNull();
  });

  it('shows the chosen photograph as a thumbnail with Change and Remove controls', () => {
    render(<MediaSlot {...baseProps({ value: 'm-1' })} />);
    expect(screen.getByAltText('One')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('offers no Remove on a required slot', () => {
    render(<MediaSlot {...baseProps({ value: 'm-1', required: true })} />);
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });

  it('falls back to the media id when the library cannot resolve it yet', () => {
    render(<MediaSlot {...baseProps({ value: 'm-unknown', media: [] })} />);
    expect(screen.getByText(/selected media id: m-unknown/i)).toBeInTheDocument();
  });

  it('opens the dialog, selects a photograph, closes, and reports the id', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<MediaSlot {...props} />);
    await user.click(screen.getByRole('button', { name: /choose photograph/i }));
    expect(screen.getByRole('dialog', { name: 'Choose a photograph' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /select photograph: two/i }));
    expect(props.onChange).toHaveBeenCalledWith('m-2');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clears to null on Remove', async () => {
    const user = userEvent.setup();
    const props = baseProps({ value: 'm-1' });
    render(<MediaSlot {...props} />);
    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(props.onChange).toHaveBeenCalledWith(null);
  });

  it('auto-selects a fresh upload and closes the dialog', async () => {
    const upload = vi.fn().mockResolvedValue({ id: 'media-new', storagePath: 'uploads/new.webp' });
    useMediaUpload.mockReturnValue({
      status: 'idle', progress: 0, error: null, upload, reset: vi.fn(),
    });
    const user = userEvent.setup();
    const props = baseProps();
    render(<MediaSlot {...props} />);
    await user.click(screen.getByRole('button', { name: /choose photograph/i }));
    const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/photograph/i), file);
    expect(props.onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'media-new' }));
    expect(props.onChange).toHaveBeenCalledWith('media-new');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders a field error inline as an alert', () => {
    render(<MediaSlot {...baseProps({ error: 'Photograph is required.' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/photograph is required/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/admin/__tests__/MediaSlot.test.jsx`
Expected: FAIL — cannot resolve `../MediaSlot.jsx`.

- [ ] **Step 3: Implement `src/admin/MediaSlot.jsx`**

```jsx
import { useId, useState } from 'react';
import { mediaUrl } from '../lib/mediaUrl.js';
import MediaPickerDialog from './MediaPickerDialog.jsx';

// The compact control every form renders where it used to embed the whole
// media grid: a thumbnail of the chosen photograph plus Choose/Change (and,
// on optional slots, Remove). The library itself only ever appears inside
// the MediaPickerDialog this opens, so a form's own fields never sit below
// 65 tiles again. Presentational: the media list and its lifecycle arrive
// as props; the ONE piece of state this owns is whether its dialog is open.
const BUTTON_CLASS = 'px-4 py-2 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors';

export default function MediaSlot({
  label, help = null, required = false, error = null, value,
  media, mediaStatus, mediaError, onRetryMedia, onUploaded, onChange,
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const errorId = useId();
  const selected = media.find((item) => item.id === value);
  const url = selected ? mediaUrl(selected.storagePath) : null;

  return (
    <fieldset
      className="border border-pitch-900/10 rounded-xl p-4 space-y-3"
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-semibold">
        {label}{required && ' *'}
      </legend>
      {help && <p className="text-xs text-charcoal-500">{help}</p>}
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-offwhite-200 border border-pitch-900/10 flex items-center justify-center">
          {value ? (
            url ? (
              <img
                src={url}
                alt={selected?.altText || 'Selected photograph'}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="p-2 text-[9px] text-charcoal-700 text-center break-all">
                Selected media id: {value}
              </span>
            )
          ) : (
            <span className="p-2 text-[9px] font-bold uppercase tracking-widest text-charcoal-700 text-center">
              No photograph yet
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setDialogOpen(true)} className={BUTTON_CLASS}>
            {value ? 'Change' : 'Choose photograph'}
          </button>
          {value && !required && (
            <button type="button" onClick={() => onChange(null)} className={BUTTON_CLASS}>
              Remove
            </button>
          )}
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs font-semibold text-pitch-900">{error}</p>
      )}
      <MediaPickerDialog
        open={dialogOpen}
        title="Choose a photograph"
        items={media}
        status={mediaStatus}
        error={mediaError}
        onRetry={onRetryMedia}
        selectedId={value}
        onSelect={(item) => { onChange(item.id); setDialogOpen(false); }}
        onUploaded={(uploaded) => {
          onUploaded?.(uploaded);
          onChange(uploaded.id);
          setDialogOpen(false);
        }}
        onClose={() => setDialogOpen(false)}
      />
    </fieldset>
  );
}
```

- [ ] **Step 4: Run the file's tests, then lint**

Run: `npx vitest run src/admin/__tests__/MediaSlot.test.jsx` — all pass.
Run: `npm run lint` — 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/MediaSlot.jsx src/admin/__tests__/MediaSlot.test.jsx
git commit -m "feat(admin): compact MediaSlot control opening the picker dialog"
```

---

### Task 4: ResourceForm's media field becomes a MediaSlot

**Files:**
- Modify: `src/admin/ResourceForm.jsx` (the `MediaField` function and imports only)
- Test: `src/admin/__tests__/ResourceForm.test.jsx`, `src/admin/__tests__/App.test.jsx` (one assertion)

**Interfaces:**
- Consumes: `MediaSlot` (Task 3).
- Produces: no API change — `ResourceForm`'s props and the resource-config contract are untouched. Gallery/weddings/films forms all pick up the slot through this one function.

- [ ] **Step 1: Update the tests**

In `src/admin/__tests__/ResourceForm.test.jsx`:

1. Add `act` to the `@testing-library/react` import.
2. Change `MEDIA_ITEMS[0].storagePath` from `'uploads/one.webp'` to `'/images/test/one.webp'` (passthrough → the slot's thumbnail renders deterministically without env stubs).
3. The old flush idiom `await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());` appears six times (in `renders a labelled control…`, `wires every label…`, both `initial changes…` tests, `clears every blank optional field…`, and the misconfigured-config test). The inline grid is gone, so replace **every occurrence** with the microtask flush App.test.jsx already uses:

```js
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
```

4. In `'renders a labelled control for every field type'`, replace the two media-field assertions (`getByLabelText(/photograph/i)` file input + the waitFor) with:

```js
    expect(screen.getByRole('group', { name: /cover photo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose photograph/i })).toBeInTheDocument();
    // The library never renders inline in the form any more.
    expect(screen.queryByRole('button', { name: /select photograph:/i })).toBeNull();
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
```

5. Append a new describe block:

```js
describe('media field via the picker dialog', () => {
  it('opens the dialog, selects a photograph, closes, and submits its id', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ResourceForm {...baseProps({ onSubmit })} />);

    await user.type(screen.getByLabelText(/^name/i), 'Widget One');
    await user.selectOptions(screen.getByLabelText(/category/i), 'a');

    await user.click(screen.getByRole('button', { name: /choose photograph/i }));
    expect(screen.getByRole('dialog', { name: 'Choose a photograph' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /select photograph: a couple at dusk/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByAltText('A couple at dusk.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^(save|create)/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ coverMediaId: 'media-1' }));
  });
});
```

In `src/admin/__tests__/App.test.jsx`, the `'Add to Gallery jumps straight into a pre-filled Add Gallery Photo form'` test's final assertion changes from the old `✓ selected` button to the slot's rendering (the fixture's `storagePath` is already a passthrough `/images/...` path):

```js
      // Lands on the Gallery tab's create form with that photograph already
      // in the slot — thumbnail plus a Change control, no inline grid.
      expect(screen.getByRole('heading', { name: /add gallery photo/i })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByAltText('Bride among leaves')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
```

- [ ] **Step 2: Run to verify the updated tests fail against the old inline grid**

Run: `npx vitest run src/admin/__tests__/ResourceForm.test.jsx`
Expected: the new dialog test and the reworked assertions FAIL (no "Choose photograph" button exists yet).

- [ ] **Step 3: Implement in `src/admin/ResourceForm.jsx`**

Replace the imports of `MediaPicker` and `UploadField` with:

```jsx
import MediaSlot from './MediaSlot.jsx';
```

Replace the entire `MediaField` function body (keep its name and the comment above it, updating the comment's second sentence to say it now renders the compact `MediaSlot`, whose dialog owns the grid):

```jsx
function MediaField({
  field, value, error, onChange, mediaResource,
}) {
  const {
    items, status, error: loadError, reload,
  } = mediaResource;
  return (
    <MediaSlot
      label={field.label}
      help={field.help}
      required={field.required}
      error={error}
      value={value || null}
      media={items}
      mediaStatus={status}
      mediaError={loadError}
      onRetryMedia={reload}
      onUploaded={() => reload()}
      onChange={onChange}
    />
  );
}
```

Everything else in the file — `buildInitialValues`, validation, `buildPayload`, the media `useResource` fetch — stays byte-for-byte identical.

- [ ] **Step 4: Run the two affected files, then lint**

Run: `npx vitest run src/admin/__tests__/ResourceForm.test.jsx src/admin/__tests__/App.test.jsx` — all pass.
Run: `npm run lint` — 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/ResourceForm.jsx src/admin/__tests__/ResourceForm.test.jsx src/admin/__tests__/App.test.jsx
git commit -m "feat(admin): media fields use the compact slot + dialog instead of an inline grid"
```

---

### Task 5: SettingsForm — three compact slots

**Files:**
- Modify: `src/admin/SettingsForm.jsx`
- Test: `src/admin/__tests__/SettingsForm.test.jsx`

**Interfaces:**
- Consumes: `MediaSlot` (Task 3). `SettingsForm`'s own props are unchanged.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Update the tests**

In `src/admin/__tests__/SettingsForm.test.jsx`, add `within` to the `@testing-library/react` import, then replace the `'highlights the currently selected photograph in each of the three image slots'` test with:

```js
  it('shows each image slot as a compact thumbnail control — never an inline grid', async () => {
    await renderForm();
    expect(screen.getByAltText('Hero')).toBeInTheDocument();
    expect(screen.getByAltText('Portrait')).toBeInTheDocument();
    expect(screen.getByAltText('Closing')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^change$/i })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /^select$/i })).toBeNull();
  });

  it('changes the hero slot through the picker dialog and submits the new id', async () => {
    const { props } = await renderForm();
    fireEvent.click(screen.getAllByRole('button', { name: /^change$/i })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Choose a photograph' });
    fireEvent.click(within(dialog).getByRole('button', { name: /select photograph: portrait/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(props.onSave.mock.calls[0][0]).toMatchObject({ heroMediaId: 'm-brand' });
  });

  it('removes the hero photograph and submits null, falling back to the shipped image', async () => {
    const { props } = await renderForm();
    fireEvent.click(screen.getAllByRole('button', { name: /^remove$/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(props.onSave.mock.calls[0][0]).toMatchObject({ heroMediaId: null });
  });
```

(The `IMAGE_SLOTS` order — hero, brand story, closing — makes index `[0]` the hero slot; the existing `MEDIA` fixture's `/images/home/...` paths pass through `mediaUrl` untouched. SettingsForm still needs `useMediaUpload` mocked: the dialog embeds UploadField. Add to the top of the file, below the existing `beforeEach`:)

```js
vi.mock('../../hooks/useMediaUpload', () => ({
  useMediaUpload: () => ({
    status: 'idle', progress: 0, error: null, upload: vi.fn(), reset: vi.fn(),
  }),
}));
```

- [ ] **Step 2: Run to verify the updated tests fail**

Run: `npx vitest run src/admin/__tests__/SettingsForm.test.jsx`
Expected: the three slot tests FAIL (no Change buttons yet); the text-field tests still pass.

- [ ] **Step 3: Implement in `src/admin/SettingsForm.jsx`**

Replace the `MediaPicker`/`UploadField` imports with `import MediaSlot from './MediaSlot.jsx';` and replace the whole `IMAGE_SLOTS.map(...)` fieldset block with:

```jsx
        {IMAGE_SLOTS.map(({ key, label, help }) => (
          <MediaSlot
            key={key}
            label={label}
            help={help}
            required={false}
            value={values[key] ?? null}
            media={media}
            mediaStatus={mediaStatus}
            mediaError={mediaError}
            onRetryMedia={onRetryMedia}
            onUploaded={onUploaded}
            onChange={(next) => set(key, next)}
          />
        ))}
```

All three media columns are nullable and `src/lib/queries/siteSettings.js` falls back to the shipped static image on null — which is why every slot keeps Remove.

- [ ] **Step 4: Run the file's tests, then lint**

Run: `npx vitest run src/admin/__tests__/SettingsForm.test.jsx` — all pass.
Run: `npm run lint` — 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/SettingsForm.jsx src/admin/__tests__/SettingsForm.test.jsx
git commit -m "feat(admin): Settings image slots become compact controls (~195 tiles -> 3 thumbnails)"
```

---

### Task 6: WeddingPhotos — multi-attach through the dialog

**Files:**
- Modify: `src/admin/WeddingPhotos.jsx`
- Test: `src/admin/__tests__/WeddingPhotos.test.jsx`

**Interfaces:**
- Consumes: `MediaPickerDialog` (Task 2: `selectedIds`, `closeLabel`, stays-open-on-select).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Update the tests**

In `src/admin/__tests__/WeddingPhotos.test.jsx`, inside `describe('adding a photograph', ...)`, replace both existing tests with these three:

```js
    it('adds one selected in the picker dialog, which stays open for more', async () => {
      const user = userEvent.setup();
      listMedia.mockResolvedValue([LIBRARY_ITEM]);
      listWeddingPhotos.mockResolvedValueOnce([]);
      addWeddingPhoto.mockResolvedValue({ weddingId: 'wedding-1', mediaId: 'media-c', sortOrder: 0 });

      await renderWeddingPhotos();
      await waitFor(() => expect(screen.getByText(/no photographs attached/i)).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /add photographs/i }));
      const dialog = await screen.findByRole('dialog', { name: /add photographs to this wedding/i });

      listWeddingPhotos.mockResolvedValueOnce([{ ...LIBRARY_ITEM, mediaId: 'media-c', sortOrder: 0, altText: 'Photo C' }]);
      await user.click(await within(dialog).findByRole('button', { name: /^select$/i }));

      expect(addWeddingPhoto).toHaveBeenCalledWith('wedding-1', 'media-c');
      // Deliberately still open: attaching several photos is one visit.
      expect(screen.getByRole('dialog', { name: /add photographs to this wedding/i })).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Done' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      await waitFor(() => expect(attachedPhotoImages()).toHaveLength(1));
    });

    it('shows an already-attached photograph as selected and never adds it twice', async () => {
      const user = userEvent.setup();
      listMedia.mockResolvedValue([{ ...LIBRARY_ITEM, id: 'media-a', storagePath: 'uploads/a.webp', altText: 'Photo A' }]);
      listWeddingPhotos.mockResolvedValue([PHOTO_A]);

      await renderWeddingPhotos();
      await waitFor(() => expect(attachedPhotoImages()).toHaveLength(1));

      await user.click(screen.getByRole('button', { name: /add photographs/i }));
      const dialog = await screen.findByRole('dialog', { name: /add photographs to this wedding/i });

      await user.click(await within(dialog).findByRole('button', { name: /✓ selected/i }));
      expect(addWeddingPhoto).not.toHaveBeenCalled();
    });

    it('adds one uploaded fresh from inside the dialog', async () => {
      const upload = vi.fn().mockResolvedValue({ id: 'media-new', storagePath: 'uploads/new.webp' });
      useMediaUpload.mockReturnValue({
        status: 'idle', progress: 0, error: null, upload, reset: vi.fn(),
      });
      addWeddingPhoto.mockResolvedValue({ weddingId: 'wedding-1', mediaId: 'media-new', sortOrder: 0 });
      const user = userEvent.setup();

      await renderWeddingPhotos();
      await waitFor(() => expect(screen.getByText(/no photographs attached/i)).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: /add photographs/i }));

      const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(screen.getByLabelText(/photograph/i), file);

      await waitFor(() => expect(addWeddingPhoto).toHaveBeenCalledWith('wedding-1', 'media-new'));
    });
```

- [ ] **Step 2: Run to verify the updated tests fail**

Run: `npx vitest run src/admin/__tests__/WeddingPhotos.test.jsx`
Expected: the three reworked tests FAIL (no "Add photographs" button yet); the list/remove/reorder tests still pass.

- [ ] **Step 3: Implement in `src/admin/WeddingPhotos.jsx`**

Replace the `MediaPicker`/`UploadField` imports with `import MediaPickerDialog from './MediaPickerDialog.jsx';`, add dialog state next to the existing action state:

```jsx
  const [pickerOpen, setPickerOpen] = useState(false);
```

and replace the entire final `<div>` ("Add a Photograph" heading + `UploadField` + `MediaPicker`) with:

```jsx
      <div>
        <h3 className="text-xs uppercase tracking-widest text-charcoal-500 font-bold mb-4">Add Photographs</h3>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="px-6 py-3 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors"
        >
          Add photographs
        </button>
        {/* Stays open across selections on purpose: attaching a wedding's
            photos is a batch, and already-attached ones read "✓ Selected"
            via selectedIds so a second click is a visible no-op, never a
            duplicate wedding_photos row. */}
        <MediaPickerDialog
          open={pickerOpen}
          title="Add photographs to this wedding"
          items={mediaResource.items}
          status={mediaResource.status}
          error={mediaResource.error}
          onRetry={mediaResource.reload}
          selectedIds={sorted.map((photo) => photo.mediaId)}
          onSelect={(media) => {
            if (!sorted.some((photo) => photo.mediaId === media.id)) handleAdd(media.id);
          }}
          onUploaded={(media) => { handleAdd(media.id); mediaResource.reload(); }}
          onClose={() => setPickerOpen(false)}
          closeLabel="Done"
        />
      </div>
```

- [ ] **Step 4: Run the file's tests, then lint**

Run: `npx vitest run src/admin/__tests__/WeddingPhotos.test.jsx` — all pass.
Run: `npm run lint` — 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/WeddingPhotos.jsx src/admin/__tests__/WeddingPhotos.test.jsx
git commit -m "feat(admin): wedding photos attach in batches through the picker dialog"
```

---

### Task 7: List thumbnails — factory join, configs, ResourceList column

**Files:**
- Modify: `src/lib/queries/adminContent.js`, `src/admin/resources/gallery.js`, `src/admin/resources/weddings.js`, `src/admin/resources/films.js`, `src/admin/ResourceList.jsx`
- Test: `src/lib/queries/__tests__/adminContent.test.js`, `src/admin/__tests__/ResourceList.test.jsx`

**Interfaces:**
- Consumes: existing `makeResourceQueries(table, columns)` and `rowToItem`/`valuesToRow`; `mediaUrl`.
- Produces: `makeResourceQueries(table, columns, options = {})` where `options.thumbnailColumn` (snake_case FK column onto `media`, e.g. `'media_id'`) appends `, thumbnail:{thumbnailColumn}(storage_path)` to every select and maps `item.thumbnailPath` (string | null). Resource configs gain a matching top-level `thumbnailColumn` key that `ResourceList` reads to render the leading photo column. Testimonials declares nothing and is untouched.

- [ ] **Step 1: Write the failing factory tests**

Append to `src/lib/queries/__tests__/adminContent.test.js` (inside the top-level `describe('makeResourceQueries', ...)`):

```js
  describe('thumbnailColumn option', () => {
    const THUMB_COLUMNS = ['id', 'name', 'media_id', 'sort_order', 'status'];
    const THUMB_ROW = {
      id: 'widget-1', name: 'Gadget', media_id: 'm-1', sort_order: 0, status: 'draft', thumbnail: { storage_path: 'uploads/one.webp' },
    };

    it('appends the media embed to the select and maps thumbnailPath', async () => {
      const chain = makeSelectChain({ rows: [THUMB_ROW] });
      mockFrom.mockReturnValue(chain);
      const { list } = makeResourceQueries(TABLE, THUMB_COLUMNS, { thumbnailColumn: 'media_id' });

      const result = await list();

      expect(chain.select).toHaveBeenCalledWith('id, name, media_id, sort_order, status, thumbnail:media_id(storage_path)');
      expect(result[0].thumbnailPath).toBe('uploads/one.webp');
    });

    it('maps a missing embed to thumbnailPath null', async () => {
      mockFrom.mockReturnValue(makeSelectChain({ rows: [{ ...THUMB_ROW, thumbnail: null }] }));
      const { list } = makeResourceQueries(TABLE, THUMB_COLUMNS, { thumbnailColumn: 'media_id' });

      const result = await list();

      expect(result[0].thumbnailPath).toBeNull();
    });

    it('never writes thumbnailPath back on create', async () => {
      const chain = makeInsertChain({ row: THUMB_ROW });
      mockFrom.mockReturnValue(chain);
      const { create } = makeResourceQueries(TABLE, THUMB_COLUMNS, { thumbnailColumn: 'media_id' });

      await create({ name: 'Gadget', thumbnailPath: 'uploads/evil.webp' });

      expect(chain.insert).toHaveBeenCalledWith({ name: 'Gadget', status: 'draft' });
    });

    it('without the option, selects stay exactly as before', async () => {
      const chain = makeSelectChain({ rows: [ROW] });
      mockFrom.mockReturnValue(chain);
      const { list } = makeResourceQueries(TABLE, COLUMNS);

      await list();

      expect(chain.select).toHaveBeenCalledWith('id, name, sort_order, status');
    });
  });
```

- [ ] **Step 2: Write the failing ResourceList tests**

Append to `src/admin/__tests__/ResourceList.test.jsx`:

```js
describe('thumbnail column', () => {
  const THUMB_CONFIG = {
    ...CONFIG,
    thumbnailColumn: 'media_id',
  };
  // `/images/...` passes through mediaUrl() untouched — no env stubbing.
  const THUMB_ITEMS = [
    { ...ITEMS[0], thumbnailPath: '/images/test/alpha.jpg' },
    { ...ITEMS[1], thumbnailPath: null },
  ];

  it('renders a leading photo cell per row when the config declares thumbnailColumn', () => {
    const { container } = render(
      <ResourceList {...baseProps({ config: THUMB_CONFIG, items: THUMB_ITEMS })} />,
    );
    const images = container.querySelectorAll('tbody img');
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toBe('/images/test/alpha.jpg');
    // The null-path row still gets its (empty) cell so columns line up.
    expect(container.querySelectorAll('tbody tr')[0].querySelectorAll('td')).toHaveLength(
      container.querySelectorAll('tbody tr')[1].querySelectorAll('td').length,
    );
  });

  it('renders no photo column at all without thumbnailColumn (testimonials)', () => {
    const { container } = render(<ResourceList {...baseProps()} />);
    expect(container.querySelectorAll('tbody img')).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run to verify both fail**

Run: `npx vitest run src/lib/queries/__tests__/adminContent.test.js src/admin/__tests__/ResourceList.test.jsx`
Expected: the new describes FAIL (select string unchanged; no photo cells).

- [ ] **Step 4: Implement the factory option in `src/lib/queries/adminContent.js`**

Change the factory head to:

```js
export function makeResourceQueries(table, columns, options = {}) {
  // `thumbnailColumn` names a snake_case FK column onto public.media (e.g.
  // 'media_id'). When present, every select this factory builds also embeds
  // that row's storage_path — the same alias-by-FK-column join
  // src/lib/queries/siteSettings.js already uses — and every returned item
  // carries `thumbnailPath` (string | null) for ResourceList's photo
  // column. Never written back: valuesToRow only writes declared columns.
  const { thumbnailColumn } = options;
  const select = thumbnailColumn
    ? `${columns.join(', ')}, thumbnail:${thumbnailColumn}(storage_path)`
    : columns.join(', ');

  function toItem(row) {
    const item = rowToItem(row, columns);
    if (thumbnailColumn) item.thumbnailPath = row.thumbnail?.storage_path ?? null;
    return item;
  }
```

Then replace the three mapping call sites: `list`'s `.map((row) => rowToItem(row, columns))` → `.map(toItem)`, and both `create`'s and `update`'s `rowToItem(data, columns)` → `toItem(data)`.

- [ ] **Step 5: Wire the three resource configs**

In `src/admin/resources/gallery.js`: add `thumbnailColumn: 'media_id',` to `galleryResource` (next to `defaultSort`), and change the factory call to:

```js
export const galleryQueries = makeResourceQueries(
  galleryResource.table,
  galleryResource.columns,
  { thumbnailColumn: galleryResource.thumbnailColumn },
);
```

In `src/admin/resources/films.js`: add `thumbnailColumn: 'thumbnail_media_id',` to `filmsResource` and pass `{ thumbnailColumn: filmsResource.thumbnailColumn }` the same way.

In `src/admin/resources/weddings.js`: add `thumbnailColumn: 'cover_media_id',` to `weddingsResource` and change the `baseQueries` line to:

```js
const baseQueries = makeResourceQueries(
  weddingsResource.table,
  weddingsResource.columns,
  { thumbnailColumn: weddingsResource.thumbnailColumn },
);
```

(`src/admin/resources/testimonials.js` is untouched.)

- [ ] **Step 6: Implement the column in `src/admin/ResourceList.jsx`**

Add `import { mediaUrl } from '../lib/mediaUrl.js';` next to the `formatDate` import. In `<thead>`, before the `config.listColumns.map(...)` header cells:

```jsx
              {config.thumbnailColumn && (
                <th scope="col" className="py-3 pr-4 font-bold w-16">
                  <span className="sr-only">Photo</span>
                </th>
              )}
```

In the `<tbody>` row map, compute `const thumbUrl = config.thumbnailColumn ? mediaUrl(item.thumbnailPath) : null;` next to `const name = ...`, and render before the `config.listColumns.map(...)` cells:

```jsx
                  {config.thumbnailColumn && (
                    <td className="py-2 pr-4">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-offwhite-200 border border-pitch-900/10">
                        {thumbUrl && (
                          <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                    </td>
                  )}
```

(`alt=""` is deliberate: the row's title cell names the row; the photo is identification support, not standalone content.)

- [ ] **Step 7: Run the affected files, then lint, then the full suite**

Run: `npx vitest run src/lib/queries/__tests__/adminContent.test.js src/admin/__tests__/ResourceList.test.jsx` — all pass.
Run: `npm run lint` — 0 errors.
Run: `npm test` — the resource-config tests (`src/admin/resources/__tests__/*`) must still pass; if one asserts the exact factory call or config keys, update it to include `thumbnailColumn`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/queries/adminContent.js src/admin/resources/gallery.js src/admin/resources/films.js src/admin/resources/weddings.js src/admin/ResourceList.jsx src/lib/queries/__tests__/adminContent.test.js src/admin/__tests__/ResourceList.test.jsx
git commit -m "feat(admin): thumbnails in gallery/weddings/films list rows via a server-side join"
```

---

### Task 8: Scroll-to-top + tab in the URL hash

**Files:**
- Create: `src/admin/useScrollToTop.js`
- Modify: `src/admin/App.jsx`
- Test: `src/admin/__tests__/App.test.jsx`

**Interfaces:**
- Consumes: `DASHBOARD_TABS` (existing).
- Produces: `useScrollToTop(dep)` — effect hook, `window.scrollTo(0, 0)` whenever `dep` changes. `AdminDashboard` reads its initial tab from `location.hash` and writes every change back via `history.replaceState`.

- [ ] **Step 1: Update the tests**

In `src/admin/__tests__/App.test.jsx`:

1. Add `afterEach` to the vitest import.
2. Tab clicks will now write `location.hash`, which leaks across tests — add hash hygiene to the existing top-level `beforeEach` (first line):

```js
  window.history.replaceState(null, '', window.location.pathname);
```

3. Append a new describe block (reuse the `signIn()` helper shape from the Media Library describe):

```js
  describe('tab persistence and scroll reset', () => {
    function signIn() {
      useSession.mockReturnValue({
        ...baseState,
        status: 'authenticated',
        session: { user: { id: 'user-2', email: 'admin@example.test' } },
        profile: { userId: 'user-2', role: 'admin', displayName: 'Studio Director' },
      });
    }

    afterEach(() => {
      window.history.replaceState(null, '', window.location.pathname);
    });

    it('opens on the tab named in the URL hash after a refresh', async () => {
      window.history.replaceState(null, '', '#media');
      signIn();
      render(<App />);
      expect(await screen.findByRole('heading', { name: /media library/i })).toBeInTheDocument();
      await waitFor(() => expect(listMedia).toHaveBeenCalled());
    });

    it('falls back to Dashboard on an unrecognised hash', async () => {
      window.history.replaceState(null, '', '#not-a-tab');
      signIn();
      render(<App />);
      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument());
    });

    it('writes the hash on tab change and scrolls back to the top', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      const scrollSpy = vi.spyOn(window, 'scrollTo');
      signIn();
      render(<App />);
      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument());

      const user = userEvent.setup();
      scrollSpy.mockClear();
      const nav = screen.getByRole('navigation', { name: /admin sections/i });
      await user.click(within(nav).getByRole('button', { name: /media library/i }));

      expect(window.location.hash).toBe('#media');
      await waitFor(() => expect(scrollSpy).toHaveBeenCalledWith(0, 0));
      await waitFor(() => expect(listMedia).toHaveBeenCalled());
    });
  });
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/admin/__tests__/App.test.jsx`
Expected: the three new tests FAIL (hash ignored, hash never written); everything else passes.

- [ ] **Step 3: Create `src/admin/useScrollToTop.js`**

```js
import { useEffect } from 'react';

// Every admin navigation starts the new screen at the top — without this,
// clicking Edit from halfway down a long list lands the admin mid-form.
// AdminDashboard passes its tab key; each resource dashboard passes its
// view mode. jsdom's missing scrollTo is already no-op'd in
// src/test/setup.js, so tests can spy on it.
export function useScrollToTop(dep) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [dep]);
}
```

- [ ] **Step 4: Wire `src/admin/App.jsx`**

Add the import: `import { useScrollToTop } from './useScrollToTop.js';`

Below the `DASHBOARD_TABS` array, add:

```jsx
const TAB_KEYS = new Set(DASHBOARD_TABS.map(({ key }) => key));

// The tab a refresh should restore — whatever hash the last goTab wrote.
// Read once, at mount; an unrecognised or absent hash lands on Dashboard.
// Deliberately no hashchange listener (see the Phase 3d spec's non-goals).
function initialTab() {
  const fromHash = window.location.hash.replace(/^#/, '');
  return TAB_KEYS.has(fromHash) ? fromHash : 'dashboard';
}
```

In `AdminDashboard`, change `useState('dashboard')` to `useState(initialTab)`, add `useScrollToTop(tab);` under the two `useState` lines, and replace `openTab` with:

```jsx
  // replaceState, not a hash assignment: tab-hopping must not pile up
  // browser-history entries the Back button would then walk through.
  function goTab(key) {
    window.history.replaceState(null, '', `#${key}`);
    setTab(key);
  }

  function openTab(key) {
    goTab(key);
    if (key !== 'gallery') setGalleryPrefill(null);
  }
```

and change the Media Library hand-off to use it: `onAddToGallery={(media) => { setGalleryPrefill(media.id); goTab('gallery'); }}`.

In each of `WeddingsDashboard`, `GalleryDashboard`, `FilmsDashboard`, and `TestimonialsDashboard`, add `useScrollToTop(view.mode);` directly under the `view` state declaration.

- [ ] **Step 5: Run App tests, then lint**

Run: `npx vitest run src/admin/__tests__/App.test.jsx` — all pass (including the hash hygiene not breaking the Add-to-Gallery test).
Run: `npm run lint` — 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/admin/useScrollToTop.js src/admin/App.jsx src/admin/__tests__/App.test.jsx
git commit -m "feat(admin): scroll to top on navigation; keep the open tab in the URL hash"
```

---

### Task 9: Docs, full gates, and live check

**Files:**
- Modify: `docs/COMPONENTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a branch that passes every gate, ready for finishing-a-development-branch.

- [ ] **Step 1: Update `docs/COMPONENTS.md`**

Read the file first and follow its existing format exactly. Add entries for `MediaPickerDialog` (full-screen picker overlay: search, upload, grid; caller-controlled close) and `MediaSlot` (compact thumbnail + Choose/Change/Remove control that opens the dialog). Update the existing entries whose behaviour changed: `MediaPicker` (new `selectedIds`/`gridClass` props, clickable photographs), `ResourceForm` (media fields render `MediaSlot`), `SettingsForm` (three compact slots), `WeddingPhotos` (batch attach via dialog), `ResourceList` (leading photo column when the config declares `thumbnailColumn`).

- [ ] **Step 2: Update `docs/ARCHITECTURE.md`**

In the admin paragraph, add one sentence after the CMS description, e.g.: "Choosing a photograph anywhere in the admin goes through `MediaSlot` → `MediaPickerDialog` (a full-screen, searchable picker) rather than an inline grid; media-backed list rows carry a server-side-joined `thumbnailPath` for their photo column."

- [ ] **Step 3: Update `docs/ROADMAP.md`**

Add the `v0.4d` row to the phase table (Phase 3d — admin UX polish) and a short Phase 3d paragraph following the Phase 3c one: picker dialog with search, compact slots (Settings drops ~195 inline tiles to 3), batch wedding-photo attach, list thumbnails, scroll-to-top, tab-in-hash.

- [ ] **Step 4: Run every gate, each as its own command**

```bash
npm test
npm run lint
npm run check:docs
npm run build
```

Expected: full suite green; lint `0 errors, 2 warnings`; check:docs passes; build succeeds. Then reset the build artefacts (PS-019):

```bash
git checkout -- dist/
git clean -fx dist/
```

- [ ] **Step 5: Live smoke check in a real browser**

With `npm run dev` running and the local Supabase up, take Playwright screenshots and LOOK at them:

```bash
npx playwright screenshot --full-page "http://localhost:3000/admin.html#gallery" /tmp/claude-501/-Users-vineetpatel-Projects-Peak-Story-Studio/*/scratchpad/gallery-tab.png
```

Verify by hand in the screenshots (sign-in state permitting — if the shell shows the sign-in form, verification of the dialog happens through the test suite instead, and say so in the report): the Gallery form shows a compact slot, not a grid; the Gallery list shows thumbnails; the Settings tab is short.

- [ ] **Step 6: Commit docs**

```bash
git add docs/COMPONENTS.md docs/ARCHITECTURE.md docs/ROADMAP.md
git commit -m "docs: Phase 3d — picker dialog, media slots, list thumbnails, nav smoothness"
```

---

## After the last task

Use superpowers:finishing-a-development-branch: full suite on the branch, then (per the owner's standing pattern) merge to `main` locally and tag `v0.4d` — but present the menu and let the owner choose; do not push anywhere.
