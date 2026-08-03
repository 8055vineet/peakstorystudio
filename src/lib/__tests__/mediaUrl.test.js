import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';

// Same pattern as src/components/__tests__/WhatsAppButton.test.jsx: the
// module reads import.meta.env at load time, so each test needs a fresh
// module registry plus vi.stubEnv before the dynamic import, not after.
describe('mediaUrl', () => {
  beforeEach(() => vi.resetModules());

  it('reports unconfigured and returns null for every path when VITE_MEDIA_BASE_URL is unset', async () => {
    vi.stubEnv('VITE_MEDIA_BASE_URL', '');
    const { mediaUrl, mediaBaseUrlConfigured } = await import('../mediaUrl.js');

    expect(mediaBaseUrlConfigured).toBe(false);
    expect(mediaUrl('uploads/abc.webp')).toBeNull();
  });

  it('joins the base URL and storage path when configured', async () => {
    vi.stubEnv('VITE_MEDIA_BASE_URL', 'https://cdn.peakstorystudio.test');
    const { mediaUrl, mediaBaseUrlConfigured } = await import('../mediaUrl.js');

    expect(mediaBaseUrlConfigured).toBe(true);
    expect(mediaUrl('uploads/abc.webp')).toBe('https://cdn.peakstorystudio.test/uploads/abc.webp');
  });

  it('tolerates a trailing slash on the base URL and a leading slash on the storage path', async () => {
    vi.stubEnv('VITE_MEDIA_BASE_URL', 'https://cdn.peakstorystudio.test/');
    const { mediaUrl } = await import('../mediaUrl.js');

    expect(mediaUrl('/uploads/abc.webp')).toBe('https://cdn.peakstorystudio.test/uploads/abc.webp');
  });

  it('returns null for a missing storage path even when configured', async () => {
    vi.stubEnv('VITE_MEDIA_BASE_URL', 'https://cdn.peakstorystudio.test');
    const { mediaUrl } = await import('../mediaUrl.js');

    expect(mediaUrl('')).toBeNull();
    expect(mediaUrl(null)).toBeNull();
    expect(mediaUrl(undefined)).toBeNull();
  });
});
