# Admin UX Polish (Phase 3d, `v0.4d`) — Design

**Date:** 2026-08-05
**Status:** Approved by owner (picker style and all four smoothness fixes chosen explicitly)
**Branch:** `phase-3d/admin-ux-polish`

## 1. Context and problem

Phase 3c made every visitor-visible word and image editable from the admin, but the *ergonomics*
of choosing a photograph did not keep up with the size of the real media library (~65 rows and
growing). Every form that needs a photograph embeds the **entire media grid inline**:

- `ResourceForm`'s `media` field type renders `UploadField` + the full `MediaPicker` grid inside
  the form. In the gallery form the Photograph field is *first*, so Title, Category, and the
  Create button sit below ~65 tiles — the owner reported exactly this: "the detail form open at
  bottom … I have to scroll a lot."
- `SettingsForm` embeds **three** full grids (Hero, Brand Story, Closing) — ~195 tiles on one
  page, with the Contact section and Save button at the very bottom.
- `WeddingPhotos`' "Add a Photograph" section embeds a fourth copy of the same grid.

Secondary friction found in the same audit:

- No search in the picker — finding one photo among 65+ is eyeballing every tile.
- Opening a form keeps the window's old scroll position, so an admin who clicked Edit from
  halfway down a list lands mid-form.
- Gallery/Weddings/Films list rows are text-only; with photos titled "1", "2", "3" a row cannot
  be identified without opening it.
- A browser refresh always lands back on the Dashboard tab.

## 2. Goals and non-goals

**Goals**

1. Choosing a photograph never requires scrolling past the media library inside a form.
2. A photograph can be found by searching, not only by scanning.
3. Rows in media-backed lists are identifiable at a glance.
4. Navigation inside the admin starts each screen at the top, and a refresh returns to the tab
   the admin was on.

**Non-goals (explicitly out of scope)**

- Drag-and-drop reordering (the ↑/↓ buttons stay as they are).
- Pagination or virtualisation of the media grid (~65 items renders fine; revisit if the library
  reaches many hundreds).
- Any change to the database schema, RLS, the publish workflow, or the public site.
- Reacting to manual hash edits while the app is open (no `hashchange` listener — the hash is
  read once, on load).

## 3. Design

### 3.1 `MediaPickerDialog` — the full-screen picker overlay (new)

`src/admin/MediaPickerDialog.jsx`. A full-screen overlay dialog that wraps the existing
`MediaPicker` grid. Presentational, like every admin component: media items and their load
lifecycle arrive as props; the dialog never fetches.

**Props**

```
{
  open,          // bool — renders nothing when false
  title,         // heading, e.g. "Choose a photograph"
  items, status, error, onRetry,   // the MediaPicker contract, passed through
  onUploaded,    // (media) => void — from the embedded UploadField
  onSelect,      // (media) => void — a tile was chosen; the CALLER decides whether to close
  onClose,       // () => void — ✕ button, Esc, or the footer button
  selectedId,    // single-select highlight (MediaSlot use)
  selectedIds,   // array — multi-select highlight (WeddingPhotos use); either/both optional
  closeLabel,    // footer button text — "Cancel" for single-pick, "Done" for multi-attach
}
```

**Layout** — `fixed inset-0 z-50` over `bg-offwhite-100`, existing palette tokens only:

- Header row: `title` as the heading + a ✕ close button (`aria-label="Close"`).
- Toolbar row: a search input + the existing `UploadField`.
- Body (the only scrollable region): the `MediaPicker` grid. MediaPicker gains an optional
  `gridClass` prop (default: its current `'grid grid-cols-2 sm:grid-cols-3 gap-4'`); the
  dialog passes `'grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4'` so the full-screen
  layout shows more photos per row than the old inline embed did.
- Footer: one button, `closeLabel`.

**Search** — local state, reset every time the dialog opens. Case-insensitive substring match
against `altText` and the file-name part of `storagePath`. Below the input, a count line:
"12 of 65 photographs". An active query with zero matches shows "No photographs match
“{query}”." — visually distinct from the (unfiltered) "No media yet" empty state, which keeps
its existing copy. Items are already newest-first (`listMedia` orders `created_at desc`); the
dialog preserves that order.

**Behaviour**

- Open: focus moves to the search input; `document.body` gets `overflow: hidden` for the
  dialog's lifetime (removed on close/unmount). The element focused before opening is recorded
  and focus returns to it on close.
- `Escape` calls `onClose`. The dialog carries `role="dialog"` and `aria-modal="true"`,
  labelled by its heading.
- Clicking a tile calls `onSelect(media)`. The dialog does NOT close itself — single-pick
  callers close in their `onSelect`; WeddingPhotos deliberately stays open.
- `onUploaded` fires after a successful upload; callers reload their media list and (for
  single-pick) select the new photo and close, so upload-and-use is one step.

### 3.2 `MediaPicker` — two additive prop changes (modified)

- `selectedIds` (optional array) joins the existing `selectedId`: a tile is highlighted (and its
  Select button reads "✓ Selected", `aria-pressed`) when it matches either.
- When `onSelect` is present, the tile's **image becomes a select button too** (a `<button>`
  wrapping the image, accessible name from the photo's alt text) — in a full-screen picker the
  natural gesture is clicking the photo, not a small button under it. The explicit Select
  button stays for clarity. No behaviour change where `onSelect` is absent (the standalone
  Media Library).

### 3.3 `MediaSlot` — the compact in-form control (new)

`src/admin/MediaSlot.jsx`. What forms render *instead of* the inline grid. Owns exactly one
piece of state — whether its dialog is open — and composes `MediaPickerDialog`.

**Props**

```
{
  label, help, required, error,     // field chrome (fieldset/legend, help text, inline error)
  value,                            // media id or null
  media, mediaStatus, mediaError, onRetryMedia, onUploaded,   // the library, passed through
  onChange,                         // (mediaId | null) => void
}
```

**Rendering** — a `fieldset`/`legend` (preserving ResourceForm's existing accessible grouping):

- With a value: a small square thumbnail (resolved by finding `value` in `media` and calling
  `mediaUrl(storagePath)`; while the library is still loading or the id is unknown, the text
  fallback "Selected media id: {value}" — today's copy), a "Change" button, and — only when
  `!required` — a "Remove" button that calls `onChange(null)`.
- Without a value: a small empty placeholder box ("No photograph yet") and a
  "Choose photograph" button.
- Choose/Change opens the dialog. The dialog's `onSelect` calls `onChange(media.id)` and
  closes; its `onUploaded` calls the passed `onUploaded` (so the caller reloads its library),
  then `onChange(media.id)` and closes — upload auto-selects, exactly as the inline embed did.

### 3.4 `ResourceForm` — `MediaField` becomes a `MediaSlot` (modified)

`MediaField` in `src/admin/ResourceForm.jsx` swaps its inline `UploadField` + `MediaPicker`
body for one `MediaSlot`, passing through the field chrome and the `mediaResource` it already
loads. The media `useResource` fetch stays exactly where it is (one fetch per form mount when a
media field exists — the slot needs the library to resolve its thumbnail anyway). No change to
the config shape, validation, `buildPayload`, or any other field type. This fixes the gallery,
weddings (Cover Photo), and films (Thumbnail) forms in one place.

### 3.5 `SettingsForm` — three slots instead of three grids (modified)

Each `IMAGE_SLOTS` fieldset becomes a `MediaSlot` (`required: false` → all three keep a Remove
button, since all three media columns are nullable and the public site falls back to the shipped
static image — see `src/lib/queries/siteSettings.js`). Props into `SettingsForm` are unchanged;
only its rendering of the three slots changes. The Settings page drops from ~195 tiles to three
thumbnails.

### 3.6 `WeddingPhotos` — multi-attach through the dialog (modified)

The "Add a Photograph" section's inline `UploadField` + grid is replaced by one
"Add photographs" button that opens `MediaPickerDialog` with:

- `selectedIds` = the already-attached `mediaId`s — attached photos read "✓ Selected".
- `onSelect`: if the photo is not yet attached, `runAction('add', media.id)`; if it is already
  attached, the click is a no-op (detaching stays on the existing Remove buttons in the
  attached-photos grid, with their confirm). The dialog **stays open** so several photos can be
  attached in one visit.
- `onUploaded`: reload the library resource and attach the new photo (today's behaviour),
  staying open.
- `closeLabel: "Done"`.

The attached-photos grid above (with its ↑/↓/Remove controls) is unchanged.

### 3.7 List thumbnails (modified: `adminContent.js`, resource configs, `ResourceList`)

- `makeResourceQueries(table, columns, options = {})` gains `options.thumbnailColumn` — the
  snake_case FK column pointing at `media` (e.g. `'media_id'`). When present, every `select`
  the factory builds appends `, thumbnail:{thumbnailColumn}(storage_path)` — the same
  alias-by-FK-column embed `src/lib/queries/siteSettings.js` already uses — and `rowToItem`
  additionally maps `item.thumbnailPath = row.thumbnail?.storage_path ?? null`. `valuesToRow`
  is untouched: `thumbnailPath` is not a declared column, so it can never be written back.
  `create`/`update` use the same select, so returned items also carry `thumbnailPath` and the
  list stays consistent after a mutation without special-casing.
- Resource configs declare it: gallery `thumbnailColumn: 'media_id'`, weddings
  `'cover_media_id'`, films `'thumbnail_media_id'`; the factory calls pass it through.
  Testimonials declares nothing and is untouched.
- `ResourceList`: when `config.thumbnailColumn` is set, a leading column renders a small square
  thumbnail (`mediaUrl(item.thumbnailPath)`; a neutral empty box when null), with an sr-only
  "Photo" header cell. Everything else in the table is unchanged.

### 3.8 Navigation smoothness (modified: `src/admin/App.jsx`, new tiny hook)

- **Scroll to top** — `src/admin/useScrollToTop.js`: a hook that runs
  `window.scrollTo(0, 0)` in an effect whenever its dependency changes. `AdminDashboard` calls
  it with `tab`; Weddings/Gallery/Films/Testimonials dashboards call it with `view.mode`.
  (Leads and Settings have no internal view switch; the tab-level hook covers entering them.)
- **Tab in the URL hash** — `AdminDashboard`'s initial tab comes from `location.hash.slice(1)`
  when it names a key in `DASHBOARD_TABS`, else `'dashboard'`. Every tab change (including the
  Media Library → Gallery hand-off) writes the hash via
  ``history.replaceState(null, '', `#${key}`)`` — `replaceState`, not assignment, so
  tab-hopping does not pile up history entries.
  Refresh restores the tab; an invalid or absent hash lands on Dashboard.

## 4. Error handling

- The dialog inherits `MediaPicker`'s three states unchanged: load error (message + Retry via
  `onRetry`), loading, and empty. Search's zero-match state is additional and purely local.
- `MediaSlot` renders its field `error` (required-field validation) inline in the fieldset,
  exactly where `MediaField`'s error renders today.
- Upload errors stay inside `UploadField`, which already owns them — embedding it in the dialog
  changes nothing about its error handling.
- A `thumbnailPath` that cannot be resolved to a URL (null path, or `mediaUrl` returning null)
  renders the neutral empty box, never a broken `<img>` — same principle as `MediaPicker`'s
  existing No Preview box.

## 5. Testing

All jsdom/Vitest, following the existing admin test patterns (`window.scrollTo` is already
no-op'd and `localStorage`/`matchMedia` stubbed in `src/test/setup.js`).

- `MediaPickerDialog.test.jsx` (new): renders nothing when closed; open shows title, search,
  grid; search filters by alt text and file name and shows the count line; zero-match copy;
  Esc and ✕ call `onClose`; tile click calls `onSelect` without closing; upload path calls
  `onUploaded`; body overflow toggles; focus lands on search on open.
- `MediaSlot.test.jsx` (new): empty state shows "Choose photograph"; opening, selecting, and
  the dialog closing; thumbnail renders for a resolvable value; id-text fallback for an
  unresolvable one; Remove appears only when optional and clears to null; upload auto-selects.
- `MediaPicker.test.jsx` (updated): `selectedIds` highlighting; image-as-button when
  `onSelect` present; no image button when absent.
- `ResourceForm.test.jsx` (updated): the media field now opens a dialog instead of rendering
  the grid inline; select-through-dialog updates the field; validation error still renders.
- `SettingsForm.test.jsx` (updated): three slots render as compact controls; changing one slot
  through its dialog updates the save payload.
- `WeddingPhotos.test.jsx` (updated): "Add photographs" opens the dialog; selecting an
  unattached photo calls add and the dialog stays open; an attached photo shows as selected
  and clicking it does not call add again.
- `ResourceList.test.jsx` (updated): thumbnail column renders when `thumbnailColumn` is set,
  absent when not (testimonials).
- `adminContent.test.js` (updated): `thumbnailColumn` appends the embed to the select and maps
  `thumbnailPath`; `valuesToRow` never writes it back.
- `App.test.jsx` (updated): initial tab honours a valid hash and falls back on an invalid one;
  tab clicks write the hash; Add-to-Gallery still lands on the prefilled form (its slot shows
  the selection); scroll-to-top hook covered by asserting `window.scrollTo` is called on tab
  change (spy on the stub).

## 6. Documentation duties

`docs/COMPONENTS.md` gains rows for `MediaPickerDialog` and `MediaSlot` and updates the
`MediaPicker`/`ResourceForm`/`SettingsForm`/`WeddingPhotos`/`ResourceList` rows.
`docs/ARCHITECTURE.md`'s admin paragraph gets one sentence on the dialog pattern.
`docs/ROADMAP.md` gains the Phase 3d / `v0.4d` row. `npm run check:docs` enforces all of it.

## 7. Phase mechanics

One branch (`phase-3d/admin-ux-polish`), Conventional Commits, full gates before merge
(`npm test`, `npm run lint`, `npm run check:docs`, `npm run build`), merge to `main` locally
and tag `v0.4d`, matching every previous phase. No migrations, so no database steps and no
`verify:admin` changes.
