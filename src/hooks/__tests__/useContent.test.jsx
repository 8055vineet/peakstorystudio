import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getGalleryPhotos = vi.fn();
vi.mock('../../lib/queries/gallery', () => ({ getGalleryPhotos: (...a) => getGalleryPhotos(...a) }));
vi.mock('../../lib/queries/weddings', () => ({ getPublishedWeddings: vi.fn(), getWeddingBySlug: vi.fn() }));
vi.mock('../../lib/queries/films', () => ({ getFilms: vi.fn() }));
vi.mock('../../lib/queries/testimonials', () => ({ getTestimonials: vi.fn() }));

const { useGalleryPhotos } = await import('../useContent');
const { INITIAL_PHOTOS } = await import('../../data/weddingData');

beforeEach(() => { getGalleryPhotos.mockReset(); });

describe('useGalleryPhotos', () => {
  it('starts loading with the static fallback, then resolves with real data', async () => {
    getGalleryPhotos.mockResolvedValue([{ id: 'p1', title: 'One' }]);
    const { result } = renderHook(() => useGalleryPhotos('supabase'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual(INITIAL_PHOTOS);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 'p1', title: 'One' }]);
    expect(result.current.error).toBeNull();
  });

  it('exposes the error and falls back to the static content when the query rejects', async () => {
    getGalleryPhotos.mockRejectedValue(new Error('permission denied'));
    const { result } = renderHook(() => useGalleryPhotos('supabase'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/permission denied/);
    expect(result.current.data).toEqual(INITIAL_PHOTOS);
  });

  it('uses the static file without touching the query layer', async () => {
    const { result } = renderHook(() => useGalleryPhotos('static'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getGalleryPhotos).not.toHaveBeenCalled();
    expect(result.current.data.length).toBeGreaterThan(0);
  });
});
