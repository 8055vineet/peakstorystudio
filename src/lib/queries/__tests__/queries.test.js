import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

function selectResult(rows, error = null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => Promise.resolve({ data: rows, error }),
  };
  return chain;
}

// gallery.js, films.js and weddings.js all resolve storage_path through
// src/lib/mediaUrl.js, which reads import.meta.env.VITE_MEDIA_BASE_URL at
// module load time — the same hazard src/lib/__tests__/mediaUrl.test.js and
// src/admin/__tests__/MediaPicker.test.jsx already document. So every test
// below resets the module registry and stubs the env BEFORE dynamically
// importing the query module under test, rather than relying on one
// top-of-file import that would freeze whatever env happened to be set
// first.
beforeEach(() => {
  vi.resetModules();
  mockFrom.mockReset();
});

async function importGallery(baseUrl = 'https://cdn.peakstorystudio.test') {
  vi.stubEnv('VITE_MEDIA_BASE_URL', baseUrl);
  return import('../gallery');
}

async function importFilms(baseUrl = 'https://cdn.peakstorystudio.test') {
  vi.stubEnv('VITE_MEDIA_BASE_URL', baseUrl);
  return import('../films');
}

async function importWeddings(baseUrl = 'https://cdn.peakstorystudio.test') {
  vi.stubEnv('VITE_MEDIA_BASE_URL', baseUrl);
  return import('../weddings');
}

async function importTestimonials() {
  return import('../testimonials');
}

describe('getGalleryPhotos', () => {
  it('maps database columns to the shape components already use, resolving storage_path against VITE_MEDIA_BASE_URL', async () => {
    mockFrom.mockReturnValue(selectResult([
      {
        id: 'p1', title: 'Courtyard Walk', category: 'Royal', couple: 'A & B',
        location: 'Jodhpur', grid_span: 'col-span-1', media: { storage_path: 'uploads/a.webp' },
      },
    ]));
    const { getGalleryPhotos } = await importGallery();
    const photos = await getGalleryPhotos();
    expect(photos).toEqual([{
      id: 'p1',
      title: 'Courtyard Walk',
      url: 'https://cdn.peakstorystudio.test/uploads/a.webp',
      category: 'Royal',
      couple: 'A & B',
      location: 'Jodhpur',
      span: 'col-span-1',
    }]);
  });

  it('returns an empty url, not the bare storage key, when VITE_MEDIA_BASE_URL is unset', async () => {
    mockFrom.mockReturnValue(selectResult([
      {
        id: 'p1', title: 'Courtyard Walk', category: 'Royal', couple: 'A & B',
        location: 'Jodhpur', grid_span: 'col-span-1', media: { storage_path: 'uploads/a.webp' },
      },
    ]));
    const { getGalleryPhotos } = await importGallery('');
    const photos = await getGalleryPhotos();
    expect(photos[0].url).toBe('');
  });

  it('passes a seeded row\'s already-absolute storage_path through unchanged even when VITE_MEDIA_BASE_URL is unset', async () => {
    // scripts/seed-db.mjs writes each seeded photo's original local path
    // straight into storage_path — never a bucket key. That must keep
    // rendering with no base configured, exactly as it does today; treating
    // it like an unresolvable bucket key here would be a regression, not a
    // fix.
    mockFrom.mockReturnValue(selectResult([
      {
        id: 'p1', title: 'Courtyard Walk', category: 'Royal', couple: 'A & B',
        location: 'Jodhpur', grid_span: 'col-span-1', media: { storage_path: '/images/hero_royal.jpg' },
      },
    ]));
    const { getGalleryPhotos } = await importGallery('');
    const photos = await getGalleryPhotos();
    expect(photos[0].url).toBe('/images/hero_royal.jpg');
  });

  it('throws with a useful message when the query errors', async () => {
    mockFrom.mockReturnValue(selectResult(null, { message: 'permission denied' }));
    const { getGalleryPhotos } = await importGallery();
    await expect(getGalleryPhotos()).rejects.toThrow(/permission denied/);
  });
});

describe('getFilms', () => {
  it('formats duration_seconds back into the display string components render, resolving the thumbnail URL', async () => {
    mockFrom.mockReturnValue(selectResult([
      {
        id: 'f1', title: 'The Palace Symphony', couple: 'A & B', location: 'Jodhpur',
        duration_seconds: 272, video_embed_url: 'https://example.com/embed',
        thumbnail: { storage_path: 'uploads/t.webp' },
      },
    ]));
    const { getFilms } = await importFilms();
    const films = await getFilms();
    expect(films[0].duration).toBe('4:32 mins');
    expect(films[0].thumbnail).toBe('https://cdn.peakstorystudio.test/uploads/t.webp');
  });

  it('leaves duration empty when the database has no value', async () => {
    mockFrom.mockReturnValue(selectResult([
      { id: 'f2', title: 'x', duration_seconds: null, video_embed_url: 'u', thumbnail: null },
    ]));
    const { getFilms } = await importFilms();
    const films = await getFilms();
    expect(films[0].duration).toBe('');
  });

  it('returns an empty thumbnail, not the bare storage key, when VITE_MEDIA_BASE_URL is unset', async () => {
    mockFrom.mockReturnValue(selectResult([
      {
        id: 'f1', title: 'The Palace Symphony', couple: 'A & B', location: 'Jodhpur',
        duration_seconds: 272, video_embed_url: 'https://example.com/embed',
        thumbnail: { storage_path: 'uploads/t.webp' },
      },
    ]));
    const { getFilms } = await importFilms('');
    const films = await getFilms();
    expect(films[0].thumbnail).toBe('');
  });

  it('passes a seeded row\'s already-absolute thumbnail URL through unchanged even when VITE_MEDIA_BASE_URL is unset', async () => {
    mockFrom.mockReturnValue(selectResult([
      {
        id: 'f1', title: 'The Palace Symphony', couple: 'A & B', location: 'Jodhpur',
        duration_seconds: 272, video_embed_url: 'https://example.com/embed',
        thumbnail: { storage_path: 'https://images.unsplash.com/photo-1?w=800' },
      },
    ]));
    const { getFilms } = await importFilms('');
    const films = await getFilms();
    expect(films[0].thumbnail).toBe('https://images.unsplash.com/photo-1?w=800');
  });
});

describe('getPublishedWeddings', () => {
  it('maps database columns to the shape FeaturedStories and StoryDetailModal read, resolving cover and gallery URLs', async () => {
    mockFrom.mockReturnValue(selectResult([
      {
        id: 'w1', slug: 'jodhpur-royal', title: 'A Royal Affair', couple: 'A & B',
        location: 'Jodhpur', event_date: '2024-11-01', summary: 'A fictional summary.',
        video_url: 'https://example.com/video', tags: ['royal', 'destination'],
        cover: { storage_path: 'uploads/cover.webp' },
        wedding_photos: [
          { sort_order: 3, media: { storage_path: 'uploads/c.webp' } },
          { sort_order: 1, media: { storage_path: 'uploads/a.webp' } },
          { sort_order: 2, media: { storage_path: 'uploads/b.webp' } },
        ],
      },
    ]));
    const { getPublishedWeddings } = await importWeddings();
    const weddings = await getPublishedWeddings();
    expect(weddings).toEqual([{
      id: 'w1',
      slug: 'jodhpur-royal',
      title: 'A Royal Affair',
      couple: 'A & B',
      location: 'Jodhpur',
      date: 'November 2024',
      eventDate: '2024-11-01',
      summary: 'A fictional summary.',
      coverImage: 'https://cdn.peakstorystudio.test/uploads/cover.webp',
      videoUrl: 'https://example.com/video',
      tags: ['royal', 'destination'],
      fullGallery: [
        'https://cdn.peakstorystudio.test/uploads/a.webp',
        'https://cdn.peakstorystudio.test/uploads/b.webp',
        'https://cdn.peakstorystudio.test/uploads/c.webp',
      ],
    }]);
  });

  it('returns an empty cover and an empty gallery, not bare storage keys, when VITE_MEDIA_BASE_URL is unset', async () => {
    mockFrom.mockReturnValue(selectResult([
      {
        id: 'w1', slug: 'jodhpur-royal', title: 'A Royal Affair', couple: 'A & B',
        location: 'Jodhpur', event_date: '2024-11-01', summary: 'A fictional summary.',
        video_url: 'https://example.com/video', tags: ['royal', 'destination'],
        cover: { storage_path: 'uploads/cover.webp' },
        wedding_photos: [
          { sort_order: 1, media: { storage_path: 'uploads/a.webp' } },
        ],
      },
    ]));
    const { getPublishedWeddings } = await importWeddings('');
    const weddings = await getPublishedWeddings();
    expect(weddings[0].coverImage).toBe('');
    // Every entry resolves to null (no base configured) and is filtered out,
    // same as an entry with no media row at all — an unconfigured base
    // must never surface as a gallery full of unusable bucket keys.
    expect(weddings[0].fullGallery).toEqual([]);
  });

  it('passes a seeded row\'s already-absolute cover and gallery paths through unchanged even when VITE_MEDIA_BASE_URL is unset', async () => {
    mockFrom.mockReturnValue(selectResult([
      {
        id: 'w1', slug: 'jodhpur-royal', title: 'A Royal Affair', couple: 'A & B',
        location: 'Jodhpur', event_date: '2024-11-01', summary: 'A fictional summary.',
        video_url: 'https://example.com/video', tags: ['royal', 'destination'],
        cover: { storage_path: '/images/cover.jpg' },
        wedding_photos: [
          { sort_order: 1, media: { storage_path: '/images/a.jpg' } },
        ],
      },
    ]));
    const { getPublishedWeddings } = await importWeddings('');
    const weddings = await getPublishedWeddings();
    expect(weddings[0].coverImage).toBe('/images/cover.jpg');
    expect(weddings[0].fullGallery).toEqual(['/images/a.jpg']);
  });

  it('throws with a useful message when the query errors', async () => {
    mockFrom.mockReturnValue(selectResult(null, { message: 'permission denied' }));
    const { getPublishedWeddings } = await importWeddings();
    await expect(getPublishedWeddings()).rejects.toThrow(/permission denied/);
  });
});

describe('getTestimonials', () => {
  it('returns the quote, couple and event', async () => {
    mockFrom.mockReturnValue(selectResult([
      { id: 't1', quote: 'A fictional quote.', couple: 'Test Couple', event: 'Test Event' },
    ]));
    const { getTestimonials } = await importTestimonials();
    expect(await getTestimonials()).toEqual([
      { id: 't1', quote: 'A fictional quote.', couple: 'Test Couple', event: 'Test Event' },
    ]);
  });
});
