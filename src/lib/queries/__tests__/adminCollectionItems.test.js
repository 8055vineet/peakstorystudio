import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

beforeEach(() => { vi.resetModules(); mockFrom.mockReset(); });

const ROW = {
  id: 'item-1',
  media_id: 'm-1',
  video_embed_url: null,
  caption: null,
  sort_order: 0,
  media: { storage_path: 'uploads/a.webp', alt_text: 'A' },
};

function listChain(rows, error = null) {
  const c = {};
  c.select = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.order = vi.fn(() => Promise.resolve({ data: rows, error }));
  return c;
}

// The max-sort_order read both adds perform first.
function maxChain(rows) {
  const c = {};
  c.select = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.order = vi.fn(() => c);
  c.limit = vi.fn(() => Promise.resolve({ data: rows, error: null }));
  return c;
}

function insertChain(row, error = null) {
  const c = {};
  c.insert = vi.fn(() => c);
  c.select = vi.fn(() => c);
  c.single = vi.fn(() => Promise.resolve({ data: row, error }));
  return c;
}

function deleteChain(error = null) {
  const c = {};
  c.delete = vi.fn(() => c);
  c.eq = vi.fn(() => Promise.resolve({ error }));
  return c;
}

function updateChain(error = null) {
  const c = {};
  c.update = vi.fn(() => c);
  c.eq = vi.fn(() => Promise.resolve({ error }));
  return c;
}

describe('listCollectionItems', () => {
  it('lists one page\'s items in sort order, mapped to camelCase with the media join', async () => {
    const c = listChain([ROW]);
    mockFrom.mockReturnValue(c);
    const { listCollectionItems } = await import('../adminCollectionItems.js');
    const result = await listCollectionItems('c-1');
    expect(mockFrom).toHaveBeenCalledWith('collection_items');
    expect(c.eq).toHaveBeenCalledWith('collection_id', 'c-1');
    expect(result).toEqual([{
      id: 'item-1', mediaId: 'm-1', videoEmbedUrl: null, caption: null, sortOrder: 0, storagePath: 'uploads/a.webp', altText: 'A',
    }]);
  });

  it('throws a prefixed error on failure', async () => {
    mockFrom.mockReturnValue(listChain(null, { message: 'denied' }));
    const { listCollectionItems } = await import('../adminCollectionItems.js');
    await expect(listCollectionItems('c-1')).rejects.toThrow(/listCollectionItems\(c-1\): denied/);
  });
});

describe('addCollectionPhoto', () => {
  it('appends after the current max sort_order', async () => {
    const max = maxChain([{ sort_order: 4 }]);
    const ins = insertChain({ ...ROW, sort_order: 5 });
    mockFrom.mockReturnValueOnce(max).mockReturnValueOnce(ins);
    const { addCollectionPhoto } = await import('../adminCollectionItems.js');
    const result = await addCollectionPhoto('c-1', 'm-1');
    expect(ins.insert).toHaveBeenCalledWith({ collection_id: 'c-1', media_id: 'm-1', sort_order: 5 });
    expect(result.sortOrder).toBe(5);
  });

  it('starts at 0 for an empty page', async () => {
    mockFrom.mockReturnValueOnce(maxChain([])).mockReturnValueOnce(insertChain(ROW));
    const { addCollectionPhoto } = await import('../adminCollectionItems.js');
    await addCollectionPhoto('c-1', 'm-1');
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });
});

describe('addCollectionVideo', () => {
  it('inserts the embed URL with optional poster and caption', async () => {
    const ins = insertChain({
      ...ROW, id: 'item-2', media_id: 'm-9', video_embed_url: 'https://www.youtube.com/embed/x', caption: 'Teaser',
    });
    mockFrom.mockReturnValueOnce(maxChain([{ sort_order: 0 }])).mockReturnValueOnce(ins);
    const { addCollectionVideo } = await import('../adminCollectionItems.js');
    const result = await addCollectionVideo('c-1', { videoEmbedUrl: 'https://www.youtube.com/embed/x', posterMediaId: 'm-9', caption: 'Teaser' });
    expect(ins.insert).toHaveBeenCalledWith({
      collection_id: 'c-1', video_embed_url: 'https://www.youtube.com/embed/x', media_id: 'm-9', caption: 'Teaser', sort_order: 1,
    });
    expect(result.videoEmbedUrl).toBe('https://www.youtube.com/embed/x');
  });

  it('defaults poster and caption to null', async () => {
    const ins = insertChain({ ...ROW, video_embed_url: 'https://v', media_id: null });
    mockFrom.mockReturnValueOnce(maxChain([])).mockReturnValueOnce(ins);
    const { addCollectionVideo } = await import('../adminCollectionItems.js');
    await addCollectionVideo('c-1', { videoEmbedUrl: 'https://v' });
    expect(ins.insert).toHaveBeenCalledWith({
      collection_id: 'c-1', video_embed_url: 'https://v', media_id: null, caption: null, sort_order: 0,
    });
  });
});

describe('removeCollectionItem', () => {
  it('deletes exactly the item row and never touches media', async () => {
    const del = deleteChain();
    mockFrom.mockReturnValue(del);
    const { removeCollectionItem } = await import('../adminCollectionItems.js');
    await removeCollectionItem('item-1');
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('collection_items');
    expect(del.eq).toHaveBeenCalledWith('id', 'item-1');
  });
});

describe('reorderCollectionItems', () => {
  it('writes each id\'s index as its sort_order', async () => {
    const chains = [];
    mockFrom.mockImplementation(() => {
      const c = updateChain();
      chains.push(c);
      return c;
    });
    const { reorderCollectionItems } = await import('../adminCollectionItems.js');
    await reorderCollectionItems(['b', 'a']);
    expect(chains[0].update).toHaveBeenCalledWith({ sort_order: 0 });
    expect(chains[0].eq).toHaveBeenCalledWith('id', 'b');
    expect(chains[1].update).toHaveBeenCalledWith({ sort_order: 1 });
    expect(chains[1].eq).toHaveBeenCalledWith('id', 'a');
  });

  it('throws when any write fails', async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call += 1;
      return updateChain(call === 2 ? { message: 'denied' } : null);
    });
    const { reorderCollectionItems } = await import('../adminCollectionItems.js');
    await expect(reorderCollectionItems(['a', 'b'])).rejects.toThrow(/reorderCollectionItems: denied/);
  });
});
