import { makeResourceQueries } from '../../lib/queries/adminContent';

// Same local slugify as src/admin/resources/weddings.js, and deliberately
// not shared with it — see that file's comment for why each caller keeps
// its own copy of this three-line rule.
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
  // `slug` is not one of `fields` (an admin never hand-authors a URL just
  // to add a page) but must be in `columns` so create() can write the value
  // collectionsQueries derives below, and so the list can show it.
  columns: ['id', 'slug', 'title', 'description', 'sort_order', 'status'],
  defaultSort: 'sort_order',
  // Appended to ResourceList's delete confirmation: deleting a page
  // cascades to its items (see the migration's on delete cascade), but the
  // photographs themselves live in the media library and survive.
  deleteNote: "The page's items go with it; photographs stay in the media library.",
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
