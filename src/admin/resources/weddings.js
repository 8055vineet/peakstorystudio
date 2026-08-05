import { makeResourceQueries } from '../../lib/queries/adminContent';

// ASCII, URL-safe normalization — deliberately independent from
// scripts/seed-db.mjs's own local slugify rather than importing it: that
// script is a one-off migration tool with no export, and this is the only
// other place in the app that ever needs the same rule.
function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const weddingsResource = {
  key: 'weddings',
  label: 'Weddings',
  table: 'weddings',
  // weddings.slug (supabase/migrations/20260730203451_initial_schema.sql)
  // is `text unique not null` with no database default. It is deliberately
  // NOT one of `fields` below — Task 8's brief never asks an admin to
  // hand-author a URL slug just to save a title, and per-wedding public
  // URLs are Phase 5 work, not this one's — but it still has to be in
  // `columns` so the factory's `select` can read it back and its `create`
  // can write the value `weddingsQueries.create` (below) derives. Never
  // written by `update`: valuesToRow in adminContent.js only writes a
  // column when the values object actually has that camelCase key, and no
  // ResourceForm submission for this config ever will.
  columns: [
    'id', 'slug', 'title', 'couple', 'location', 'event_date', 'summary',
    'cover_media_id', 'tags', 'sort_order', 'status',
  ],
  defaultSort: 'sort_order',
  // ResourceList renders a leading photo column from this, and the factory
  // call below joins the same column's storage_path server-side.
  thumbnailColumn: 'cover_media_id',
  listColumns: [
    { name: 'title', label: 'Title' },
    { name: 'couple', label: 'Couple' },
    { name: 'eventDate', label: 'Date' },
    { name: 'status', label: 'Status' },
  ],
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'couple', label: 'Couple', type: 'text', required: true },
    { name: 'location', label: 'Location', type: 'text', required: true },
    // PS-022: a real date picker, never free text — the old Content
    // Manager had no date input at all, so everything it published was
    // stamped 2025. `type: 'date'` hands this straight through as an ISO
    // YYYY-MM-DD string end to end; see ResourceForm.jsx's own module
    // comment on `Field` for why no Date object ever touches this value.
    // `event_date` is a nullable `date` column, so a blank field clears to
    // `null` — never `''`, which Postgres rejects with `22P02`.
    {
      name: 'eventDate', label: 'Date', type: 'date', required: false, emptyValue: null,
    },
    // `summary` is a nullable `text` column.
    {
      name: 'summary', label: 'Description', type: 'textarea', required: false, emptyValue: null,
    },
    {
      name: 'coverMediaId',
      label: 'Cover Photo',
      type: 'media',
      required: false,
      // `cover_media_id` is a nullable `uuid` column, so a blank field
      // clears to `null` — never `''`, which Postgres rejects with `22P02`.
      emptyValue: null,
      help: "Shown as the story's cover image on the public site.",
    },
    // weddings.tags is text[] and is read directly by
    // src/components/StoryDetailModal.jsx on the public site — losing it
    // here means the public site loses it too.
    {
      name: 'tags',
      label: 'Tags',
      type: 'tags',
      required: false,
      help: 'Shown as filter chips on the public site.',
    },
    // `sort_order` is `int not null default 0` — the column's own default,
    // never `null`, which Postgres rejects with `23502`.
    {
      name: 'sortOrder', label: 'Order', type: 'number', required: false, emptyValue: 0,
    },
  ],
};

const baseQueries = makeResourceQueries(
  weddingsResource.table,
  weddingsResource.columns,
  { thumbnailColumn: weddingsResource.thumbnailColumn },
);

export const weddingsQueries = {
  ...baseQueries,
  // Derives `slug` from `title` before delegating to the base factory's
  // create — see the `columns` comment above for why this exists at all.
  // Suffixed with 8 hex characters off a random UUID (not a counter or a
  // timestamp: two real weddings can share a title — different couples of
  // the same name in different years — and a millisecond timestamp is not
  // guaranteed unique under concurrent admin writes) so two same-titled
  // weddings never collide against the unique constraint.
  create(values) {
    const base = slugify(values?.title) || 'wedding';
    const suffix = crypto.randomUUID().split('-')[0];
    return baseQueries.create({ ...values, slug: `${base}-${suffix}` });
  },
};
