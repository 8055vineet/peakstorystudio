import { describe, it, expect } from 'vitest';
import { clientIp } from '../client-ip.js';

// The function only ever calls req.headers.get(name); a Headers object is
// enough of a Request for it, and gives the same case-insensitive lookup the
// runtime does.
function request(headers = {}) {
  return { headers: new Headers(headers) };
}

describe('clientIp', () => {
  it('trusts cf-connecting-ip over every other header', () => {
    const ip = clientIp(request({
      'cf-connecting-ip': ' 203.0.113.7 ',
      'x-forwarded-for': '198.51.100.1, 203.0.113.9',
      'x-real-ip': '198.51.100.2',
    }));
    expect(ip).toBe('203.0.113.7');
  });

  it('reads the LAST x-forwarded-for hop, not the client-supplied first one', () => {
    expect(clientIp(request({ 'x-forwarded-for': '198.51.100.1, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(request({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('gives a spoofed first x-forwarded-for entry no bucket of its own', () => {
    const first = clientIp(request({ 'x-forwarded-for': '10.0.0.1, 203.0.113.9' }));
    const second = clientIp(request({ 'x-forwarded-for': '10.0.0.2, 203.0.113.9' }));
    expect(first).toBe(second);
  });

  it('ignores x-real-ip entirely, alone or alongside x-forwarded-for', () => {
    expect(clientIp(request({ 'x-real-ip': '198.51.100.2' }))).toBe('');
    expect(clientIp(request({
      'x-real-ip': '198.51.100.2',
      'x-forwarded-for': '203.0.113.9',
    }))).toBe('203.0.113.9');
  });

  it('falls through a whitespace-only cf-connecting-ip to x-forwarded-for', () => {
    expect(clientIp(request({ 'cf-connecting-ip': '   ', 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('returns an empty string when no usable header is present', () => {
    expect(clientIp(request())).toBe('');
    expect(clientIp(request({ 'x-forwarded-for': ' , ' }))).toBe('');
  });
});
