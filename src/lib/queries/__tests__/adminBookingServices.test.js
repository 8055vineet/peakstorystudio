import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

beforeEach(() => { vi.resetModules(); mockFrom.mockReset(); });

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

function updateChain(error = null) {
  const c = {};
  c.update = vi.fn(() => c);
  c.eq = vi.fn(() => Promise.resolve({ error }));
  return c;
}

function deleteChain(error = null) {
  const c = {};
  c.delete = vi.fn(() => c);
  c.eq = vi.fn(() => Promise.resolve({ error }));
  return c;
}

describe('listBookingServices', () => {
  it('lists id/name/sortOrder in sort order', async () => {
    mockFrom.mockReturnValue(listChain([{ id: 's-1', name: 'Cinematic Film', sort_order: 0 }]));
    const { listBookingServices } = await import('../adminBookingServices.js');
    const result = await listBookingServices();
    expect(mockFrom).toHaveBeenCalledWith('booking_services');
    expect(result).toEqual([{ id: 's-1', name: 'Cinematic Film', sortOrder: 0 }]);
  });

  it('throws prefixed on failure', async () => {
    mockFrom.mockReturnValue(listChain(null, { message: 'denied' }));
    const { listBookingServices } = await import('../adminBookingServices.js');
    await expect(listBookingServices()).rejects.toThrow(/booking_services: list failed: denied/);
  });
});

describe('addBookingService', () => {
  it('appends after the current max sort_order', async () => {
    mockFrom.mockReturnValueOnce(maxChain([{ sort_order: 3 }]));
    const ins = insertChain();
    mockFrom.mockReturnValueOnce(ins);
    const { addBookingService } = await import('../adminBookingServices.js');
    await addBookingService('Album Design');
    expect(ins.insert).toHaveBeenCalledWith({ name: 'Album Design', sort_order: 4 });
  });
});

describe('renameBookingService', () => {
  it('updates the name by id — historical inquiries stay untouched', async () => {
    const upd = updateChain();
    mockFrom.mockReturnValue(upd);
    const { renameBookingService } = await import('../adminBookingServices.js');
    await renameBookingService('s-1', 'Cinema Film');
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('booking_services');
    expect(upd.update).toHaveBeenCalledWith({ name: 'Cinema Film' });
    expect(upd.eq).toHaveBeenCalledWith('id', 's-1');
  });
});

describe('reorderBookingServices', () => {
  it('writes each id\'s index as its sort_order', async () => {
    const chains = [];
    mockFrom.mockImplementation(() => {
      const c = updateChain();
      chains.push(c);
      return c;
    });
    const { reorderBookingServices } = await import('../adminBookingServices.js');
    await reorderBookingServices(['b', 'a']);
    expect(chains[0].update).toHaveBeenCalledWith({ sort_order: 0 });
    expect(chains[0].eq).toHaveBeenCalledWith('id', 'b');
  });
});

describe('removeBookingService', () => {
  it('deletes by id with no usage guard', async () => {
    const del = deleteChain();
    mockFrom.mockReturnValue(del);
    const { removeBookingService } = await import('../adminBookingServices.js');
    await removeBookingService('s-1');
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(del.eq).toHaveBeenCalledWith('id', 's-1');
  });
});
