import { describe, it, expect } from 'vitest';
import { presignPut } from '../s3-presign.js';

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
