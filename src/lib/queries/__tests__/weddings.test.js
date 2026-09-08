import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 5 (SEO) adds two read-only fields to the wedding shape — the row's
// updated_at (the sitemap's lastmod, and what the admin compares against
// build-info.json to say whether a page is live) and the cover photograph's
// dimensions and alt text (og:image:width/height/alt). Both are additive:
// every existing consumer keeps reading the fields it already did, which
// queries.test.js's full-shape assertion continues to pin.
const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

function selectResult(rows, error = null) {
  const chain = {
    select: vi.fn(() => chain),
    eq: () => chain,
    order: () => Promise.resolve({ data: rows, error }),
  };
  return chain;
}

// Same import.meta.env hazard queries.test.js documents: mediaUrl.js reads
// VITE_MEDIA_BASE_URL at module load, so stub it and import fresh each time.
beforeEach(() => {
  vi.resetModules();
  mockFrom.mockReset();
});

async function importWeddings(baseUrl = 'https://cdn.peakstorystudio.test') {
  vi.stubEnv('VITE_MEDIA_BASE_URL', baseUrl);
  return import('../weddings');
}

const ROW = {
  id: 'w1', slug: 'jodhpur-royal', title: 'A Royal Affair', couple: 'A & B',
  location: 'Jodhpur', event_date: '2024-11-01', summary: 'A fictional summary.',
  video_url: null, tags: [],
  updated_at: '2026-09-01T10:20:30.123456+00:00',
  cover: {
    storage_path: 'uploads/cover.webp', width: 2400, height: 1600, alt_text: 'The couple at dusk',
  },
  wedding_photos: [],
};

describe('getPublishedWeddings — Phase 5 additive fields', () => {
  it('selects updated_at and the cover row\'s width, height and alt_text', async () => {
    const chain = selectResult([ROW]);
    mockFrom.mockReturnValue(chain);
    const { getPublishedWeddings } = await importWeddings();
    await getPublishedWeddings();
    const select = chain.select.mock.calls[0][0].replace(/\s+/g, ' ');
    expect(select).toContain('updated_at');
    expect(select).toContain('cover:cover_media_id (storage_path, width, height, alt_text)');
  });

  it('maps updated_at to an ISO updatedAt string and the cover row to coverMeta', async () => {
    mockFrom.mockReturnValue(selectResult([ROW]));
    const { getPublishedWeddings } = await importWeddings();
    const [wedding] = await getPublishedWeddings();
    expect(wedding.updatedAt).toBe('2026-09-01T10:20:30.123Z');
    expect(wedding.coverMeta).toEqual({ width: 2400, height: 1600, alt: 'The couple at dusk' });
    // The fields every existing consumer reads are untouched.
    expect(wedding.coverImage).toBe('https://cdn.peakstorystudio.test/uploads/cover.webp');
    expect(wedding.date).toBe('November 2024');
  });

  it('gives nulls, never undefined or a broken Date, when the row carries no updated_at or cover', async () => {
    mockFrom.mockReturnValue(selectResult([{ ...ROW, updated_at: null, cover: null }]));
    const { getPublishedWeddings } = await importWeddings();
    const [wedding] = await getPublishedWeddings();
    expect(wedding.updatedAt).toBeNull();
    expect(wedding.coverMeta).toEqual({ width: null, height: null, alt: null });
  });

  it('keeps coverMeta partial when the media row has a path but no dimensions yet', async () => {
    mockFrom.mockReturnValue(selectResult([{
      ...ROW, cover: { storage_path: '/images/stories/wedding/1.webp', width: null, height: null, alt_text: 'Cover' },
    }]));
    const { getPublishedWeddings } = await importWeddings('');
    const [wedding] = await getPublishedWeddings();
    expect(wedding.coverImage).toBe('/images/stories/wedding/1.webp');
    expect(wedding.coverMeta).toEqual({ width: null, height: null, alt: 'Cover' });
  });

  it('getWeddingBySlug maps the same fields', async () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: () => Promise.resolve({ data: ROW, error: null }),
    };
    mockFrom.mockReturnValue(chain);
    const { getWeddingBySlug } = await importWeddings();
    const wedding = await getWeddingBySlug('jodhpur-royal');
    expect(wedding.updatedAt).toBe('2026-09-01T10:20:30.123Z');
    expect(wedding.coverMeta.width).toBe(2400);
  });
});
