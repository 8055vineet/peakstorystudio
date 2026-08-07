import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';

const mockFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
  },
}));

beforeEach(() => { vi.resetModules(); mockFrom.mockReset(); mockRpc.mockReset(); });

function listChain(rows, error = null) {
  const c = {};
  c.select = vi.fn(() => c);
  c.order = vi.fn(() => Promise.resolve({ data: rows, error }));
  return c;
}

function maxChain(rows) {
  const c = {};
  c.select = vi.fn(() => c);
  c.order = vi.fn(() => c);
  c.limit = vi.fn(() => Promise.resolve({ data: rows, error: null }));
  return c;
}

function insertChain(error = null) {
  const c = {};
  c.insert = vi.fn(() => Promise.resolve({ error }));
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

function countChain(count, error = null) {
  const c = {};
  c.select = vi.fn(() => c);
  c.eq = vi.fn(() => Promise.resolve({ count, error }));
  return c;
}

describe('listGalleryCategories', () => {
  it('lists id/name/sortOrder in sort order', async () => {
    const c = listChain([{ id: 'cat-1', name: 'Wedding', sort_order: 0 }]);
    mockFrom.mockReturnValue(c);
    const { listGalleryCategories } = await import('../adminGalleryCategories.js');
    const result = await listGalleryCategories();
    expect(mockFrom).toHaveBeenCalledWith('gallery_categories');
    expect(result).toEqual([{ id: 'cat-1', name: 'Wedding', sortOrder: 0 }]);
  });

  it('throws prefixed on failure', async () => {
    mockFrom.mockReturnValue(listChain(null, { message: 'denied' }));
    const { listGalleryCategories } = await import('../adminGalleryCategories.js');
    await expect(listGalleryCategories()).rejects.toThrow(/gallery_categories: list failed: denied/);
  });
});

describe('addGalleryCategory', () => {
  it('appends after the current max sort_order', async () => {
    mockFrom.mockReturnValueOnce(maxChain([{ sort_order: 3 }]));
    const ins = insertChain();
    mockFrom.mockReturnValueOnce(ins);
    const { addGalleryCategory } = await import('../adminGalleryCategories.js');
    await addGalleryCategory('Travel Diaries');
    expect(ins.insert).toHaveBeenCalledWith({ name: 'Travel Diaries', sort_order: 4 });
  });
});

describe('renameGalleryCategory', () => {
  it('calls the atomic rename RPC with old and new names', async () => {
    mockRpc.mockResolvedValue({ error: null });
    const { renameGalleryCategory } = await import('../adminGalleryCategories.js');
    await renameGalleryCategory('Wedding', 'Wedding Day');
    expect(mockRpc).toHaveBeenCalledWith('rename_gallery_category', { p_old: 'Wedding', p_new: 'Wedding Day' });
  });

  it('throws prefixed on failure', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'duplicate key' } });
    const { renameGalleryCategory } = await import('../adminGalleryCategories.js');
    await expect(renameGalleryCategory('A', 'B')).rejects.toThrow(/gallery_categories: rename failed: duplicate key/);
  });
});

describe('reorderGalleryCategories', () => {
  it('writes each id\'s index as its sort_order', async () => {
    const chains = [];
    mockFrom.mockImplementation(() => {
      const c = updateChain();
      chains.push(c);
      return c;
    });
    const { reorderGalleryCategories } = await import('../adminGalleryCategories.js');
    await reorderGalleryCategories(['b', 'a']);
    expect(chains[0].update).toHaveBeenCalledWith({ sort_order: 0 });
    expect(chains[0].eq).toHaveBeenCalledWith('id', 'b');
    expect(chains[1].eq).toHaveBeenCalledWith('id', 'a');
  });
});

describe('removeGalleryCategory', () => {
  it('refuses to delete a category photographs still use, naming the count', async () => {
    mockFrom.mockReturnValueOnce(countChain(3));
    const { removeGalleryCategory } = await import('../adminGalleryCategories.js');
    await expect(removeGalleryCategory('cat-1', 'Wedding')).rejects.toThrow('Cannot delete "Wedding" — 3 photograph(s) still use it.');
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('gallery_photos');
  });

  it('deletes an unused category by id', async () => {
    mockFrom.mockReturnValueOnce(countChain(0));
    const del = deleteChain();
    mockFrom.mockReturnValueOnce(del);
    const { removeGalleryCategory } = await import('../adminGalleryCategories.js');
    await removeGalleryCategory('cat-1', 'Unused');
    expect(del.eq).toHaveBeenCalledWith('id', 'cat-1');
  });
});
