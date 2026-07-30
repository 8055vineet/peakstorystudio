import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

const { getGalleryPhotos } = await import('../gallery');
const { getFilms } = await import('../films');
const { getTestimonials } = await import('../testimonials');

function selectResult(rows, error = null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => Promise.resolve({ data: rows, error }),
  };
  return chain;
}

beforeEach(() => { mockFrom.mockReset(); });

describe('getGalleryPhotos', () => {
  it('maps database columns to the shape components already use', async () => {
    mockFrom.mockReturnValue(selectResult([
      {
        id: 'p1', title: 'Courtyard Walk', category: 'Royal', couple: 'A & B',
        location: 'Jodhpur', grid_span: 'col-span-1', media: { storage_path: '/images/a.jpg' },
      },
    ]));
    const photos = await getGalleryPhotos();
    expect(photos).toEqual([{
      id: 'p1', title: 'Courtyard Walk', url: '/images/a.jpg', category: 'Royal',
      couple: 'A & B', location: 'Jodhpur', span: 'col-span-1',
    }]);
  });

  it('throws with a useful message when the query errors', async () => {
    mockFrom.mockReturnValue(selectResult(null, { message: 'permission denied' }));
    await expect(getGalleryPhotos()).rejects.toThrow(/permission denied/);
  });
});

describe('getFilms', () => {
  it('formats duration_seconds back into the display string components render', async () => {
    mockFrom.mockReturnValue(selectResult([
      {
        id: 'f1', title: 'The Palace Symphony', couple: 'A & B', location: 'Jodhpur',
        duration_seconds: 272, video_embed_url: 'https://example.com/embed',
        thumbnail: { storage_path: '/images/t.jpg' },
      },
    ]));
    const films = await getFilms();
    expect(films[0].duration).toBe('4:32 mins');
    expect(films[0].thumbnail).toBe('/images/t.jpg');
  });

  it('leaves duration empty when the database has no value', async () => {
    mockFrom.mockReturnValue(selectResult([
      { id: 'f2', title: 'x', duration_seconds: null, video_embed_url: 'u', thumbnail: null },
    ]));
    const films = await getFilms();
    expect(films[0].duration).toBe('');
  });
});

describe('getTestimonials', () => {
  it('returns the quote, couple and event', async () => {
    mockFrom.mockReturnValue(selectResult([
      { id: 't1', quote: 'A fictional quote.', couple: 'Test Couple', event: 'Test Event' },
    ]));
    expect(await getTestimonials()).toEqual([
      { id: 't1', quote: 'A fictional quote.', couple: 'Test Couple', event: 'Test Event' },
    ]);
  });
});
