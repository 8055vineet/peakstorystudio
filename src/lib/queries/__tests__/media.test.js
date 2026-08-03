import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const invoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../supabase', () => ({
  supabase: {
    functions: { invoke: (...args) => invoke(...args) },
    from: (...args) => mockFrom(...args),
  },
}));

const { signUpload, uploadObject, createMedia, listMedia, updateMediaAltText, MediaError } =
  await import('../media.js');

// Mirrors src/lib/queries/__tests__/adminInquiries.test.js's chain spies:
// every link individually spy-able so tests can assert exactly which calls
// were made, not just the eventual resolved value.
function makeSelectChain({ rows = [], error = null } = {}) {
  const chain = {};
  chain.select = vi.fn(() => chain);
  chain.order = vi.fn(() => Promise.resolve({ data: rows, error }));
  return chain;
}

function makeInsertChain({ row = null, error = null } = {}) {
  const chain = {};
  chain.insert = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: row, error }));
  return chain;
}

function makeUpdateChain({ row = null, error = null } = {}) {
  const chain = {};
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: row, error }));
  return chain;
}

const ROW = {
  id: 'media-1',
  storage_path: 'uploads/abc123.webp',
  width: 2000,
  height: 1500,
  alt_text: 'A couple walking through a courtyard.',
  blurhash: null,
  created_at: '2026-08-01T10:00:00Z',
};

beforeEach(() => {
  invoke.mockReset();
  mockFrom.mockReset();
});

describe('signUpload', () => {
  it('invokes sign-upload with the declared type, size, and file name', async () => {
    invoke.mockResolvedValue({
      data: { ok: true, url: 'https://storage.test/uploads/abc.webp?sig=1', storagePath: 'uploads/abc.webp' },
      error: null,
    });

    const result = await signUpload({ contentType: 'image/webp', byteSize: 12345, fileName: 'photo.jpg' });

    expect(invoke).toHaveBeenCalledWith('sign-upload', {
      body: { contentType: 'image/webp', byteSize: 12345, fileName: 'photo.jpg' },
    });
    expect(result).toEqual({
      url: 'https://storage.test/uploads/abc.webp?sig=1',
      storagePath: 'uploads/abc.webp',
    });
  });

  it.each([
    ['MALFORMED_REQUEST', {}],
    ['UNAUTHENTICATED', {}],
    ['FORBIDDEN', {}],
    ['FILE_TOO_LARGE', { maxBytes: 10485760 }],
    ['UNSUPPORTED_TYPE', { allowed: ['image/jpeg', 'image/png', 'image/webp'] }],
    ['STORAGE_NOT_CONFIGURED', {}],
  ])('surfaces a %s response from sign-upload as a distinct MediaError', async (code, extra) => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: { json: async () => ({ ok: false, error: code, ...extra }) } },
    });

    const failure = await signUpload({ contentType: 'image/jpeg', byteSize: 1, fileName: 'a.jpg' })
      .catch((error) => error);

    expect(failure).toBeInstanceOf(MediaError);
    expect(failure.code).toBe(code);
    if (extra.maxBytes) expect(failure.maxBytes).toBe(extra.maxBytes);
    if (extra.allowed) expect(failure.allowed).toEqual(extra.allowed);
  });

  it('falls back to NETWORK_ERROR when the error carries no readable body', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('failed to fetch') });

    const failure = await signUpload({ contentType: 'image/jpeg', byteSize: 1, fileName: 'a.jpg' })
      .catch((error) => error);

    expect(failure).toBeInstanceOf(MediaError);
    expect(failure.code).toBe('NETWORK_ERROR');
  });

  it('throws SERVER_ERROR when the function answers 200 without ok', async () => {
    invoke.mockResolvedValue({ data: { ok: false }, error: null });

    const failure = await signUpload({ contentType: 'image/jpeg', byteSize: 1, fileName: 'a.jpg' })
      .catch((error) => error);

    expect(failure.code).toBe('SERVER_ERROR');
  });
});

describe('uploadObject', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('PUTs the blob with the same Content-Type it was signed for', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;
    const blob = new Blob(['bytes'], { type: 'image/webp' });

    await uploadObject('https://storage.test/uploads/abc.webp?sig=1', blob, 'image/webp');

    expect(fetchMock).toHaveBeenCalledWith('https://storage.test/uploads/abc.webp?sig=1', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/webp' },
      body: blob,
    });
  });

  it('throws UPLOAD_FAILED on a non-2xx response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });

    const failure = await uploadObject('https://storage.test/x', new Blob(['b']), 'image/webp')
      .catch((error) => error);

    expect(failure).toBeInstanceOf(MediaError);
    expect(failure.code).toBe('UPLOAD_FAILED');
  });

  it('throws UPLOAD_FAILED when the request itself fails (offline, DNS, etc.)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const failure = await uploadObject('https://storage.test/x', new Blob(['b']), 'image/webp')
      .catch((error) => error);

    expect(failure).toBeInstanceOf(MediaError);
    expect(failure.code).toBe('UPLOAD_FAILED');
  });
});

describe('createMedia', () => {
  it('inserts the storage path, dimensions, and alt text, and returns the mapped row', async () => {
    const chain = makeInsertChain({ row: ROW });
    mockFrom.mockReturnValue(chain);

    const result = await createMedia({
      storagePath: 'uploads/abc123.webp',
      width: 2000,
      height: 1500,
      altText: 'A couple walking through a courtyard.',
    });

    expect(mockFrom).toHaveBeenCalledWith('media');
    expect(chain.insert).toHaveBeenCalledWith({
      storage_path: 'uploads/abc123.webp',
      width: 2000,
      height: 1500,
      alt_text: 'A couple walking through a courtyard.',
    });
    expect(result).toEqual({
      id: 'media-1',
      storagePath: 'uploads/abc123.webp',
      width: 2000,
      height: 1500,
      altText: 'A couple walking through a courtyard.',
      blurhash: null,
      createdAt: '2026-08-01T10:00:00Z',
    });
  });

  it('defaults altText to an empty string rather than inserting null', async () => {
    const chain = makeInsertChain({ row: { ...ROW, alt_text: '' } });
    mockFrom.mockReturnValue(chain);

    await createMedia({ storagePath: 'uploads/x.webp', width: 100, height: 100 });

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ alt_text: '' }));
  });

  it('throws — this is the failure that leaves an orphaned storage object — when Postgres errors', async () => {
    mockFrom.mockReturnValue(makeInsertChain({ row: null, error: { message: 'permission denied' } }));

    await expect(createMedia({ storagePath: 'uploads/x.webp', width: 1, height: 1 }))
      .rejects.toThrow(/permission denied/);
  });
});

describe('listMedia', () => {
  it('lists newest first, mapped to camelCase', async () => {
    const chain = makeSelectChain({ rows: [ROW] });
    mockFrom.mockReturnValue(chain);

    const result = await listMedia();

    expect(mockFrom).toHaveBeenCalledWith('media');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual([{
      id: 'media-1',
      storagePath: 'uploads/abc123.webp',
      width: 2000,
      height: 1500,
      altText: 'A couple walking through a courtyard.',
      blurhash: null,
      createdAt: '2026-08-01T10:00:00Z',
    }]);
  });

  it('throws rather than resolving to an empty array when Postgres errors', async () => {
    mockFrom.mockReturnValue(makeSelectChain({ rows: null, error: { message: 'permission denied' } }));

    await expect(listMedia()).rejects.toThrow(/permission denied/);
  });
});

describe('updateMediaAltText', () => {
  it('updates alt_text by id and returns the mapped row', async () => {
    const chain = makeUpdateChain({ row: { ...ROW, alt_text: 'Updated.' } });
    mockFrom.mockReturnValue(chain);

    const result = await updateMediaAltText('media-1', 'Updated.');

    expect(mockFrom).toHaveBeenCalledWith('media');
    expect(chain.update).toHaveBeenCalledWith({ alt_text: 'Updated.' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'media-1');
    expect(result.altText).toBe('Updated.');
  });

  it('throws with a useful message when Postgres errors', async () => {
    mockFrom.mockReturnValue(makeUpdateChain({ row: null, error: { message: 'row not found' } }));

    await expect(updateMediaAltText('media-1', 'x')).rejects.toThrow(/row not found/);
  });
});
