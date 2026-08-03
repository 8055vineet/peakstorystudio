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

// publicMediaUrl() is the public query layer's counterpart, used by
// src/lib/queries/weddings.js, gallery.js and films.js. Its extra job over
// mediaUrl() is telling a real upload's bucket-relative key (which needs
// VITE_MEDIA_BASE_URL prepended) apart from a seeded row's already-complete
// URL (scripts/seed-db.mjs writes an images.unsplash.com link or a local
// /images/... path straight into storage_path, and re-resolving that against
// a base would either mangle it or, worse, blank out media that already
// renders fine today).
describe('publicMediaUrl', () => {
  beforeEach(() => vi.resetModules());

  it('resolves a bucket-relative key against the configured base, same as mediaUrl()', async () => {
    vi.stubEnv('VITE_MEDIA_BASE_URL', 'https://cdn.peakstorystudio.test');
    const { publicMediaUrl } = await import('../mediaUrl.js');

    expect(publicMediaUrl('uploads/abc.webp')).toBe('https://cdn.peakstorystudio.test/uploads/abc.webp');
  });

  it('returns an empty string, not null, for a bucket-relative key when unconfigured', async () => {
    vi.stubEnv('VITE_MEDIA_BASE_URL', '');
    const { publicMediaUrl } = await import('../mediaUrl.js');

    expect(publicMediaUrl('uploads/abc.webp')).toBe('');
  });

  it('passes a seeded row\'s already-absolute URL through unchanged when configured', async () => {
    vi.stubEnv('VITE_MEDIA_BASE_URL', 'https://cdn.peakstorystudio.test');
    const { publicMediaUrl } = await import('../mediaUrl.js');

    expect(publicMediaUrl('https://images.unsplash.com/photo-1?w=800')).toBe('https://images.unsplash.com/photo-1?w=800');
  });

  it('passes a seeded row\'s local root-relative path through unchanged even when unconfigured', async () => {
    vi.stubEnv('VITE_MEDIA_BASE_URL', '');
    const { publicMediaUrl } = await import('../mediaUrl.js');

    // This is the case that would regress silently: an unconfigured base
    // must never blank out a path that already renders fine on its own.
    expect(publicMediaUrl('/images/hero_royal.jpg')).toBe('/images/hero_royal.jpg');
  });

  it('returns an empty string for a missing storage path either way', async () => {
    vi.stubEnv('VITE_MEDIA_BASE_URL', 'https://cdn.peakstorystudio.test');
    const { publicMediaUrl } = await import('../mediaUrl.js');

    expect(publicMediaUrl('')).toBe('');
    expect(publicMediaUrl(null)).toBe('');
    expect(publicMediaUrl(undefined)).toBe('');
  });
});
