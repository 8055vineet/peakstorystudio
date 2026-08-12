import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { rpc: (...args) => rpc(...args) },
}));

const { getClientGalleries } = await import('../clientGalleries.js');

beforeEach(() => rpc.mockReset());

describe('getClientGalleries', () => {
  it('calls the security-definer RPC with the trimmed code and maps to camelCase', async () => {
    rpc.mockResolvedValue({
      data: [{
        id: 'g-1', title: "Pragya's Wedding", couple_label: 'Pragya & Family', description: 'All photographs', drive_url: 'https://drive.google.com/x',
      }],
      error: null,
    });

    const rows = await getClientGalleries('  PSS-4K7Q2M  ');

    expect(rpc).toHaveBeenCalledWith('client_galleries_for_code', { p_code: 'PSS-4K7Q2M' });
    expect(rows).toEqual([{
      id: 'g-1', title: "Pragya's Wedding", coupleLabel: 'Pragya & Family', description: 'All photographs', driveUrl: 'https://drive.google.com/x',
    }]);
  });

  it('resolves an empty list for an unmatched code — the RPC returns no rows, never an error', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(getClientGalleries('NOPE-123')).resolves.toEqual([]);
  });

  it('throws a prefixed error on an RPC failure', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(getClientGalleries('PSS-4K7Q2M')).rejects.toThrow('getClientGalleries: boom');
  });
});
