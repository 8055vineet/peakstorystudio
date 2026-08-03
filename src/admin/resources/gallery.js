import { makeResourceQueries } from '../../lib/queries/adminContent';

// gallery_photos.category (supabase/migrations/20260730203451_initial_schema.sql) is `text not
// null` with no check constraint — Postgres would accept any string — but the public gallery
// only ever renders five: src/components/PhotoGallery.jsx hardcodes its filter chips to exactly
// ['All', 'Royal', 'Candid', 'Pre-Wedding', 'Rituals', 'Details'] (`All` being the "show
// everything" meta-option, not a real category) and every one of the 8 seed rows in
// src/data/weddingData.js's INITIAL_PHOTOS uses one of the other five. A sixth value would still
// save, still render under "All," and simply never be reachable through the filter — invisible
// breakage, not a crash. That makes this a genuinely closed set: `select`, not free text, so a
// typo can't quietly orphan a photo from its own filter.
const CATEGORY_OPTIONS = [
  { value: 'Royal', label: 'Royal' },
  { value: 'Candid', label: 'Candid' },
  { value: 'Pre-Wedding', label: 'Pre-Wedding' },
  { value: 'Rituals', label: 'Rituals' },
  { value: 'Details', label: 'Details' },
];

// gallery_photos.grid_span stores a literal Tailwind utility-class string, read straight through
// by src/lib/queries/gallery.js into `photo.span` and consumed by PhotoGallery.jsx as
// `photo.span || 'col-span-1 row-span-1'` — a fallback that only fires for the 4-column layout
// (the 1- and 2-column views ignore `span` entirely). This is tracked debt, not something this
// task fixes: docs/DATA-MODEL.md's "Field-level problems" section already names grid_span as
// still embedding literal Tailwind classes in the data layer, coupling content to one CSS
// framework and one grid config — a schema change to something framework-neutral is out of
// scope here (schema changes only happen in supabase/migrations/, and this task touches neither).
// What IS in scope: every one of the 8 seed photos uses one of exactly four span strings, so a
// free-text input here is, verbatim, "a typo waiting to break a layout" — get the responsive
// prefix or the class name wrong and the photo silently mis-sizes itself in the grid. A `select`
// over those same four values, labelled by shape rather than by class name, cannot produce a
// fifth, invalid string.
const GRID_SPAN_OPTIONS = [
  { value: 'col-span-1 row-span-1', label: 'Standard (1×1)' },
  { value: 'col-span-1 md:col-span-2 row-span-1', label: 'Wide (2×1)' },
  { value: 'col-span-1 row-span-1 md:row-span-2', label: 'Tall (1×2)' },
  { value: 'col-span-1 md:col-span-2 row-span-2', label: 'Wide + Tall (2×2)' },
];

export const galleryResource = {
  key: 'gallery',
  label: 'Gallery',
  table: 'gallery_photos',
  columns: [
    'id', 'media_id', 'title', 'category', 'couple', 'location', 'grid_span', 'sort_order', 'status',
  ],
  defaultSort: 'sort_order',
  listColumns: [
    { name: 'title', label: 'Title' },
    { name: 'category', label: 'Category' },
    { name: 'couple', label: 'Couple' },
    { name: 'status', label: 'Status' },
  ],
  fields: [
    {
      name: 'mediaId',
      label: 'Photograph',
      type: 'media',
      required: true,
      help: 'The image shown in the public gallery grid.',
    },
    { name: 'title', label: 'Title', type: 'text', required: true },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      required: true,
      options: CATEGORY_OPTIONS,
      help: 'These five are the only categories the public gallery\'s filter chips recognise.',
    },
    // `couple` and `location` are nullable `text` columns.
    {
      name: 'couple', label: 'Couple', type: 'text', required: false, emptyValue: null,
    },
    {
      name: 'location', label: 'Location', type: 'text', required: false, emptyValue: null,
    },
    {
      name: 'gridSpan',
      label: 'Grid Size',
      type: 'select',
      required: false,
      // `grid_span` is a nullable `text` column.
      emptyValue: null,
      options: GRID_SPAN_OPTIONS,
      help: 'How much room this photo takes in the 4-column gallery layout. Ignored in the 1- and 2-column views. Leave unset for Standard.',
    },
    // `sort_order` is `int not null default 0` — the column's own default,
    // never `null`, which Postgres rejects with `23502`.
    {
      name: 'sortOrder', label: 'Order', type: 'number', required: false, emptyValue: 0,
    },
  ],
};

export const galleryQueries = makeResourceQueries(galleryResource.table, galleryResource.columns);
