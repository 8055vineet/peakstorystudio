import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

const { makeResourceQueries } = await import('../adminContent.js');

// A fixture table, not one of the five real content tables — this is what
// proves makeResourceQueries is generic rather than accidentally shaped
// around testimonials/weddings/etc. Task 8 and 9 point the exact same
// function at their own (table, columns) pairs.
const TABLE = 'widgets';
const COLUMNS = ['id', 'name', 'sort_order', 'status'];

const ROW = {
  id: 'widget-1', name: 'Gadget', sort_order: 0, status: 'draft',
};

// Chain spies mirror src/lib/queries/__tests__/adminInquiries.test.js and
// media.test.js: every link individually spy-able so tests can assert
// exactly which calls were made.
function makeSelectChain({ rows = [], error = null } = {}) {
  const chain = {};
  chain.select = vi.fn(() => chain);
  chain.order = vi.fn(() => Promise.resolve({ data: rows, error }));
  return chain;
}

function makeInsertChain({ row = null, error = null } = {}) {
  const chain = {};
  chain.insert = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: row, error }));
  return chain;
}

function makeUpdateChain({ row = null, error = null } = {}) {
  const chain = {};
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: row, error }));
  return chain;
}

function makeDeleteChain({ error = null } = {}) {
  const chain = {};
  chain.delete = vi.fn(() => chain);
  chain.eq = vi.fn(() => Promise.resolve({ error }));
  return chain;
}

// Distinct from makeUpdateChain: reorder's writes never .select().single() —
// they only need to confirm each write succeeded, not read the row back.
function makeReorderStepChain({ error = null } = {}) {
  const chain = {};
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => Promise.resolve({ error }));
  return chain;
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('makeResourceQueries', () => {
  it('returns exactly list, create, update, remove, and reorder as functions', () => {
    const queries = makeResourceQueries(TABLE, COLUMNS);

    expect(Object.keys(queries).sort()).toEqual(['create', 'list', 'remove', 'reorder', 'update']);
    Object.values(queries).forEach((fn) => expect(typeof fn).toBe('function'));
  });

  describe('list', () => {
    it('selects exactly the given columns and orders by sort_order ascending', async () => {
      const chain = makeSelectChain({ rows: [ROW] });
      mockFrom.mockReturnValue(chain);
      const { list } = makeResourceQueries(TABLE, COLUMNS);

      await list();

      expect(mockFrom).toHaveBeenCalledWith('widgets');
      expect(chain.select).toHaveBeenCalledWith('id, name, sort_order, status');
      expect(chain.order).toHaveBeenCalledWith('sort_order', { ascending: true });
    });

    it('maps snake_case rows to the camelCase shape components read', async () => {
      mockFrom.mockReturnValue(makeSelectChain({ rows: [ROW] }));
      const { list } = makeResourceQueries(TABLE, COLUMNS);

      const result = await list();

      expect(result).toEqual([{
        id: 'widget-1', name: 'Gadget', sortOrder: 0, status: 'draft',
      }]);
    });

    it('throws rather than resolving to an empty array when Postgres errors', async () => {
      mockFrom.mockReturnValue(makeSelectChain({ rows: null, error: { message: 'permission denied' } }));
      const { list } = makeResourceQueries(TABLE, COLUMNS);

      await expect(list()).rejects.toThrow(/permission denied/);
    });
  });

  describe('create', () => {
    it('inserts the mapped snake_case row, forced to draft, and returns the mapped result', async () => {
      const chain = makeInsertChain({ row: ROW });
      mockFrom.mockReturnValue(chain);
      const { create } = makeResourceQueries(TABLE, COLUMNS);

      const result = await create({ name: 'Gadget', sortOrder: 0 });

      expect(mockFrom).toHaveBeenCalledWith('widgets');
      expect(chain.insert).toHaveBeenCalledWith({ name: 'Gadget', sort_order: 0, status: 'draft' });
      expect(result).toEqual({
        id: 'widget-1', name: 'Gadget', sortOrder: 0, status: 'draft',
      });
    });

    // A resource form never submits `status` at all (ResourceForm.jsx keeps
    // it out of `fields` deliberately), but this proves the guarantee holds
    // even if some future caller did: three of the four real content tables
    // default `status` to 'published', not 'draft', so a half-finished
    // gallery photo, film, or testimonial must never go live just because
    // "Create" was clicked.
    it('always creates as draft, regardless of what status the caller passes', async () => {
      const chain = makeInsertChain({ row: ROW });
      mockFrom.mockReturnValue(chain);
      const { create } = makeResourceQueries(TABLE, COLUMNS);

      await create({ name: 'Gadget', status: 'published' });

      expect(chain.insert).toHaveBeenCalledWith({ name: 'Gadget', status: 'draft' });
    });

    it('never writes the id column, even if one is present in the given values', async () => {
      const chain = makeInsertChain({ row: ROW });
      mockFrom.mockReturnValue(chain);
      const { create } = makeResourceQueries(TABLE, COLUMNS);

      await create({ id: 'someone-elses-id', name: 'Gadget' });

      expect(chain.insert).toHaveBeenCalledWith({ name: 'Gadget', status: 'draft' });
    });

    it('ignores keys that are not in the configured columns', async () => {
      const chain = makeInsertChain({ row: ROW });
      mockFrom.mockReturnValue(chain);
      const { create } = makeResourceQueries(TABLE, COLUMNS);

      await create({ name: 'Gadget', notAColumn: 'ignored' });

      expect(chain.insert).toHaveBeenCalledWith({ name: 'Gadget', status: 'draft' });
    });

    it('throws with a useful message when Postgres errors', async () => {
      mockFrom.mockReturnValue(makeInsertChain({ row: null, error: { message: 'not null violation' } }));
      const { create } = makeResourceQueries(TABLE, COLUMNS);

      await expect(create({ name: 'Gadget' })).rejects.toThrow(/not null violation/);
    });
  });

  describe('update', () => {
    it('updates by id with the mapped snake_case row and returns the mapped result', async () => {
      const chain = makeUpdateChain({ row: { ...ROW, status: 'published' } });
      mockFrom.mockReturnValue(chain);
      const { update } = makeResourceQueries(TABLE, COLUMNS);

      const result = await update('widget-1', { status: 'published' });

      expect(mockFrom).toHaveBeenCalledWith('widgets');
      expect(chain.update).toHaveBeenCalledWith({ status: 'published' });
      expect(chain.eq).toHaveBeenCalledWith('id', 'widget-1');
      expect(result.status).toBe('published');
    });

    it('never writes the id column, even if one is present in the given values', async () => {
      const chain = makeUpdateChain({ row: ROW });
      mockFrom.mockReturnValue(chain);
      const { update } = makeResourceQueries(TABLE, COLUMNS);

      await update('widget-1', { id: 'someone-elses-id', name: 'Renamed' });

      expect(chain.update).toHaveBeenCalledWith({ name: 'Renamed' });
    });

    it('throws with a useful message when Postgres errors', async () => {
      mockFrom.mockReturnValue(makeUpdateChain({ row: null, error: { message: 'row not found' } }));
      const { update } = makeResourceQueries(TABLE, COLUMNS);

      await expect(update('widget-1', { name: 'x' })).rejects.toThrow(/row not found/);
    });
  });

  describe('remove', () => {
    it('deletes by id', async () => {
      const chain = makeDeleteChain();
      mockFrom.mockReturnValue(chain);
      const { remove } = makeResourceQueries(TABLE, COLUMNS);

      await remove('widget-1');

      expect(mockFrom).toHaveBeenCalledWith('widgets');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'widget-1');
    });

    it('throws with a useful message when Postgres errors', async () => {
      mockFrom.mockReturnValue(makeDeleteChain({ error: { message: 'foreign key violation' } }));
      const { remove } = makeResourceQueries(TABLE, COLUMNS);

      await expect(remove('widget-1')).rejects.toThrow(/foreign key violation/);
    });
  });

  describe('reorder', () => {
    it('writes sort_order as each id\'s index in the given order', async () => {
      const chains = [];
      mockFrom.mockImplementation(() => {
        const chain = makeReorderStepChain();
        chains.push(chain);
        return chain;
      });
      const { reorder } = makeResourceQueries(TABLE, COLUMNS);

      await reorder(['widget-3', 'widget-1', 'widget-2']);

      expect(mockFrom).toHaveBeenCalledTimes(3);
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'widgets');
      expect(chains[0].update).toHaveBeenCalledWith({ sort_order: 0 });
      expect(chains[0].eq).toHaveBeenCalledWith('id', 'widget-3');
      expect(chains[1].update).toHaveBeenCalledWith({ sort_order: 1 });
      expect(chains[1].eq).toHaveBeenCalledWith('id', 'widget-1');
      expect(chains[2].update).toHaveBeenCalledWith({ sort_order: 2 });
      expect(chains[2].eq).toHaveBeenCalledWith('id', 'widget-2');
    });

    it('throws when any one of the writes fails', async () => {
      let call = 0;
      mockFrom.mockImplementation(() => {
        call += 1;
        return makeReorderStepChain(call === 2 ? { error: { message: 'permission denied' } } : {});
      });
      const { reorder } = makeResourceQueries(TABLE, COLUMNS);

      await expect(reorder(['widget-1', 'widget-2', 'widget-3'])).rejects.toThrow(/permission denied/);
    });
  });

  describe('thumbnailColumn option', () => {
    const THUMB_COLUMNS = ['id', 'name', 'media_id', 'sort_order', 'status'];
    const THUMB_ROW = {
      id: 'widget-1', name: 'Gadget', media_id: 'm-1', sort_order: 0, status: 'draft', thumbnail: { storage_path: 'uploads/one.webp' },
    };

    it('appends the media embed to the select and maps thumbnailPath', async () => {
      const chain = makeSelectChain({ rows: [THUMB_ROW] });
      mockFrom.mockReturnValue(chain);
      const { list } = makeResourceQueries(TABLE, THUMB_COLUMNS, { thumbnailColumn: 'media_id' });

      const result = await list();

      expect(chain.select).toHaveBeenCalledWith('id, name, media_id, sort_order, status, thumbnail:media_id(storage_path)');
      expect(result[0].thumbnailPath).toBe('uploads/one.webp');
    });

    it('maps a missing embed to thumbnailPath null', async () => {
      mockFrom.mockReturnValue(makeSelectChain({ rows: [{ ...THUMB_ROW, thumbnail: null }] }));
      const { list } = makeResourceQueries(TABLE, THUMB_COLUMNS, { thumbnailColumn: 'media_id' });

      const result = await list();

      expect(result[0].thumbnailPath).toBeNull();
    });

    it('never writes thumbnailPath back on create', async () => {
      const chain = makeInsertChain({ row: THUMB_ROW });
      mockFrom.mockReturnValue(chain);
      const { create } = makeResourceQueries(TABLE, THUMB_COLUMNS, { thumbnailColumn: 'media_id' });

      await create({ name: 'Gadget', thumbnailPath: 'uploads/evil.webp' });

      expect(chain.insert).toHaveBeenCalledWith({ name: 'Gadget', status: 'draft' });
    });

    it('without the option, selects stay exactly as before', async () => {
      const chain = makeSelectChain({ rows: [ROW] });
      mockFrom.mockReturnValue(chain);
      const { list } = makeResourceQueries(TABLE, COLUMNS);

      await list();

      expect(chain.select).toHaveBeenCalledWith('id, name, sort_order, status');
    });
  });
});
