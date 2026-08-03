import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

const {
  listWeddingPhotos, addWeddingPhoto, removeWeddingPhoto, reorderWeddingPhotos,
} = await import('../adminWeddingPhotos.js');

// wedding_photos has no `id` column at all — composite primary key
// (wedding_id, media_id) — and no `status` column, which is exactly why this
// file cannot be makeResourceQueries(table, columns) like the other five
// content types (see src/lib/queries/adminContent.js). Every chain below is
// spied the same way src/lib/queries/__tests__/adminContent.test.js spies
// makeResourceQueries' own chains, so assertions can check exactly which
// calls were made.

function makeListChain({ rows = [], error = null } = {}) {
  const chain = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => Promise.resolve({ data: rows, error }));
  return chain;
}

function makeMaxSortOrderChain({ rows = [], error = null } = {}) {
  const chain = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve({ data: rows, error }));
  return chain;
}

function makeInsertChain({ error = null } = {}) {
  const chain = {};
  chain.insert = vi.fn(() => Promise.resolve({ error }));
  return chain;
}

function makeDeleteChain({ error = null } = {}) {
  const chain = {};
  chain.delete = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  // The second .eq() (media_id) is the one that actually resolves the
  // promise — chain.eq keeps returning `chain` until the caller awaits it,
  // matching how supabase-js's real filter builder is itself thenable.
  chain.then = (resolve) => resolve({ error });
  return chain;
}

function makeReorderStepChain({ error = null } = {}) {
  const chain = {};
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.then = (resolve) => resolve({ error });
  return chain;
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('listWeddingPhotos', () => {
  it('selects wedding_photos filtered to one wedding, joined to media, ordered by sort_order', async () => {
    const chain = makeListChain({
      rows: [
        {
          media_id: 'media-2', sort_order: 1, media: { id: 'media-2', storage_path: 'uploads/two.webp', alt_text: 'Two', width: 800, height: 600 },
        },
      ],
    });
    mockFrom.mockReturnValue(chain);

    const result = await listWeddingPhotos('wedding-1');

    expect(mockFrom).toHaveBeenCalledWith('wedding_photos');
    expect(chain.eq).toHaveBeenCalledWith('wedding_id', 'wedding-1');
    expect(chain.order).toHaveBeenCalledWith('sort_order', { ascending: true });
    expect(result).toEqual([{
      mediaId: 'media-2', sortOrder: 1, storagePath: 'uploads/two.webp', altText: 'Two', width: 800, height: 600,
    }]);
  });

  it('never returns every wedding\'s photos globally — always scoped to the given wedding_id', async () => {
    const chain = makeListChain({ rows: [] });
    mockFrom.mockReturnValue(chain);

    await listWeddingPhotos('wedding-9');

    expect(chain.eq).toHaveBeenCalledWith('wedding_id', 'wedding-9');
  });

  it('throws rather than resolving to an empty array when Postgres errors', async () => {
    mockFrom.mockReturnValue(makeListChain({ rows: null, error: { message: 'permission denied' } }));

    await expect(listWeddingPhotos('wedding-1')).rejects.toThrow(/permission denied/);
  });

  it('tolerates a row whose joined media is missing rather than throwing', async () => {
    mockFrom.mockReturnValue(makeListChain({
      rows: [{ media_id: 'media-1', sort_order: 0, media: null }],
    }));

    const result = await listWeddingPhotos('wedding-1');

    expect(result).toEqual([{
      mediaId: 'media-1', sortOrder: 0, storagePath: null, altText: '', width: null, height: null,
    }]);
  });
});

describe('addWeddingPhoto', () => {
  it('inserts one row at the next sort_order after the current highest', async () => {
    const maxChain = makeMaxSortOrderChain({ rows: [{ sort_order: 2 }] });
    const insertChain = makeInsertChain();
    mockFrom.mockReturnValueOnce(maxChain).mockReturnValueOnce(insertChain);

    await addWeddingPhoto('wedding-1', 'media-5');

    expect(maxChain.eq).toHaveBeenCalledWith('wedding_id', 'wedding-1');
    expect(maxChain.order).toHaveBeenCalledWith('sort_order', { ascending: false });
    expect(maxChain.limit).toHaveBeenCalledWith(1);
    expect(insertChain.insert).toHaveBeenCalledWith({ wedding_id: 'wedding-1', media_id: 'media-5', sort_order: 3 });
  });

  it('inserts at sort_order 0 for the first photo on a wedding', async () => {
    const maxChain = makeMaxSortOrderChain({ rows: [] });
    const insertChain = makeInsertChain();
    mockFrom.mockReturnValueOnce(maxChain).mockReturnValueOnce(insertChain);

    await addWeddingPhoto('wedding-1', 'media-1');

    expect(insertChain.insert).toHaveBeenCalledWith({ wedding_id: 'wedding-1', media_id: 'media-1', sort_order: 0 });
  });

  it('throws with a useful message when the insert fails', async () => {
    mockFrom.mockReturnValueOnce(makeMaxSortOrderChain({ rows: [] }));
    mockFrom.mockReturnValueOnce(makeInsertChain({ error: { message: 'duplicate key value violates unique constraint' } }));

    await expect(addWeddingPhoto('wedding-1', 'media-1')).rejects.toThrow(/duplicate key/);
  });

  it('never touches the media table — it only ever inserts into wedding_photos', async () => {
    mockFrom.mockReturnValueOnce(makeMaxSortOrderChain({ rows: [] }));
    mockFrom.mockReturnValueOnce(makeInsertChain());

    await addWeddingPhoto('wedding-1', 'media-1');

    expect(mockFrom).not.toHaveBeenCalledWith('media');
  });
});

describe('removeWeddingPhoto', () => {
  it('deletes exactly the one wedding_photos row, filtered by both wedding_id and media_id', async () => {
    const chain = makeDeleteChain();
    mockFrom.mockReturnValue(chain);

    await removeWeddingPhoto('wedding-1', 'media-5');

    expect(mockFrom).toHaveBeenCalledWith('wedding_photos');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('wedding_id', 'wedding-1');
    expect(chain.eq).toHaveBeenCalledWith('media_id', 'media-5');
  });

  // The one rule Task 8's brief calls out as destructive to get wrong: the
  // same photograph can be used by another wedding, or the public gallery,
  // so unlinking it from one wedding must never cascade into deleting the
  // underlying `media` row. This module never calls
  // supabase.from('media').delete(...) anywhere — proven here rather than
  // merely by inspection.
  it('does not delete the underlying media row', async () => {
    mockFrom.mockReturnValue(makeDeleteChain());

    await removeWeddingPhoto('wedding-1', 'media-5');

    expect(mockFrom).not.toHaveBeenCalledWith('media');
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('throws with a useful message when Postgres errors', async () => {
    mockFrom.mockReturnValue(makeDeleteChain({ error: { message: 'permission denied' } }));

    await expect(removeWeddingPhoto('wedding-1', 'media-5')).rejects.toThrow(/permission denied/);
  });
});

describe('reorderWeddingPhotos', () => {
  it('writes sort_order as each media id\'s index, scoped to the given wedding', async () => {
    const chains = [];
    mockFrom.mockImplementation(() => {
      const chain = makeReorderStepChain();
      chains.push(chain);
      return chain;
    });

    await reorderWeddingPhotos('wedding-1', ['media-3', 'media-1', 'media-2']);

    expect(mockFrom).toHaveBeenCalledTimes(3);
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'wedding_photos');
    expect(chains[0].update).toHaveBeenCalledWith({ sort_order: 0 });
    expect(chains[0].eq).toHaveBeenCalledWith('wedding_id', 'wedding-1');
    expect(chains[0].eq).toHaveBeenCalledWith('media_id', 'media-3');
    expect(chains[1].update).toHaveBeenCalledWith({ sort_order: 1 });
    expect(chains[1].eq).toHaveBeenCalledWith('media_id', 'media-1');
    expect(chains[2].update).toHaveBeenCalledWith({ sort_order: 2 });
    expect(chains[2].eq).toHaveBeenCalledWith('media_id', 'media-2');
  });

  it('throws when any one of the writes fails', async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call += 1;
      return makeReorderStepChain(call === 2 ? { error: { message: 'permission denied' } } : {});
    });

    await expect(reorderWeddingPhotos('wedding-1', ['media-1', 'media-2', 'media-3'])).rejects.toThrow(/permission denied/);
  });
});
