import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

const { listInquiries, updateInquiryStatus, INQUIRY_STATUSES } = await import('../adminInquiries.js');

// Chain spy mirroring src/lib/queries/__tests__/queries.test.js's selectResult, but
// with every link individually spy-able so tests can assert exactly which filters
// were (or were not) applied — the whole point of "eq only when status is given".
function makeSelectChain({ rows = [], error = null } = {}) {
  const chain = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => Promise.resolve({ data: rows, error }));
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

const ROW = {
  id: 'inq-1',
  name: 'Ananya & Rohan',
  email: 'couple@example.test',
  phone: '+91 98200 00000',
  wedding_date: '2027-02-14',
  venue: 'Umaid Bhawan Palace',
  services: ['Cinematic Film'],
  message: 'We would love to hear more.',
  status: 'new',
  notification_status: 'sent',
  created_at: '2026-08-01T10:00:00Z',
};

beforeEach(() => {
  mockFrom.mockReset();
});

describe('listInquiries', () => {
  it('selects the documented columns from public.inquiries', async () => {
    const chain = makeSelectChain({ rows: [ROW] });
    mockFrom.mockReturnValue(chain);

    await listInquiries();

    expect(mockFrom).toHaveBeenCalledWith('inquiries');
    expect(chain.select).toHaveBeenCalledWith(
      'id, name, email, phone, wedding_date, venue, services, message, status, notification_status, created_at',
    );
  });

  it('orders newest first', async () => {
    const chain = makeSelectChain({ rows: [ROW] });
    mockFrom.mockReturnValue(chain);

    await listInquiries();

    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('applies a status filter only when one is given', async () => {
    const unfiltered = makeSelectChain({ rows: [ROW] });
    mockFrom.mockReturnValue(unfiltered);
    await listInquiries();
    expect(unfiltered.eq).not.toHaveBeenCalled();

    const filtered = makeSelectChain({ rows: [ROW] });
    mockFrom.mockReturnValue(filtered);
    await listInquiries({ status: 'contacted' });
    expect(filtered.eq).toHaveBeenCalledWith('status', 'contacted');
  });

  it('maps rows to the camelCase shape components read', async () => {
    mockFrom.mockReturnValue(makeSelectChain({ rows: [ROW] }));

    const result = await listInquiries();

    expect(result).toEqual([{
      id: 'inq-1',
      name: 'Ananya & Rohan',
      email: 'couple@example.test',
      phone: '+91 98200 00000',
      weddingDate: '2027-02-14',
      venue: 'Umaid Bhawan Palace',
      services: ['Cinematic Film'],
      message: 'We would love to hear more.',
      status: 'new',
      notificationStatus: 'sent',
      createdAt: '2026-08-01T10:00:00Z',
    }]);
  });

  it('throws rather than resolving to an empty array when Postgres errors', async () => {
    mockFrom.mockReturnValue(makeSelectChain({ rows: null, error: { message: 'permission denied' } }));

    await expect(listInquiries()).rejects.toThrow(/permission denied/);
  });
});

describe('updateInquiryStatus', () => {
  it('rejects an unknown status without calling Supabase at all', async () => {
    await expect(updateInquiryStatus('inq-1', 'not-a-real-status')).rejects.toThrow();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each(INQUIRY_STATUSES)('accepts the valid status "%s" and updates by id', async (status) => {
    const chain = makeUpdateChain({ row: { ...ROW, status } });
    mockFrom.mockReturnValue(chain);

    const result = await updateInquiryStatus('inq-1', status);

    expect(mockFrom).toHaveBeenCalledWith('inquiries');
    expect(chain.update).toHaveBeenCalledWith({ status });
    expect(chain.eq).toHaveBeenCalledWith('id', 'inq-1');
    expect(result.status).toBe(status);
    expect(result.id).toBe('inq-1');
  });

  it('throws with a useful message when Postgres errors', async () => {
    mockFrom.mockReturnValue(makeUpdateChain({ row: null, error: { message: 'row not found' } }));

    await expect(updateInquiryStatus('inq-1', 'booked')).rejects.toThrow(/row not found/);
  });
});
