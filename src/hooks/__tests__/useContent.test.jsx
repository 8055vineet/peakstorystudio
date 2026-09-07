import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getGalleryPhotos = vi.fn();
vi.mock('../../lib/queries/gallery', () => ({ getGalleryPhotos: (...a) => getGalleryPhotos(...a) }));
vi.mock('../../lib/queries/weddings', () => ({ getPublishedWeddings: vi.fn(), getWeddingBySlug: vi.fn() }));
vi.mock('../../lib/queries/films', () => ({ getFilms: vi.fn() }));
const getTestimonials = vi.fn();
vi.mock('../../lib/queries/testimonials', () => ({ getTestimonials: (...a) => getTestimonials(...a) }));

const { useGalleryPhotos, useTestimonials } = await import('../useContent');
const { INITIAL_PHOTOS, TESTIMONIALS } = await import('../../data/weddingData');

beforeEach(() => { getGalleryPhotos.mockReset(); getTestimonials.mockReset(); });

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
