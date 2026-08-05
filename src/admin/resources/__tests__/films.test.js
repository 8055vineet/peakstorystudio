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

const { filmsResource, filmsQueries } = await import('../films.js');

describe('filmsResource config', () => {
  it('points at the films table, sorted by sort_order', () => {
    expect(filmsResource.table).toBe('films');
    expect(filmsResource.defaultSort).toBe('sort_order');
    expect(filmsResource.key).toBe('films');
  });

  it('is built on makeResourceQueries with its own table and columns', () => {
    expect(makeResourceQueries).toHaveBeenCalledWith('films', filmsResource.columns, { thumbnailColumn: 'thumbnail_media_id' });
  });

  it('never puts status in fields — every resource has it, but ResourceList owns the toggle', () => {
    expect(filmsResource.fields.some((f) => f.name === 'status')).toBe(false);
  });

  // Unlike gallery_photos.category or grid_span, a film's length is not a
  // small closed set — it stays a free-entry number, with help text stating
  // the unit (seconds) since the column name alone doesn't say so on screen.
  it('uses a plain number field for duration, in seconds, not a select', () => {
    const field = filmsResource.fields.find((f) => f.name === 'durationSeconds');
    expect(field).toBeDefined();
    expect(field.type).toBe('number');
    expect(field.required).toBe(false);
    expect(field.help).toMatch(/seconds/i);
    expect(filmsResource.columns).toContain('duration_seconds');
  });

  it('uses the media field type for the thumbnail, writing straight to thumbnail_media_id', () => {
    const field = filmsResource.fields.find((f) => f.name === 'thumbnailMediaId');
    expect(field).toBeDefined();
    expect(field.type).toBe('media');
    expect(filmsResource.columns).toContain('thumbnail_media_id');
  });

  // src/App.jsx places this value straight into an <iframe src="...">, so a
  // mistyped or watch-page URL silently breaks the film for every visitor —
  // the help text says what shape (an embed URL) is actually expected.
  it('requires video_embed_url and explains it must be an embed URL, not a watch-page link', () => {
    const field = filmsResource.fields.find((f) => f.name === 'videoEmbedUrl');
    expect(field).toBeDefined();
    expect(field.type).toBe('text');
    expect(field.required).toBe(true);
    expect(field.help).toMatch(/embed/i);
    expect(filmsResource.columns).toContain('video_embed_url');
  });

  it('lists title, couple, location, and status as the columns an admin sees at a glance', () => {
    expect(filmsResource.listColumns.map((c) => c.name)).toEqual(
      expect.arrayContaining(['title', 'couple', 'location', 'status']),
    );
  });

  it('requires exactly title and video_embed_url', () => {
    const required = filmsResource.fields.filter((f) => f.required).map((f) => f.name);
    expect(required.sort()).toEqual(['title', 'videoEmbedUrl'].sort());
  });

  // couple, location, duration_seconds, and thumbnail_media_id are all
  // nullable columns; sort_order is `int not null default 0` (supabase/
  // migrations/20260730203451_initial_schema.sql) — a blank field must clear
  // to what its own column expects. duration_seconds and sort_order share
  // `type: 'number'` but need opposite emptyValues, which is why this is
  // declared per field rather than inferred from type.
  it('declares emptyValue null for every nullable optional field, and 0 for sort_order', () => {
    const byName = (name) => filmsResource.fields.find((f) => f.name === name);
    expect(byName('couple').emptyValue).toBeNull();
    expect(byName('location').emptyValue).toBeNull();
    expect(byName('durationSeconds').emptyValue).toBeNull();
    expect(byName('thumbnailMediaId').emptyValue).toBeNull();
    expect(byName('sortOrder').emptyValue).toBe(0);
  });
});

describe('filmsQueries', () => {
  it('is exactly the base factory\'s queries, unwrapped — films need no create-time derivation the way weddings.slug does', () => {
    expect(filmsQueries).toBe(mockQueries);
  });
});
