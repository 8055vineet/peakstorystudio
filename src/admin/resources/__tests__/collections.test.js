import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';

const baseCreate = vi.fn();
const mockQueries = {
  list: vi.fn(),
  create: (...args) => baseCreate(...args),
  update: vi.fn(),
  remove: vi.fn(),
  reorder: vi.fn(),
};
const makeResourceQueries = vi.fn(() => mockQueries);

vi.mock('../../../lib/queries/adminContent', () => ({
  makeResourceQueries: (...args) => makeResourceQueries(...args),
}));

const { collectionsResource, collectionsQueries } = await import('../collections.js');

beforeEach(() => { baseCreate.mockReset(); });

describe('collectionsResource config', () => {
  it('points at the collections table as the Pages tab, sorted by sort_order', () => {
    expect(collectionsResource.table).toBe('collections');
    expect(collectionsResource.key).toBe('pages');
    expect(collectionsResource.label).toBe('Pages');
    expect(collectionsResource.defaultSort).toBe('sort_order');
  });

  it('is built on makeResourceQueries with its own table and columns, no thumbnail', () => {
    expect(makeResourceQueries).toHaveBeenCalledWith('collections', collectionsResource.columns, {});
  });

  it('asks only for a title (required) and an optional description', () => {
    expect(collectionsResource.fields.map((f) => f.name)).toEqual(['title', 'description']);
    expect(collectionsResource.fields[0].required).toBe(true);
    expect(collectionsResource.fields[1]).toMatchObject({ required: false, emptyValue: null });
  });

  it('never puts status or slug in fields', () => {
    expect(collectionsResource.fields.some((f) => f.name === 'status' || f.name === 'slug')).toBe(false);
  });
});

describe('collectionsQueries.create — pretty slugs with a collision retry', () => {
  it('creates with a clean slug from the title', async () => {
    baseCreate.mockResolvedValue({ id: 'c-1' });
    await collectionsQueries.create({ title: 'Travel Diaries!' });
    expect(baseCreate).toHaveBeenCalledWith(expect.objectContaining({ slug: 'travel-diaries' }));
  });

  it('retries once with a suffix when the slug collides', async () => {
    baseCreate
      .mockRejectedValueOnce(new Error('collections: create failed: duplicate key value violates unique constraint "collections_slug_key"'))
      .mockResolvedValueOnce({ id: 'c-2' });
    await collectionsQueries.create({ title: 'Travels' });
    expect(baseCreate).toHaveBeenCalledTimes(2);
    expect(baseCreate.mock.calls[1][0].slug).toMatch(/^travels-[0-9a-f]{8}$/);
  });

  it('rethrows non-collision errors without retrying', async () => {
    baseCreate.mockRejectedValue(new Error('collections: create failed: permission denied'));
    await expect(collectionsQueries.create({ title: 'Travels' })).rejects.toThrow(/permission denied/);
    expect(baseCreate).toHaveBeenCalledTimes(1);
  });
});
