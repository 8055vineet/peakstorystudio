import { describe, it, expect, vi } from 'vitest';
import { verifyTurnstile, SITEVERIFY_URL } from '../turnstile.js';

function respondWith(body, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body });
}

describe('verifyTurnstile', () => {
  it('reports NOT_CONFIGURED when no secret is set, without calling out', async () => {
    const fetchImpl = respondWith({ success: true });
    const result = await verifyTurnstile('token', '1.2.3.4', { secret: '', fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'NOT_CONFIGURED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports NOT_CONFIGURED when the secret is whitespace only', async () => {
    const fetchImpl = respondWith({ success: true });
    const result = await verifyTurnstile('token', '1.2.3.4', { secret: '   ', fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'NOT_CONFIGURED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports MISSING_TOKEN when the browser sent none', async () => {
    const fetchImpl = respondWith({ success: true });
    const result = await verifyTurnstile('', '1.2.3.4', { secret: 's', fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'MISSING_TOKEN' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts the secret, token, and remote IP to Cloudflare', async () => {
    const fetchImpl = respondWith({ success: true });
    const result = await verifyTurnstile('tok', '1.2.3.4', { secret: 'sec', fetchImpl });
    expect(result).toEqual({ ok: true });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    expect(init.body.get('secret')).toBe('sec');
    expect(init.body.get('response')).toBe('tok');
    expect(init.body.get('remoteip')).toBe('1.2.3.4');
  });

  it('omits remoteip when the IP is unknown', async () => {
    const fetchImpl = respondWith({ success: true });
    await verifyTurnstile('tok', '', { secret: 'sec', fetchImpl });
    expect(fetchImpl.mock.calls[0][1].body.get('remoteip')).toBeNull();
  });

  it('reports REJECTED with the error codes when Cloudflare says no', async () => {
    const fetchImpl = respondWith({ success: false, 'error-codes': ['invalid-input-response'] });
    const result = await verifyTurnstile('tok', '', { secret: 'sec', fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('REJECTED');
    expect(result.codes).toEqual(['invalid-input-response']);
  });

  it('reports VERIFY_UNAVAILABLE on a non-2xx from Cloudflare', async () => {
    const fetchImpl = respondWith({}, false);
    const result = await verifyTurnstile('tok', '', { secret: 'sec', fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'VERIFY_UNAVAILABLE' });
  });

  it('reports VERIFY_UNAVAILABLE when the request throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await verifyTurnstile('tok', '', { secret: 'sec', fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'VERIFY_UNAVAILABLE' });
  });

  it('reports VERIFY_UNAVAILABLE when the call aborts on timeout', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    const fetchImpl = vi.fn().mockRejectedValue(abortError);
    const result = await verifyTurnstile('tok', '', { secret: 'sec', fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'VERIFY_UNAVAILABLE' });
  });

  it('sends an abort signal so a hung siteverify call cannot hold the worker forever', async () => {
    const fetchImpl = respondWith({ success: true });
    await verifyTurnstile('tok', '1.2.3.4', { secret: 'sec', fetchImpl });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
