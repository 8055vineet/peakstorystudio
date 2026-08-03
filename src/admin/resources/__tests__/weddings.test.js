import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';

const mockCreate = vi.fn();
const mockBaseQueries = {
  list: vi.fn(),
  create: (...args) => mockCreate(...args),
  update: vi.fn(),
  remove: vi.fn(),
  reorder: vi.fn(),
};
const makeResourceQueries = vi.fn(() => mockBaseQueries);

vi.mock('../../../lib/queries/adminContent', () => ({
  makeResourceQueries: (...args) => makeResourceQueries(...args),
}));

const { weddingsResource, weddingsQueries } = await import('../weddings.js');

beforeEach(() => {
  mockCreate.mockReset();
});

describe('weddingsResource config', () => {
  it('points at the weddings table, sorted by sort_order', () => {
    expect(weddingsResource.table).toBe('weddings');
    expect(weddingsResource.defaultSort).toBe('sort_order');
    expect(weddingsResource.key).toBe('weddings');
  });

  it('is built on makeResourceQueries with its own table and columns', () => {
    expect(makeResourceQueries).toHaveBeenCalledWith('weddings', weddingsResource.columns);
  });

  it('never puts status in fields — every resource has it, but ResourceList owns the toggle', () => {
    expect(weddingsResource.fields.some((f) => f.name === 'status')).toBe(false);
  });

  it('never puts slug in fields — an admin should not have to hand-author a URL slug to save a title', () => {
    expect(weddingsResource.fields.some((f) => f.name === 'slug')).toBe(false);
  });

  it('includes slug and id in columns, since the database column is NOT NULL and the factory still needs to read/write it', () => {
    expect(weddingsResource.columns).toEqual(expect.arrayContaining(['id', 'slug']));
  });

  it('uses the date field type for the wedding date, writing straight to event_date', () => {
    const dateField = weddingsResource.fields.find((f) => f.name === 'eventDate');
    expect(dateField).toBeDefined();
    expect(dateField.type).toBe('date');
    expect(weddingsResource.columns).toContain('event_date');
  });

  it('uses the tags field type for tags — rendered on the public site by StoryDetailModal', () => {
    const tagsField = weddingsResource.fields.find((f) => f.name === 'tags');
    expect(tagsField).toBeDefined();
    expect(tagsField.type).toBe('tags');
    expect(weddingsResource.columns).toContain('tags');
  });

  it('uses the media field type for the cover photo, writing straight to cover_media_id', () => {
    const coverField = weddingsResource.fields.find((f) => f.name === 'coverMediaId');
    expect(coverField).toBeDefined();
    expect(coverField.type).toBe('media');
    expect(weddingsResource.columns).toContain('cover_media_id');
  });

  it('lists title, couple, date, and status as the columns an admin sees at a glance', () => {
    expect(weddingsResource.listColumns.map((c) => c.name)).toEqual(
      expect.arrayContaining(['title', 'couple', 'eventDate', 'status']),
    );
  });

  it('requires title, couple, and location', () => {
    const required = weddingsResource.fields.filter((f) => f.required).map((f) => f.name);
    expect(required).toEqual(expect.arrayContaining(['title', 'couple', 'location']));
  });
});

describe('weddingsQueries', () => {
  it('exposes list, update, remove, and reorder straight from the base factory, unwrapped', () => {
    expect(weddingsQueries.list).toBe(mockBaseQueries.list);
    expect(weddingsQueries.update).toBe(mockBaseQueries.update);
    expect(weddingsQueries.remove).toBe(mockBaseQueries.remove);
    expect(weddingsQueries.reorder).toBe(mockBaseQueries.reorder);
  });

  describe('create', () => {
    // weddings.slug is `text unique not null` with no database default (see
    // supabase/migrations/20260730203451_initial_schema.sql) — verified
    // before writing this wrapper. It is not one of ResourceForm's fields
    // (see the config tests above), so a submission from the admin form
    // never carries a `slug` key at all. Without this wrapper every
    // create() would fail the NOT NULL constraint on every single wedding
    // an admin ever tries to add.
    it('derives a slug from the title and passes every other field through unchanged', async () => {
      mockCreate.mockResolvedValue({ id: 'wedding-1' });

      await weddingsQueries.create({
        title: 'A Palace Wedding', couple: 'Aisha & Dev', location: 'Udaipur', eventDate: '2027-03-01',
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const payload = mockCreate.mock.calls[0][0];
      expect(payload).toMatchObject({
        title: 'A Palace Wedding', couple: 'Aisha & Dev', location: 'Udaipur', eventDate: '2027-03-01',
      });
      expect(payload.slug).toMatch(/^a-palace-wedding-[a-z0-9]+$/);
    });

    it('produces a URL-safe slug even from a title with punctuation and mixed case', async () => {
      mockCreate.mockResolvedValue({});

      await weddingsQueries.create({ title: "Priya & Arjun's Wedding!" });

      const { slug } = mockCreate.mock.calls[0][0];
      expect(slug).toMatch(/^priya-arjun-s-wedding-[a-z0-9]+$/);
    });

    it('falls back to a generic slug base when the title is blank', async () => {
      mockCreate.mockResolvedValue({});

      await weddingsQueries.create({ title: '' });

      const { slug } = mockCreate.mock.calls[0][0];
      expect(slug).toMatch(/^wedding-[a-z0-9]+$/);
    });

    it('produces different slugs for two weddings created with the same title, so they cannot collide', async () => {
      mockCreate.mockResolvedValue({});

      await weddingsQueries.create({ title: 'Same Title' });
      const first = mockCreate.mock.calls[0][0].slug;
      await weddingsQueries.create({ title: 'Same Title' });
      const second = mockCreate.mock.calls[1][0].slug;

      expect(first).not.toBe(second);
    });

    it('resolves with whatever the base create resolved with', async () => {
      mockCreate.mockResolvedValue({ id: 'wedding-9', slug: 'whatever-the-db-actually-stored' });

      const result = await weddingsQueries.create({ title: 'A Wedding' });

      expect(result).toEqual({ id: 'wedding-9', slug: 'whatever-the-db-actually-stored' });
    });
  });
});
