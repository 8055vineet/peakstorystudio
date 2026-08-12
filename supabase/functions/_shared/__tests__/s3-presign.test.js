import { describe, it, expect } from 'vitest';
import { presignPut, deleteObject } from '../s3-presign.js';

const BASE = {
  endpoint: 'http://127.0.0.1:54321/storage/v1/s3',
  region: 'local',
  bucket: 'media',
  accessKeyId: 'test-access-key-id',
  secretAccessKey: 'test-secret-access-key',
  contentType: 'image/jpeg',
  // Fixed so every assertion below is deterministic regardless of when the
  // suite runs — see the comment on presignPut for why aws4fetch needs this
  // threaded through rather than defaulting to `new Date()`.
  now: new Date('2026-08-01T12:00:00.000Z'),
};

describe('presignPut', () => {
  it('targets the given bucket and key', async () => {
    const url = await presignPut({ ...BASE, key: 'uploads/abc123.jpg' });
    const parsed = new URL(url);
    expect(parsed.origin).toBe('http://127.0.0.1:54321');
    expect(parsed.pathname).toBe('/storage/v1/s3/media/uploads/abc123.jpg');
  });

  it('carries a signature, an expiry, and a credential naming the region', async () => {
    const url = await presignPut({ ...BASE, key: 'uploads/abc123.jpg', expiresIn: 120 });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.searchParams.get('X-Amz-Expires')).toBe('120');
    expect(parsed.searchParams.get('X-Amz-Credential')).toContain('/local/s3/');
  });

  it('defaults the expiry to 300 seconds', async () => {
    const url = await presignPut({ ...BASE, key: 'uploads/abc123.jpg' });
    expect(new URL(url).searchParams.get('X-Amz-Expires')).toBe('300');
  });

  it('produces a different signature for a different key', async () => {
    const first = await presignPut({ ...BASE, key: 'uploads/one.jpg' });
    const second = await presignPut({ ...BASE, key: 'uploads/two.jpg' });
    const sigOf = (url) => new URL(url).searchParams.get('X-Amz-Signature');
    expect(sigOf(first)).not.toBe(sigOf(second));
  });

  it('produces the same signature twice for the same inputs', async () => {
    const first = await presignPut({ ...BASE, key: 'uploads/abc123.jpg' });
    const second = await presignPut({ ...BASE, key: 'uploads/abc123.jpg' });
    expect(first).toBe(second);
  });
});

describe('deleteObject', () => {
  const fetchOk = () => {
    const calls = [];
    const impl = async (request) => { calls.push(request); return { ok: true, status: 204 }; };
    return { calls, impl };
  };

  it('performs a query-signed DELETE against the bucket key and dials it itself', async () => {
    const { calls, impl } = fetchOk();
    await deleteObject({ ...BASE, key: 'uploads/abc123.webp', fetchImpl: impl });
    expect(calls).toHaveLength(1);
    const request = calls[0];
    expect(request.method).toBe('DELETE');
    const parsed = new URL(request.url);
    expect(parsed.pathname).toBe('/storage/v1/s3/media/uploads/abc123.webp');
    // Query-signed, same surface as the presigned PUTs this stack already
    // validates (header-signed DELETEs come back SignatureDoesNotMatch —
    // see deleteObject's comment).
    expect(parsed.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.searchParams.get('X-Amz-Expires')).toBe('60');
    expect(request.headers.get('authorization')).toBeNull();
  });

  it('treats an already-gone object (404) as deleted', async () => {
    await expect(deleteObject({
      ...BASE, key: 'uploads/gone.webp', fetchImpl: async () => ({ ok: false, status: 404 }),
    })).resolves.toBeUndefined();
  });

  it('throws on any other storage failure so the caller can report it', async () => {
    await expect(deleteObject({
      ...BASE, key: 'uploads/abc.webp', fetchImpl: async () => ({ ok: false, status: 500 }),
    })).rejects.toThrow('deleteObject: storage responded 500');
  });
});
