import {
  describe, it, expect, vi,
} from 'vitest';

const mockQueries = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  reorder: vi.fn(),
};
const makeResourceQueries = vi.fn(() => mockQueries);

vi.mock('../../../lib/queries/adminContent', () => ({
  makeResourceQueries: (...args) => makeResourceQueries(...args),
}));

const { galleryResource, galleryQueries } = await import('../gallery.js');

describe('galleryResource config', () => {
  it('points at the gallery_photos table, sorted by sort_order', () => {
    expect(galleryResource.table).toBe('gallery_photos');
    expect(galleryResource.defaultSort).toBe('sort_order');
    expect(galleryResource.key).toBe('gallery');
  });

  it('is built on makeResourceQueries with its own table and columns', () => {
    expect(makeResourceQueries).toHaveBeenCalledWith('gallery_photos', galleryResource.columns);
  });

  it('never puts status in fields — every resource has it, but ResourceList owns the toggle', () => {
    expect(galleryResource.fields.some((f) => f.name === 'status')).toBe(false);
  });

  it('uses the media field type for the photograph, writing straight to media_id', () => {
    const field = galleryResource.fields.find((f) => f.name === 'mediaId');
    expect(field).toBeDefined();
    expect(field.type).toBe('media');
    expect(field.required).toBe(true);
    expect(galleryResource.columns).toContain('media_id');
  });

  // src/components/PhotoGallery.jsx renders ceremony sections from exactly
  // these categories (appending unknowns rather than dropping them) — a
  // closed set, so this is a `select`, not free text a typo could turn into
  // a stray one-off section.
  it('uses a select for category, matching the ceremony sections PhotoGallery.jsx renders', () => {
    const field = galleryResource.fields.find((f) => f.name === 'category');
    expect(field).toBeDefined();
    expect(field.type).toBe('select');
    expect(field.required).toBe(true);
    expect(field.options.map((o) => o.value)).toEqual(
      ['Pre-Wedding', 'Wedding', 'Engagement', 'Haldi & Mehendi'],
    );
  });

  // Every one of the 8 seed rows in src/data/weddingData.js's INITIAL_PHOTOS
  // uses one of exactly these four Tailwind span strings — the same four the
  // task brief itself points at ("a free-text field that must match one of
  // four strings is a typo waiting to break a layout").
  it('uses a select for grid size, closed to the four span strings actually used in seed data', () => {
    const field = galleryResource.fields.find((f) => f.name === 'gridSpan');
    expect(field).toBeDefined();
    expect(field.type).toBe('select');
    expect(field.required).toBe(false);
    expect(field.options.map((o) => o.value)).toEqual([
      'col-span-1 row-span-1',
      'col-span-1 md:col-span-2 row-span-1',
      'col-span-1 row-span-1 md:row-span-2',
      'col-span-1 md:col-span-2 row-span-2',
    ]);
    expect(galleryResource.columns).toContain('grid_span');
  });

  it('lists title, category, couple, and status as the columns an admin sees at a glance', () => {
    expect(galleryResource.listColumns.map((c) => c.name)).toEqual(
      expect.arrayContaining(['title', 'category', 'couple', 'status']),
    );
  });

  it('requires exactly mediaId, title, and category', () => {
    const required = galleryResource.fields.filter((f) => f.required).map((f) => f.name);
    expect(required.sort()).toEqual(['category', 'mediaId', 'title'].sort());
  });

  // couple, location, and grid_span are nullable text columns; sort_order is
  // `int not null default 0` (supabase/migrations/20260730203451_initial_
  // schema.sql) — a blank field must clear to what its own column expects,
  // not null for sort_order, which Postgres rejects with 23502.
  it('declares emptyValue null for every nullable optional field, and 0 for sort_order', () => {
    const byName = (name) => galleryResource.fields.find((f) => f.name === name);
    expect(byName('couple').emptyValue).toBeNull();
    expect(byName('location').emptyValue).toBeNull();
    expect(byName('gridSpan').emptyValue).toBeNull();
    expect(byName('sortOrder').emptyValue).toBe(0);
  });
});

describe('galleryQueries', () => {
  it('is exactly the base factory\'s queries, unwrapped — gallery photos need no create-time derivation the way weddings.slug does', () => {
    expect(galleryQueries).toBe(mockQueries);
  });
});
