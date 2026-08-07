# Bulk Uploads (Phase 3f, `v0.4f`) — Design

**Date:** 2026-08-07
**Status:** Approved by owner (scope "straight into Gallery too" and the overall design chosen explicitly)
**Branch:** `phase-3f/bulk-uploads`

## 1. Context

Every upload in the admin is single-file: `UploadField` takes one photograph at a time through
one `<input type="file">`. The owner wants to select **many images at once, or a whole folder**,
and wants a folder to be able to land **directly in the Gallery** as draft photos in a chosen
category. No schema changes — this rides the existing four-stage upload pipeline
(`useMediaUpload`: resize → sign → PUT → record), which already processes one file at a time and
is simply invoked once per file.

## 2. `UploadField` v2 — images, folders, and a queue

`src/admin/UploadField.jsx` keeps its public contract and gains one prop and one callback
argument:

- **Props:** `{ onUploaded, multiple = true }`.
- **Callback:** `onUploaded(media, file)` — the created media row (unchanged first argument, so
  every existing caller keeps working) plus the original `File` as a new second argument, which
  is how Bulk-add-to-Gallery learns the original file name (`media.storage_path` is a UUID key;
  the name exists only on the `File`).

**Selection.** The bare file input becomes two buttons triggering hidden inputs:
**Choose images** (`<input type="file" accept="image/*" multiple>` — `multiple` only when the
prop allows) and **Choose folder** (`<input type="file" webkitdirectory="" directory="" multiple>`,
rendered only when `multiple` is true). Folder selections include everything recursively;
non-image files (by MIME type) are skipped and counted ("Skipped 3 non-image files.").

**One file** behaves exactly as today: the Alt Text input applies, per-stage progress renders,
a failure shows the staged error copy with Retry Upload.

**Many files** run as a sequential queue (one at a time — each file is resized in the browser
first, so memory stays flat and progress stays honest):

- Progress line "Uploading 7 of 24…" above the existing per-stage bar (`aria-live="polite"`).
- Each success calls `onUploaded(media, file)` immediately — attach-on-upload contexts
  (WeddingPhotos, CollectionItems, the Media Library's reload) work per-file with no changes.
- A failure never stops the queue: the file and its staged error message are collected and the
  run continues. The end-of-run summary reads "22 uploaded, 2 failed:" with the failed file
  names and reasons, and a **Retry failed** button that re-queues exactly those files.
- A **Stop** button halts after the file currently in flight; already-uploaded files stay
  uploaded, the not-yet-started remainder is listed as skipped.
- The Alt Text input is disabled during and for bulk selections, with the note "Alt text
  applies to single uploads — bulk-uploaded photographs are flagged in the media list until
  one is added." (Same flag mechanism as today.)

**Where `multiple` is false:** `MediaPickerDialog` gains `uploadMultiple = true`, passed through
to its embedded `UploadField`. `MediaSlot` passes `uploadMultiple={false}` — a slot (Home hero,
wedding cover, film thumbnail, video poster) holds exactly one photograph, and its
`onUploaded` closes the dialog on the first result, so bulk there would be meaningless.
Everything else — the Media Library tab, WeddingPhotos' and CollectionItems' dialogs — gets the
full queue with per-file auto-attach.

## 3. Bulk add to Gallery

A new panel on the Gallery tab (`src/admin/BulkGalleryAdd.jsx`, rendered by `GalleryDashboard`
above the Manage categories panel), presentational like everything else in the admin:

- **Props:** `{ categories, onCreateRow, onPublishAll, pending, lastRun }` where
  `onCreateRow(media, file, category)` is wired by the dashboard and `lastRun` is the
  dashboard-owned summary of the most recent run.
- **UI:** a Category select (options from the managed `categories` list; required — the
  buttons stay disabled until one is chosen), then a full `UploadField` (`multiple` on).
- **Per uploaded file** the dashboard's `onCreateRow` creates a **draft** gallery row through
  the existing `galleryQueries.create`: `mediaId` = the new media row's id, `title` = the file
  name without its extension (`haldi-042.jpg` → `haldi-042`), `category` = the chosen one,
  `sortOrder` appended after the current maximum (tracked across the run so a folder keeps its
  order). `create` already forces `status: 'draft'` — nothing bulk-added can go live by itself.
- **After the run** the dashboard shows the summary banner: "24 draft photos created in
  Wedding" with **Publish all 24** (updates each created row's status to published, using the
  ids collected during the run) and Dismiss. Publishing selectively via the list's toggles
  remains available as always.
- **Failure split, reported distinctly:** a file whose *upload* failed created nothing (listed
  by `UploadField`'s own failure summary); a file whose upload succeeded but whose *row
  creation* failed is in the Media Library but not the Gallery, and the banner names those
  separately ("2 uploaded but not added — find them in the Media Library").

## 4. Error handling

`useMediaUpload` is untouched; its staged errors surface per file in the queue summary. The
queue tolerates any mix of success/failure/stop. `BulkGalleryAdd` disables its controls while a
run is in flight (`pending`). Row-creation errors are caught per file by the dashboard and
never abort the remaining files.

## 5. Testing

- `UploadField.test.jsx` (updated + new): single-file behavior unchanged (alt text applied,
  retry); multi-selection uploads sequentially, firing `onUploaded(media, file)` per success;
  a mid-queue failure continues and is summarized with Retry failed; Stop halts after the
  current file; non-image files in a folder selection are skipped and counted; `multiple:
  false` renders no folder button and no `multiple` attribute.
- `MediaPickerDialog.test.jsx`: `uploadMultiple` forwards; default true.
- `MediaSlot.test.jsx`: its dialog's upload is single-file.
- `BulkGalleryAdd.test.jsx` (new): category required before choosing; `onCreateRow` called per
  upload with `(media, file, category)`; summary banner render + Publish all + the
  uploaded-but-not-added split.
- Admin `App.test.jsx`: the Gallery tab renders the panel; a bulk run creates draft rows via
  `galleryCreate` with derived titles and the chosen category and appended sort orders;
  Publish all updates each created id.
- Live smoke (Playwright): bulk-select several images into Bulk add to Gallery against the
  running stack, verify draft rows appear, publish all, verify on the public gallery, then
  delete the probe rows (owner's real database — leave nothing behind).

## 6. Out of scope (deliberate)

- No parallel uploads (sequential is honest, memory-safe, and fast enough locally).
- No per-file alt text or title editing inside the bulk flow — fix-ups happen afterwards in
  the Media Library and the Gallery list, which already support them.
- No bulk delete/unpublish; no bulk flows for films, testimonials, weddings-as-rows, or
  stories (weddings and pages already batch-attach from the library via their dialogs).
- No schema or Edge Function changes.

## 7. Phase mechanics

Branch `phase-3f/bulk-uploads`; Conventional Commits; full gates (`npm test`, `npm run lint`,
`npm run check:docs`, `npm run build`) plus the live smoke before merge; merge to `main`
locally and tag `v0.4f`. Docs: COMPONENTS/ARCHITECTURE admin paragraphs and the ROADMAP row.
