import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

beforeEach(() => {
  vi.resetModules();
  mockFrom.mockReset();
});

// Answers each count by (table, status-value) so the shape assertion below
// proves every pair was asked for with the right filter.
function countStub(answers) {
  return (table) => ({
    select: (cols, opts) => {
      expect(cols).toBe('id');
      expect(opts).toEqual({ count: 'exact', head: true });
      return {
        eq: (column, value) => {
          expect(column).toBe('status');
          const key = `${table}:${value}`;
          if (!(key in answers)) throw new Error(`unexpected count ${key}`);
          return Promise.resolve({ count: answers[key], error: null });
        },
      };
    },
  });
}

describe('getOverviewCounts', () => {
  it('collects new-lead and published/draft counts per content table', async () => {
    mockFrom.mockImplementation(countStub({
      'inquiries:new': 3,
      'weddings:published': 1, 'weddings:draft': 0,
      'gallery_photos:published': 64, 'gallery_photos:draft': 2,
      'films:published': 3, 'films:draft': 1,
      'testimonials:published': 3, 'testimonials:draft': 0,
    }));
    const { getOverviewCounts } = await import('../adminOverview');
    const counts = await getOverviewCounts();
    expect(counts).toEqual({
      newLeads: 3,
      weddings: { published: 1, draft: 0 },
      gallery: { published: 64, draft: 2 },
      films: { published: 3, draft: 1 },
      testimonials: { published: 3, draft: 0 },
    });
  });

  it('throws a table-prefixed error when a count fails', async () => {
    mockFrom.mockImplementation((table) => ({
      select: () => ({
        eq: () => Promise.resolve({ count: null, error: table === 'films' ? { message: 'boom' } : null }),
      }),
    }));
    const { getOverviewCounts } = await import('../adminOverview');
    await expect(getOverviewCounts()).rejects.toThrow('films: count failed: boom');
  });
});
