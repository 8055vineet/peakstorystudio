import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';

const invoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../supabase', () => ({
  supabase: {
    functions: { invoke: (...args) => invoke(...args) },
    from: (...args) => mockFrom(...args),
  },
}));

const { getPublishStatus, requestRebuild, getBuildInfo } = await import('../adminPublish.js');

// Chain spies mirror adminSettings.test.js's singleton-row read: every
// link individually spy-able so the test can assert the exact id filter.
function makeSingleChain({ row = null, error = null } = {}) {
  const chain = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: row, error }));
  return chain;
}

const ROW = {
  id: 1,
  content_changed_at: '2026-09-08T10:00:00Z',
  last_dispatch_at: '2026-09-08T09:00:00Z',
  last_dispatch_status: 'ok',
  dispatch_count: 3,
};

beforeEach(() => {
  invoke.mockReset();
  mockFrom.mockReset();
});

describe('getPublishStatus', () => {
  it('reads site_publish id=1 and returns Date-typed fields', async () => {
    const chain = makeSingleChain({ row: ROW });
    mockFrom.mockReturnValue(chain);

    const status = await getPublishStatus();

    expect(mockFrom).toHaveBeenCalledWith('site_publish');
    expect(chain.eq).toHaveBeenCalledWith('id', 1);
    expect(status).toEqual({
      contentChangedAt: new Date('2026-09-08T10:00:00Z'),
      lastDispatchAt: new Date('2026-09-08T09:00:00Z'),
      lastDispatchStatus: 'ok',
      dispatchCount: 3,
    });
    expect(status.contentChangedAt).toBeInstanceOf(Date);
  });

  it('maps null timestamps to null rather than an invalid Date', async () => {
    mockFrom.mockReturnValue(makeSingleChain({
      row: {
        ...ROW, content_changed_at: null, last_dispatch_at: null, last_dispatch_status: null,
      },
    }));

    const status = await getPublishStatus();

    expect(status.contentChangedAt).toBeNull();
    expect(status.lastDispatchAt).toBeNull();
    expect(status.lastDispatchStatus).toBeNull();
  });

  it('throws a plain Error carrying the Postgres message on failure', async () => {
    mockFrom.mockReturnValue(makeSingleChain({ error: { message: 'permission denied' } }));

    await expect(getPublishStatus()).rejects.toThrow('site_publish: read failed: permission denied');
  });
});

describe('requestRebuild', () => {
  it('invokes request-rebuild with force=false by default and returns the body', async () => {
    invoke.mockResolvedValue({ data: { ok: true, dispatched: true, reason: 'window_open', status: 'ok' }, error: null });

    const result = await requestRebuild();

    expect(invoke).toHaveBeenCalledWith('request-rebuild', { body: { force: false } });
    expect(result).toEqual({
      ok: true, dispatched: true, reason: 'window_open', status: 'ok',
    });
  });

  it('passes force=true through', async () => {
    invoke.mockResolvedValue({ data: { ok: true, dispatched: true, reason: 'forced', status: 'ok' }, error: null });

    await requestRebuild({ force: true });

    expect(invoke).toHaveBeenCalledWith('request-rebuild', { body: { force: true } });
  });

  it('returns the NOT_CONFIGURED body as-is (a 200, not a failure)', async () => {
    invoke.mockResolvedValue({ data: { ok: false, error: 'NOT_CONFIGURED' }, error: null });

    await expect(requestRebuild()).resolves.toEqual({ ok: false, error: 'NOT_CONFIGURED' });
  });

  it('rethrows a FunctionsHttpError as an Error whose code is the body error', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: { json: () => Promise.resolve({ ok: false, error: 'FORBIDDEN' }) } },
    });

    await expect(requestRebuild()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('codes a network failure (no response context) as NETWORK_ERROR', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('fetch failed') });

    await expect(requestRebuild()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});

describe('getBuildInfo', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches /build-info.json from the current origin without caching', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        builtAt: '2026-09-08T11:00:00Z', origin: 'https://peakstory.test', degraded: false, routes: 7, fingerprint: 'abc',
      }),
    }));

    const info = await getBuildInfo();

    expect(globalThis.fetch).toHaveBeenCalledWith(`${window.location.origin}/build-info.json`, { cache: 'no-store' });
    expect(info.builtAt).toEqual(new Date('2026-09-08T11:00:00Z'));
    expect(info.builtAt).toBeInstanceOf(Date);
    expect(info).toMatchObject({ origin: 'https://peakstory.test', degraded: false, fingerprint: 'abc' });
  });

  it('returns null on a 404', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }));

    await expect(getBuildInfo()).resolves.toBeNull();
  });

  it('returns null on a network failure', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')));

    await expect(getBuildInfo()).resolves.toBeNull();
  });

  it('returns null when the body is not JSON (the dev server’s HTML fallback)', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('bad')) }));

    await expect(getBuildInfo()).resolves.toBeNull();
  });

  it('returns null when the JSON carries no usable builtAt', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ builtAt: 'nope' }) }));

    await expect(getBuildInfo()).resolves.toBeNull();
  });
});
