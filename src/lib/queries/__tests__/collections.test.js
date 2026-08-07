import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

beforeEach(() => { vi.resetModules(); mockFrom.mockReset(); });

const ROWS = [{
  id: 'c-1',
  slug: 'travels',
  title: 'Travels',
  description: 'On the road.',
  items: [
    { id: 'i-1', video_embed_url: null, caption: null, media: { storage_path: '/images/x/1.jpg' } },
    { id: 'i-2', video_embed_url: 'https://www.youtube.com/embed/abc', caption: 'Teaser', media: null },
  ],
}];

function chain(rows, error = null) {
  const c = {};
  c.select = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  // getCollections orders twice: collections, then the embedded items.
  c.order = vi.fn(() => c);
  c.then = (resolve, reject) => Promise.resolve({ data: rows, error }).then(resolve, reject);
  return c;
}

describe('getCollections', () => {
  it('maps published collections with photo and video items', async () => {
    const c = chain(ROWS);
    mockFrom.mockReturnValue(c);
    const { getCollections } = await import('../collections.js');
    const result = await getCollections();
    expect(mockFrom).toHaveBeenCalledWith('collections');
    expect(c.eq).toHaveBeenCalledWith('status', 'published');
    expect(c.order).toHaveBeenCalledWith('sort_order');
    expect(c.order).toHaveBeenCalledWith('sort_order', { foreignTable: 'collection_items' });
    expect(result[0].slug).toBe('travels');
    expect(result[0].items[0]).toEqual({
      id: 'i-1', url: '/images/x/1.jpg', videoEmbedUrl: null, caption: null,
    });
    expect(result[0].items[1].videoEmbedUrl).toBe('https://www.youtube.com/embed/abc');
    expect(result[0].items[1].url).toBe('');
  });

  it('throws a prefixed error on failure', async () => {
    mockFrom.mockReturnValue(chain(null, { message: 'nope' }));
    const { getCollections } = await import('../collections.js');
    await expect(getCollections()).rejects.toThrow('getCollections: nope');
  });
});
