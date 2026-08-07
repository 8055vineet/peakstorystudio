# Bulk Uploads (Phase 3f, `v0.4f`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin upload many images or a whole folder at once — as a resilient queue — and add a "Bulk add to Gallery" flow that turns a folder + category into draft gallery photos ready to publish.

**Architecture:** `UploadField` gains a `multiple` prop and, for multi-selection, runs the existing one-file-at-a-time `useMediaUpload` pipeline as a sequential queue with progress, stop, and a per-file failure summary. Single-file selection keeps today's exact behavior untouched. `MediaPickerDialog` forwards `uploadMultiple` (default true); `MediaSlot` passes false. `BulkGalleryAdd` (new) + `GalleryDashboard` turn each uploaded file into a draft `gallery_photos` row via the existing `galleryQueries.create`, with a Publish-all step.

**Tech Stack:** React 18, Vitest/jsdom + Testing Library, the existing Supabase-backed upload pipeline (unchanged).

**Spec:** `docs/superpowers/specs/2026-08-07-bulk-uploads-design.md` — authority when this plan is ambiguous.

## Global Constraints

- Plain JavaScript, `.jsx` for components. No TypeScript.
- Tailwind inline, existing palette tokens only. Components stay presentational; only local UI state.
- **`src/hooks/useMediaUpload.js` and the Edge Functions are NOT touched.** The queue calls the existing `upload(file, { altText }) → media row | null` (single-flight; sets the hook's `status`/`progress`/`error`) once per file.
- Components never import the Supabase client.
- ESLint `--max-warnings=2` (the two tracked `useScrollReveal` warnings); react-hooks purity rules enforced (no sync `setState` in an effect body; refs synced to props/state via effects are fine).
- Run `npm run lint` and `npm test` as standalone commands before each commit. Two pre-existing typing-timing tests (UploadField alt-text — now moved, and BookingForm WhatsApp) can flake under parallel load; rerun the file alone before assuming breakage.
- Conventional Commits; stay on `phase-3f/bulk-uploads`.
- Copy, verbatim: buttons **Choose images** / **Choose folder**; queue progress **`Uploading {n} of {total}…`**; bulk summary **`{ok} uploaded, {failed} failed:`** with **Retry failed** and **Stop**; skipped note **`Skipped {n} non-image file(s).`**; alt-text bulk note **`Alt text applies to single uploads — bulk-uploaded photographs are flagged in the media list until one is added.`**; gallery summary **`{n} draft photos created in {category}`** with **Publish all {n}**; the split line **`{n} uploaded but not added — find them in the Media Library.`**

---

### Task 1: `UploadField` — two selection controls + the sequential queue

**Files:**
- Modify: `src/admin/UploadField.jsx`
- Test: `src/admin/__tests__/UploadField.test.jsx`, and the upload-input label query in `src/admin/__tests__/MediaPickerDialog.test.jsx`, `MediaSlot.test.jsx`, `ResourceForm.test.jsx`, `WeddingPhotos.test.jsx`

**Interfaces:**
- Consumes: `useMediaUpload()` (unchanged), `errorMessage`/`STAGE_NAMES` (already in this file).
- Produces: `UploadField({ onUploaded, multiple = true })`. `onUploaded(media, file)` — media row first (unchanged for every existing caller), the original `File` second. Single selection (exactly one image) behaves exactly as before. Tasks 2–4 rely on `multiple` and the second callback arg.

- [ ] **Step 1: Rename the upload-input label query in the four consumer test files**

The file input's accessible label changes from "Photograph" to "Choose images". In each of `MediaPickerDialog.test.jsx`, `MediaSlot.test.jsx`, `ResourceForm.test.jsx`, `WeddingPhotos.test.jsx`, replace every `getByLabelText(/^photograph$/i)` and `getByLabelText(/photograph/i)` **that targets the upload file input** (the ones passed to `user.upload(...)`) with `getByLabelText(/choose images/i)`. (Do not touch `getByAltText`, `getByRole('group', { name: /cover photo/i })`, or the MediaSlot `/photograph/i` legend checks — only the file-input label queries feeding `user.upload`.)

- [ ] **Step 2: Update `UploadField.test.jsx` — keep single-file tests, retarget the label, add queue tests**

In every existing test, change `getByLabelText(/photograph/i)` → `getByLabelText(/choose images/i)`. The single-file semantics are unchanged, so those assertions stay. Then append a bulk describe block:

```jsx
describe('UploadField — bulk queue', () => {
  const img = (name) => new File(['bytes'], name, { type: 'image/jpeg' });
  const row = (id) => ({ id, storagePath: `uploads/${id}.webp`, altText: '' });

  it('renders a folder control by default and none when multiple is false', () => {
    const { rerender } = render(<UploadField onUploaded={vi.fn()} />);
    expect(screen.getByLabelText(/choose folder/i)).toBeInTheDocument();
    rerender(<UploadField onUploaded={vi.fn()} multiple={false} />);
    expect(screen.queryByLabelText(/choose folder/i)).toBeNull();
    expect(screen.getByLabelText(/choose images/i)).not.toHaveAttribute('multiple');
  });

  it('uploads several selected images sequentially, firing onUploaded(media, file) per success', async () => {
    const upload = vi.fn()
      .mockResolvedValueOnce(row('m-1'))
      .mockResolvedValueOnce(row('m-2'));
    useMediaUpload.mockReturnValue({ ...IDLE, upload });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(<UploadField onUploaded={onUploaded} />);

    const a = img('a.jpg'); const b = img('b.jpg');
    await user.upload(screen.getByLabelText(/choose images/i), [a, b]);

    expect(upload).toHaveBeenCalledTimes(2);
    expect(onUploaded).toHaveBeenNthCalledWith(1, row('m-1'), a);
    expect(onUploaded).toHaveBeenNthCalledWith(2, row('m-2'), b);
    await waitFor(() => expect(screen.getByText(/2 uploaded, 0 failed/i)).toBeInTheDocument());
  });

  it('a mid-queue failure does not stop the run and is summarized with retry', async () => {
    const upload = vi.fn()
      .mockResolvedValueOnce(row('m-1'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(row('m-3'));
    useMediaUpload.mockReturnValue({
      ...IDLE, upload, error: { code: 'UPLOAD_FAILED', stage: 'uploading' },
    });
    const user = userEvent.setup();
    render(<UploadField onUploaded={vi.fn()} />);

    await user.upload(screen.getByLabelText(/choose images/i), [img('a.jpg'), img('b.jpg'), img('c.jpg')]);

    await waitFor(() => expect(screen.getByText(/2 uploaded, 1 failed/i)).toBeInTheDocument());
    expect(screen.getByText(/b\.jpg/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry failed/i })).toBeInTheDocument();
  });

  it('skips non-image files in a folder selection and counts them', async () => {
    const upload = vi.fn().mockResolvedValue(row('m-1'));
    useMediaUpload.mockReturnValue({ ...IDLE, upload });
    const user = userEvent.setup();
    render(<UploadField onUploaded={vi.fn()} />);

    const notes = new File(['x'], 'notes.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText(/choose folder/i), [img('a.jpg'), notes]);

    expect(upload).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText(/skipped 1 non-image file/i)).toBeInTheDocument());
  });

  it('a single-image selection keeps the classic behavior (no bulk summary)', async () => {
    const upload = vi.fn().mockResolvedValue(row('m-1'));
    useMediaUpload.mockReturnValue({ ...IDLE, upload });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(<UploadField onUploaded={onUploaded} />);

    await user.upload(screen.getByLabelText(/choose images/i), img('only.jpg'));

    expect(onUploaded).toHaveBeenCalledWith(row('m-1'), expect.any(File));
    expect(screen.queryByText(/uploaded, .* failed/i)).toBeNull();
  });
});
```

Add `waitFor` to the file's `@testing-library/react` import.

- [ ] **Step 3: Run to verify the new tests fail**

Run: `npx vitest run src/admin/__tests__/UploadField.test.jsx`
Expected: the five bulk tests FAIL (no folder control, no queue yet); single-file tests pass.

- [ ] **Step 4: Rewrite `src/admin/UploadField.jsx`**

Keep the top-of-file constants (`BUSY_STATUSES`, `PROGRESS_LABELS`, `STAGE_NAMES`, `ERROR_COPY`, `errorMessage`). Replace the component:

```jsx
export default function UploadField({ onUploaded, multiple = true }) {
  const [file, setFile] = useState(null);
  const [altText, setAltText] = useState('');
  const [run, setRun] = useState(null); // null = not in/after a bulk run
  const {
    status, progress, error, upload,
  } = useMediaUpload();

  const altId = useId();
  const imagesId = useId();
  const folderId = useId();
  const errorId = useId();

  // The hook sets `error` via setState inside its own failure path; this ref
  // mirrors it so the queue can read the just-failed file's reason after a
  // flush, without depending on a stale render-time closure.
  const errorRef = useRef(error);
  useEffect(() => { errorRef.current = error; }, [error]);
  const stopRef = useRef(false);

  const busy = BUSY_STATUSES.includes(status) || Boolean(run?.running);

  // Existing single-file path, byte-for-byte in effect: applies alt text,
  // drives the classic per-stage progress + Retry Upload UI.
  const runSingle = async (candidate) => {
    setRun(null);
    setFile(candidate);
    const result = await upload(candidate, { altText });
    if (result) onUploaded?.(result, candidate);
  };

  const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

  const runQueue = async (images) => {
    stopRef.current = false;
    const failures = [];
    setRun({
      total: images.length, index: 0, ok: 0, failures, running: true, stopped: false,
    });
    for (let i = 0; i < images.length; i += 1) {
      if (stopRef.current) break;
      setRun((r) => ({ ...r, index: i }));
      // eslint-disable-next-line no-await-in-loop
      const result = await upload(images[i]);
      if (result) {
        onUploaded?.(result, images[i]);
        setRun((r) => ({ ...r, ok: r.ok + 1 }));
      } else {
        // eslint-disable-next-line no-await-in-loop
        await flush();
        failures.push({ file: images[i], name: images[i].name, message: errorMessage(errorRef.current) });
        setRun((r) => ({ ...r, failures: [...failures] }));
      }
    }
    setRun((r) => ({ ...r, running: false, stopped: stopRef.current }));
  };

  const handleChosen = (fileList, { skipped = 0 } = {}) => {
    const images = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    const skippedTotal = skipped + (Array.from(fileList).length - images.length - skipped);
    if (images.length === 0) {
      setRun({
        total: 0, index: 0, ok: 0, failures: [], running: false, stopped: false, skipped: skippedTotal,
      });
      return;
    }
    if (images.length === 1) {
      runSingle(images[0]);
      return;
    }
    setRun((prev) => ({ ...(prev ?? {}), skipped: skippedTotal }));
    runQueue(images);
  };

  const onImagesChange = (e) => {
    if (e.target.files?.length) handleChosen(e.target.files);
    e.target.value = '';
  };
  const onFolderChange = (e) => {
    if (e.target.files?.length) handleChosen(e.target.files);
    e.target.value = '';
  };

  const handleRetrySingle = () => { if (file && !busy) runSingle(file); };
  const handleRetryFailed = () => {
    const files = (run?.failures ?? []).map((f) => f.file);
    if (files.length) runQueue(files);
  };
  const handleStop = () => { stopRef.current = true; };

  const bulkActive = Boolean(run) && run.total > 1;
  const skippedNote = run?.skipped
    ? `Skipped ${run.skipped} non-image file(s).` : null;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={altId} className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-semibold">
          Alt Text
        </label>
        <input
          id={altId}
          type="text"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          disabled={busy || bulkActive}
          placeholder="Describe the photograph for screen readers"
          className="w-full px-4 py-3 rounded-lg bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900 disabled:opacity-60"
        />
        <p className="mt-1 text-xs text-charcoal-500">
          Alt text applies to single uploads — bulk-uploaded photographs are flagged in the media list until one is added.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label
          htmlFor={imagesId}
          className={`px-4 py-2.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-xs uppercase tracking-widest font-semibold cursor-pointer hover:bg-offwhite-200 transition-colors ${busy ? 'opacity-60 pointer-events-none' : ''}`}
        >
          Choose images
        </label>
        <input
          id={imagesId}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={onImagesChange}
          disabled={busy}
          aria-describedby={status === 'error' ? errorId : undefined}
          className="sr-only"
        />
        {multiple && (
          <>
            <label
              htmlFor={folderId}
              className={`px-4 py-2.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-xs uppercase tracking-widest font-semibold cursor-pointer hover:bg-offwhite-200 transition-colors ${busy ? 'opacity-60 pointer-events-none' : ''}`}
            >
              Choose folder
            </label>
            <input
              id={folderId}
              type="file"
              accept="image/*"
              multiple
              webkitdirectory=""
              directory=""
              onChange={onFolderChange}
              disabled={busy}
              className="sr-only"
            />
          </>
        )}
      </div>

      {skippedNote && <p className="text-xs text-charcoal-500">{skippedNote}</p>}

      {bulkActive && run.running && (
        <div aria-live="polite" className="space-y-1">
          <p className="text-xs font-semibold text-pitch-900">
            Uploading {Math.min(run.index + 1, run.total)} of {run.total}…
          </p>
          <progress value={progress} max={100} aria-label="Upload progress" className="w-full h-2" />
          <button
            type="button"
            onClick={handleStop}
            className="mt-1 px-4 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors"
          >
            Stop
          </button>
        </div>
      )}

      {bulkActive && !run.running && (
        <div role="status" className="p-4 rounded-lg border border-pitch-900/20 bg-offwhite-50 space-y-2">
          <p className="text-xs font-bold text-pitch-900">
            {run.ok} uploaded, {run.failures.length} failed:
            {run.stopped ? ' (stopped)' : ''}
          </p>
          {run.failures.length > 0 && (
            <ul className="text-xs text-charcoal-700 space-y-0.5">
              {run.failures.map((f) => <li key={f.name}>{f.name} — {f.message}</li>)}
            </ul>
          )}
          {run.failures.length > 0 && (
            <button
              type="button"
              onClick={handleRetryFailed}
              className="px-4 py-2 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors"
            >
              Retry failed
            </button>
          )}
        </div>
      )}

      {!bulkActive && busy && (
        <div aria-live="polite" className="space-y-1">
          <p className="text-xs font-semibold text-pitch-900">{PROGRESS_LABELS[status]}</p>
          <progress value={progress} max={100} aria-label="Upload progress" className="w-full h-2" />
        </div>
      )}

      {!bulkActive && status === 'done' && !busy && (
        <p className="flex items-center gap-2 text-xs font-semibold text-pitch-900">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          Uploaded.
        </p>
      )}

      {!bulkActive && status === 'error' && error && (
        <div id={errorId} role="alert" className="p-4 rounded-lg border border-pitch-900/20 bg-offwhite-50 space-y-2">
          <p className="flex items-center gap-2 text-xs font-bold text-pitch-900">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            Upload failed while {STAGE_NAMES[error.stage] ?? 'processing'}.
          </p>
          <p className="text-xs text-charcoal-700">{errorMessage(error)}</p>
          <button
            type="button"
            onClick={handleRetrySingle}
            disabled={!file}
            className="px-4 py-2 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Retry Upload
          </button>
        </div>
      )}
    </div>
  );
}
```

Add `useEffect, useRef` to the react import (`import { useEffect, useId, useRef, useState } from 'react';`).

- [ ] **Step 5: Run the affected test files, then lint**

Run: `npx vitest run src/admin/__tests__/UploadField.test.jsx src/admin/__tests__/MediaPickerDialog.test.jsx src/admin/__tests__/MediaSlot.test.jsx src/admin/__tests__/ResourceForm.test.jsx src/admin/__tests__/WeddingPhotos.test.jsx`
Then: `npm run lint`
Expected: all green; lint 0 errors. If a consumer test still queries `/photograph/i` on the file input, retarget it to `/choose images/i`.

- [ ] **Step 6: Commit**

```bash
git add src/admin/UploadField.jsx src/admin/__tests__/UploadField.test.jsx src/admin/__tests__/MediaPickerDialog.test.jsx src/admin/__tests__/MediaSlot.test.jsx src/admin/__tests__/ResourceForm.test.jsx src/admin/__tests__/WeddingPhotos.test.jsx
git commit -m "feat(admin): UploadField uploads many images or a folder as a resilient queue"
```

---

### Task 2: `MediaPickerDialog` forwards `uploadMultiple`; `MediaSlot` opts out

**Files:**
- Modify: `src/admin/MediaPickerDialog.jsx`, `src/admin/MediaSlot.jsx`
- Test: `src/admin/__tests__/MediaPickerDialog.test.jsx`, `src/admin/__tests__/MediaSlot.test.jsx`

**Interfaces:**
- Consumes: `UploadField`'s `multiple` prop (Task 1).
- Produces: `MediaPickerDialog({ ..., uploadMultiple = true })`, passed to its embedded `UploadField` as `multiple`. `MediaSlot` passes `uploadMultiple={false}`. WeddingPhotos and CollectionItems open the dialog with the default (bulk on).

- [ ] **Step 1: Add failing tests**

In `MediaPickerDialog.test.jsx`:

```jsx
  it('offers folder upload by default and hides it when uploadMultiple is false', () => {
    const { rerender } = render(<MediaPickerDialog {...baseProps()} />);
    expect(screen.getByLabelText(/choose folder/i)).toBeInTheDocument();
    rerender(<MediaPickerDialog {...baseProps({ uploadMultiple: false })} />);
    expect(screen.queryByLabelText(/choose folder/i)).toBeNull();
  });
```

In `MediaSlot.test.jsx`:

```jsx
  it('its picker dialog uploads one photograph at a time — no folder control', async () => {
    const user = userEvent.setup();
    render(<MediaSlot {...baseProps()} />);
    await user.click(screen.getByRole('button', { name: /choose photograph/i }));
    expect(screen.queryByLabelText(/choose folder/i)).toBeNull();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/admin/__tests__/MediaPickerDialog.test.jsx src/admin/__tests__/MediaSlot.test.jsx`
Expected: the two new tests FAIL (folder control present regardless).

- [ ] **Step 3: Implement**

`MediaPickerDialog.jsx`: add `uploadMultiple = true` to the outer `MediaPickerDialog({ open, closeLabel = 'Cancel', ...props })` — thread it into `DialogInner` and onto `UploadField`:
- Outer: `export default function MediaPickerDialog({ open, closeLabel = 'Cancel', uploadMultiple = true, ...props }) { if (!open) return null; return <DialogInner closeLabel={closeLabel} uploadMultiple={uploadMultiple} {...props} />; }`
- `DialogInner(... , uploadMultiple)` signature gains it; the embedded `<UploadField onUploaded={onUploaded} />` becomes `<UploadField onUploaded={onUploaded} multiple={uploadMultiple} />`.

`MediaSlot.jsx`: its `<MediaPickerDialog ... />` gains `uploadMultiple={false}`.

- [ ] **Step 4: Run both files + lint**

Run: `npx vitest run src/admin/__tests__/MediaPickerDialog.test.jsx src/admin/__tests__/MediaSlot.test.jsx` then `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/admin/MediaPickerDialog.jsx src/admin/MediaSlot.jsx src/admin/__tests__/MediaPickerDialog.test.jsx src/admin/__tests__/MediaSlot.test.jsx
git commit -m "feat(admin): single-photo slots stay single-file; library and attach dialogs go bulk"
```

---

### Task 3: `BulkGalleryAdd` — the Gallery bulk panel

**Files:**
- Create: `src/admin/BulkGalleryAdd.jsx`
- Test: `src/admin/__tests__/BulkGalleryAdd.test.jsx`

**Interfaces:**
- Consumes: `UploadField` (Task 1: `onUploaded(media, file)`).
- Produces: `BulkGalleryAdd({ categories, onUpload, pending, summary, onPublishAll, onDismiss })` where
  - `categories` is `[{ id, name, sortOrder }]`;
  - `onUpload(media, file, category)` is called once per successful upload (dashboard creates the draft row);
  - `pending` disables Publish-all while a publish run is in flight;
  - `summary` is `null` or `{ category, created: number, notAdded: number }` — the dashboard-owned result of the last run;
  - `onPublishAll()` / `onDismiss()` drive the banner.
  Task 4 mounts it.

- [ ] **Step 1: Write the failing test**

`src/admin/__tests__/BulkGalleryAdd.test.jsx`:

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

const { default: BulkGalleryAdd } = await import('../BulkGalleryAdd.jsx');

const CATEGORIES = [
  { id: 'c1', name: 'Wedding', sortOrder: 0 },
  { id: 'c2', name: 'Pre-Wedding', sortOrder: 1 },
];

beforeEach(() => {
  useMediaUpload.mockReset();
  useMediaUpload.mockReturnValue({
    status: 'idle', progress: 0, error: null, upload: vi.fn().mockResolvedValue({ id: 'm-1', storagePath: 'uploads/x.webp' }), reset: vi.fn(),
  });
});

function baseProps(overrides = {}) {
  return {
    categories: CATEGORIES,
    onUpload: vi.fn(),
    pending: false,
    summary: null,
    onPublishAll: vi.fn(),
    onDismiss: vi.fn(),
    ...overrides,
  };
}

describe('BulkGalleryAdd', () => {
  it('keeps the upload controls disabled until a category is chosen', async () => {
    const user = userEvent.setup();
    render(<BulkGalleryAdd {...baseProps()} />);
    expect(screen.getByLabelText(/choose images/i)).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/category/i), 'Wedding');
    expect(screen.getByLabelText(/choose images/i)).not.toBeDisabled();
  });

  it('calls onUpload with (media, file, category) for each upload', async () => {
    const onUpload = vi.fn();
    const upload = vi.fn().mockResolvedValue({ id: 'm-9', storagePath: 'uploads/9.webp' });
    useMediaUpload.mockReturnValue({
      status: 'idle', progress: 0, error: null, upload, reset: vi.fn(),
    });
    const user = userEvent.setup();
    render(<BulkGalleryAdd {...baseProps({ onUpload })} />);
    await user.selectOptions(screen.getByLabelText(/category/i), 'Wedding');
    await user.upload(screen.getByLabelText(/choose images/i), new File(['b'], 'shot.jpg', { type: 'image/jpeg' }));
    expect(onUpload).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-9' }), expect.any(File), 'Wedding');
  });

  it('shows the created-count banner with Publish all, and the not-added split', async () => {
    const user = userEvent.setup();
    const props = baseProps({ summary: { category: 'Wedding', created: 24, notAdded: 2 } });
    render(<BulkGalleryAdd {...props} />);
    expect(screen.getByText(/24 draft photos created in Wedding/i)).toBeInTheDocument();
    expect(screen.getByText(/2 uploaded but not added/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /publish all 24/i }));
    expect(props.onPublishAll).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/admin/__tests__/BulkGalleryAdd.test.jsx`

- [ ] **Step 3: Implement `src/admin/BulkGalleryAdd.jsx`**

```jsx
import { useState } from 'react';
import UploadField from './UploadField.jsx';

// The Gallery tab's bulk-add panel: pick a category, then bulk-upload — each
// uploaded photograph becomes a draft gallery row (the dashboard's onUpload
// does the create). Presentational: the category list and the last run's
// summary arrive as props; the only state here is which category is picked.
const LABEL_CLASS = 'block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-semibold';

export default function BulkGalleryAdd({
  categories, onUpload, pending, summary, onPublishAll, onDismiss,
}) {
  const [category, setCategory] = useState('');

  return (
    <section className="border border-pitch-900/10 rounded-2xl bg-offwhite-50 p-5 mb-6 max-w-2xl">
      <h3 className="text-xs uppercase tracking-widest text-charcoal-500 font-bold mb-4">Bulk add to Gallery</h3>

      <div className="mb-4">
        <label htmlFor="bulk-gallery-category" className={LABEL_CLASS}>Category</label>
        <select
          id="bulk-gallery-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
        >
          <option value="">Select a category…</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <p className="mt-1 text-xs text-charcoal-500">
          Every photograph you add becomes a draft in this category — publish when you are ready.
        </p>
      </div>

      {/* Disabled until a category is chosen: a bulk upload with no category
          would create rows the public gallery can't file under any section.
          key remounts UploadField per category so a fresh run starts clean. */}
      <div className={category ? '' : 'opacity-50 pointer-events-none'} aria-disabled={!category}>
        <UploadField
          key={category || 'no-category'}
          onUploaded={(media, file) => onUpload(media, file, category)}
        />
      </div>

      {summary && (
        <div role="status" className="mt-4 p-4 rounded-lg border border-gold-500 bg-offwhite-50 space-y-2">
          <p className="text-xs font-bold text-pitch-900">
            {summary.created} draft photos created in {summary.category}
          </p>
          {summary.notAdded > 0 && (
            <p className="text-xs text-charcoal-700">
              {summary.notAdded} uploaded but not added — find them in the Media Library.
            </p>
          )}
          <div className="flex gap-3">
            {summary.created > 0 && (
              <button
                type="button"
                onClick={onPublishAll}
                disabled={pending}
                className="px-5 py-2 rounded-lg bg-pitch-900 text-offwhite-50 text-[10px] uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors disabled:opacity-60"
              >
                {pending ? 'Publishing…' : `Publish all ${summary.created}`}
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="px-5 py-2 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
```

The test's "disabled until category" assertion checks the `Choose images` input's `disabled`. The wrapper uses `pointer-events-none`, which does not set the input's `disabled` attribute — so ALSO gate the field: when no category, render `UploadField` with a disabled overlay is not enough for the test. Adjust: pass a `multiple` field but the input must read `disabled`. Simplest: render UploadField only when a category is chosen, and before that render a disabled stand-in:

Replace the `<div className={category ? ...}>` block with:

```jsx
      {category ? (
        <UploadField
          key={category}
          onUploaded={(media, file) => onUpload(media, file, category)}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <label className="px-4 py-2.5 rounded-lg border border-pitch-900/20 text-pitch-900/50 text-xs uppercase tracking-widest font-semibold">
            Choose images
          </label>
          <input aria-label="Choose images" type="file" disabled className="sr-only" />
        </div>
      )}
```

(This keeps the `getByLabelText(/choose images/i)` query satisfied and `disabled` true before a category is picked, then swaps to the real field.)

- [ ] **Step 4: Run + lint** — `npx vitest run src/admin/__tests__/BulkGalleryAdd.test.jsx` then `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/admin/BulkGalleryAdd.jsx src/admin/__tests__/BulkGalleryAdd.test.jsx
git commit -m "feat(admin): BulkGalleryAdd panel — category + bulk upload to draft gallery rows"
```

---

### Task 4: Wire `BulkGalleryAdd` into `GalleryDashboard`

**Files:**
- Modify: `src/admin/App.jsx` (`GalleryDashboard`)
- Test: `src/admin/__tests__/App.test.jsx`

**Interfaces:**
- Consumes: `BulkGalleryAdd` (Task 3), the existing `galleryQueries.create`/`update`, the categories resource already loaded in `GalleryDashboard` (Task 11 of Phase 3e).
- Produces: no new outward interface.

- [ ] **Step 1: Add failing tests to `App.test.jsx`'s Gallery describe**

```jsx
    it('bulk-adds uploaded photos as draft rows titled from the file name, then publishes all', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      galleryList.mockResolvedValue([]);
      // Each bulk upload resolves a media row; galleryCreate returns a draft row.
      let created = 0;
      galleryCreate.mockImplementation(async (payload) => {
        created += 1;
        return { id: `g-${created}`, ...payload, status: 'draft' };
      });
      galleryUpdate.mockResolvedValue({ status: 'published' });
      signIn();
      render(<App />);
      const user = userEvent.setup();

      const nav = screen.getByRole('navigation', { name: /admin sections/i });
      await user.click(within(nav).getByRole('button', { name: 'Gallery' }));
      await waitFor(() => expect(screen.getByText('Bulk add to Gallery')).toBeInTheDocument());

      await user.selectOptions(screen.getByLabelText(/category/i), 'Wedding');
      // The mocked useMediaUpload (App.test mocks it wholesale) resolves a media row;
      // upload two files.
      await user.upload(screen.getByLabelText(/choose images/i), [
        new File(['a'], 'haldi-1.jpg', { type: 'image/jpeg' }),
        new File(['b'], 'haldi-2.jpg', { type: 'image/jpeg' }),
      ]);

      await waitFor(() => expect(galleryCreate).toHaveBeenCalledTimes(2));
      expect(galleryCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
        title: 'haldi-1', category: 'Wedding', mediaId: expect.any(String), sortOrder: 0,
      }));
      expect(galleryCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: 'haldi-2', sortOrder: 1 }));

      await waitFor(() => expect(screen.getByText(/2 draft photos created in Wedding/i)).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: /publish all 2/i }));
      await waitFor(() => expect(galleryUpdate).toHaveBeenCalledWith('g-1', { status: 'published' }));
      expect(galleryUpdate).toHaveBeenCalledWith('g-2', { status: 'published' });
    });
```

App.test.jsx already mocks `useMediaUpload` wholesale returning `{ upload: vi.fn() }` — update that mock so `upload` resolves a unique media row per call:

Find the existing `vi.mock('../../hooks/useMediaUpload', ...)` and make its `upload` `vi.fn(async () => ({ id: \`media-${Math.random().toString(36).slice(2, 8)}\`, storagePath: 'uploads/x.webp' }))`. (Random id is fine here — the assertions match `expect.any(String)` / the created row ids come from `galleryCreate`.)

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/admin/__tests__/App.test.jsx`

- [ ] **Step 3: Implement in `GalleryDashboard`**

Add the import: `import BulkGalleryAdd from './BulkGalleryAdd.jsx';`

Inside `GalleryDashboard`, add bulk-run state and handlers (next to the categories state from Phase 3e):

```jsx
  // Bulk-add run: rows created this run (for Publish all) and the split
  // between "uploaded + row created" and "uploaded but row-create failed".
  const bulkRunRef = useRef({ createdIds: [], nextSort: 0, notAdded: 0, category: '' });
  const [bulkSummary, setBulkSummary] = useState(null);
  const [bulkPublishing, setBulkPublishing] = useState(false);

  async function handleBulkUpload(media, file, category) {
    const runState = bulkRunRef.current;
    if (runState.category !== category) {
      // A category change starts a fresh run; seed nextSort past the current max.
      const maxSort = items.reduce((m, it) => Math.max(m, it.sortOrder ?? 0), -1);
      bulkRunRef.current = {
        createdIds: [], nextSort: maxSort + 1, notAdded: 0, category,
      };
    }
    const title = file.name.replace(/\.[^./\\]+$/, '');
    try {
      const row = await galleryQueries.create({
        mediaId: media.id,
        title,
        category,
        sortOrder: bulkRunRef.current.nextSort,
      });
      bulkRunRef.current.createdIds.push(row.id);
      bulkRunRef.current.nextSort += 1;
    } catch {
      bulkRunRef.current.notAdded += 1;
    }
    setBulkSummary({
      category,
      created: bulkRunRef.current.createdIds.length,
      notAdded: bulkRunRef.current.notAdded,
    });
    reload();
  }

  async function handleBulkPublishAll() {
    setBulkPublishing(true);
    try {
      const ids = bulkRunRef.current.createdIds;
      // eslint-disable-next-line no-restricted-syntax
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await galleryQueries.update(id, { status: 'published' });
      }
      bulkRunRef.current = {
        createdIds: [], nextSort: 0, notAdded: 0, category: '',
      };
      setBulkSummary(null);
      reload();
    } finally {
      setBulkPublishing(false);
    }
  }
```

Add `useRef` to the admin App's react import if not present. Render the panel in the list view, above the `ManagedList` (Manage categories) panel:

```jsx
      <BulkGalleryAdd
        categories={categories}
        onUpload={handleBulkUpload}
        pending={bulkPublishing}
        summary={bulkSummary}
        onPublishAll={handleBulkPublishAll}
        onDismiss={() => { bulkRunRef.current = { createdIds: [], nextSort: 0, notAdded: 0, category: '' }; setBulkSummary(null); }}
      />
```

- [ ] **Step 4: Run App tests + lint, then the full suite**

Run: `npx vitest run src/admin/__tests__/App.test.jsx` then `npm run lint` then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/admin/App.jsx src/admin/__tests__/App.test.jsx
git commit -m "feat(admin): Gallery tab bulk-adds a folder as draft photos with publish-all"
```

---

### Task 5: Docs, gates, live smoke

**Files:**
- Modify: `docs/COMPONENTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`

- [ ] **Step 1: `docs/COMPONENTS.md`** — the admin components aren't in this public-component inventory, so only touch it if a row references `UploadField` behavior; otherwise leave it. (Check with `grep -n UploadField docs/COMPONENTS.md`; if absent, no change and note that in the commit.)

- [ ] **Step 2: `docs/ARCHITECTURE.md`** — in the admin app paragraph, add one sentence: uploads accept multiple images or a whole folder and run as a resilient one-at-a-time queue (single-photo slots stay single-file); the Gallery tab can bulk-add a folder as draft photos in a chosen category, with publish-all.

- [ ] **Step 3: `docs/ROADMAP.md`** — add the `v0.4f` row (`3f — Bulk uploads | Multi-image and folder upload queue; bulk add to Gallery | A folder of photos uploads and reaches the gallery in one flow | local`) and a short Phase 3f paragraph after 3e's, linking the spec.

- [ ] **Step 4: Full gates, each standalone**

```bash
npm test
npm run lint
npm run check:docs
npm run build
git checkout -- dist/ && git clean -fx dist/
```

Expected: suite green; lint `0 errors, 2 warnings`; check:docs passes; build clean.

- [ ] **Step 5: Live smoke in a real browser**

With `npm run dev` and the local stack up, drive a Playwright script (like Phase 3e's): sign into the admin, open Gallery, pick a category, bulk-select 3–4 image files from `public/images/gallery/` into **Bulk add to Gallery**, confirm the "N draft photos created" banner, screenshot it, **Publish all**, open the public `/gallery` and confirm the new photos show in that section, then delete the probe rows (they're in the owner's real database — leave nothing behind; delete by the titles just created via the admin list or the service key). LOOK at the screenshots.

- [ ] **Step 6: Commit**

```bash
git add docs/COMPONENTS.md docs/ARCHITECTURE.md docs/ROADMAP.md
git commit -m "docs: Phase 3f — bulk uploads and bulk add to Gallery"
```

---

## After the last task

Use superpowers:finishing-a-development-branch: full suite on the branch, present the integration menu (owner's standing pattern is merge to `main` locally + tag `v0.4f`; never push without asking).
