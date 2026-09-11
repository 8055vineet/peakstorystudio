import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getGalleryPhotos = vi.fn();
vi.mock('../../lib/queries/gallery', () => ({ getGalleryPhotos: (...a) => getGalleryPhotos(...a) }));
vi.mock('../../lib/queries/weddings', () => ({ getPublishedWeddings: vi.fn(), getWeddingBySlug: vi.fn() }));
vi.mock('../../lib/queries/films', () => ({ getFilms: vi.fn() }));
const getTestimonials = vi.fn();
vi.mock('../../lib/queries/testimonials', () => ({ getTestimonials: (...a) => getTestimonials(...a) }));
const getSiteSettings = vi.fn();
vi.mock('../../lib/queries/siteSettings', () => ({ getSiteSettings: (...a) => getSiteSettings(...a) }));
// The build-time snapshot the prerendered head carries (src/lib/siteSettingsSnapshot.js).
let snapshot = null;
vi.mock('../../lib/siteSettingsSnapshot', () => ({ readSiteSettingsSnapshot: () => snapshot }));

const { INITIAL_PHOTOS, TESTIMONIALS } = await import('../../data/weddingData');
const { SITE_SETTINGS_FALLBACK } = await import('../../data/siteSettingsFallback');

beforeEach(() => { getGalleryPhotos.mockReset(); getTestimonials.mockReset(); getSiteSettings.mockReset(); });

// useContent is imported per test so the module-level snapshot read sees the
// value each test sets up — the way a real page sees its own <head> once.
async function importContent() {
  vi.resetModules();
  return import('../useContent');
}
const { useGalleryPhotos, useTestimonials } = await importContent();

describe('useGalleryPhotos', () => {
  it('starts loading with an empty list — never the outage fallback — then resolves with real data', async () => {
    // The static module is an OUTAGE fallback, not a placeholder: painting it
    // during the normal round trip flashed stock photographs (and, on About
    // and Stories, the fabricated testimonial PS-002 tracks) on every visit.
    getGalleryPhotos.mockResolvedValue([{ id: 'p1', title: 'One' }]);
    const { result } = renderHook(() => useGalleryPhotos());

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 'p1', title: 'One' }]);
    expect(result.current.error).toBeNull();
  });

  it('exposes the error and falls back to the static content when the query rejects', async () => {
    getGalleryPhotos.mockRejectedValue(new Error('permission denied'));
    const { result } = renderHook(() => useGalleryPhotos());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/permission denied/);
    expect(result.current.data).toEqual(INITIAL_PHOTOS);
  });

  it('always queries the database — there is no static-only mode to opt out into', async () => {
    getGalleryPhotos.mockResolvedValue([{ id: 'p1', title: 'One' }]);
    renderHook(() => useGalleryPhotos());
    await waitFor(() => expect(getGalleryPhotos).toHaveBeenCalledTimes(1));
  });
});

describe('useTestimonials', () => {
  it('renders nothing while the query is in flight, rather than the outage fallback', async () => {
    getTestimonials.mockResolvedValue([{ id: 't1', quote: 'Real words', couple: 'A Real Couple' }]);
    const { result } = renderHook(() => useTestimonials());
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 't1', quote: 'Real words', couple: 'A Real Couple' }]);
  });

  it('still falls back to the static content when the query rejects', async () => {
    getTestimonials.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useTestimonials());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(TESTIMONIALS);
  });
});

describe('useSiteSettings', () => {
  const live = { ...SITE_SETTINGS_FALLBACK, quote: { text: 'Live words', credit: 'by the database' }, logo: '/live/logo.webp' };

  it('starts from the prerendered snapshot while the query is in flight, so Home paints the real hero and logo at once', async () => {
    snapshot = { ...SITE_SETTINGS_FALLBACK, quote: { text: 'Snapshot words', credit: 'by the build' }, logo: '/built/logo.webp' };
    getSiteSettings.mockResolvedValue(live);
    const { useSiteSettings } = await importContent();
    const { result } = renderHook(() => useSiteSettings());

    expect(result.current.loading).toBe(true);
    expect(result.current.data.quote.text).toBe('Snapshot words');
    expect(result.current.data.logo).toBe('/built/logo.webp');
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(live);
  });

  it('starts from the shipped fallback when the page carries no snapshot (dev server, degraded build)', async () => {
    snapshot = null;
    getSiteSettings.mockResolvedValue(live);
    const { useSiteSettings } = await importContent();
    const { result } = renderHook(() => useSiteSettings());
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual(SITE_SETTINGS_FALLBACK);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(live);
  });

  it('keeps the fallback, not the snapshot, when the query rejects — the outage path is unchanged', async () => {
    snapshot = { ...SITE_SETTINGS_FALLBACK, logo: '/built/logo.webp' };
    getSiteSettings.mockRejectedValue(new Error('offline'));
    const { useSiteSettings } = await importContent();
    const { result } = renderHook(() => useSiteSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(SITE_SETTINGS_FALLBACK);
    expect(result.current.error).toMatch(/offline/);
  });
});
