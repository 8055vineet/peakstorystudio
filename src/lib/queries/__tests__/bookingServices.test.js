import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

beforeEach(() => { vi.resetModules(); mockFrom.mockReset(); });

function chain(rows, error = null) {
  const c = {};
  c.select = vi.fn(() => c);
  c.order = vi.fn(() => Promise.resolve({ data: rows, error }));
  return c;
}

describe('getBookingServices', () => {
  it('returns the ordered service names', async () => {
    const c = chain([{ name: 'Cinematic Film' }, { name: 'Drone Aerials' }]);
    mockFrom.mockReturnValue(c);
    const { getBookingServices } = await import('../bookingServices.js');
    const result = await getBookingServices();
    expect(mockFrom).toHaveBeenCalledWith('booking_services');
    expect(c.select).toHaveBeenCalledWith('name');
    expect(c.order).toHaveBeenCalledWith('sort_order');
    expect(result).toEqual(['Cinematic Film', 'Drone Aerials']);
  });

  it('throws a prefixed error on failure', async () => {
    mockFrom.mockReturnValue(chain(null, { message: 'denied' }));
    const { getBookingServices } = await import('../bookingServices.js');
    await expect(getBookingServices()).rejects.toThrow('getBookingServices: denied');
  });
});
