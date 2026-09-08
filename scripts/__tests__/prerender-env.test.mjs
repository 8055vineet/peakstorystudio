import { describe, it, expect } from 'vitest';
import { resolveOrigin, failurePolicy, mapDatabaseEnv } from '../lib/prerender-env.mjs';

describe('resolveOrigin', () => {
  it('prefers VITE_SITE_URL, stripping a trailing slash', () => {
    expect(resolveOrigin({ VITE_SITE_URL: 'https://peakstorystudio.in/', CF_PAGES_URL: 'https://x.pages.dev' }))
      .toEqual({ origin: 'https://peakstorystudio.in', source: 'VITE_SITE_URL' });
  });
  it('falls back to the Cloudflare preview URL, then to the local preview port', () => {
    expect(resolveOrigin({ CF_PAGES_URL: 'https://abc123.peakstorystudio.pages.dev' }))
      .toEqual({ origin: 'https://abc123.peakstorystudio.pages.dev', source: 'CF_PAGES_URL' });
    expect(resolveOrigin({})).toEqual({ origin: 'http://localhost:4173', source: 'default' });
  });
  it('rejects a value that is not an http(s) URL rather than emitting broken canonicals', () => {
    expect(() => resolveOrigin({ VITE_SITE_URL: 'peakstorystudio.in' })).toThrow(/VITE_SITE_URL/);
  });
});

describe('failurePolicy', () => {
  it('fails the build on Cloudflare so the last good deployment stays live', () => {
    expect(failurePolicy({ CF_PAGES: '1' })).toEqual({ mode: 'fail', reason: 'CF_PAGES=1' });
  });
  it('degrades everywhere else (CI has no database; local may not)', () => {
    expect(failurePolicy({})).toEqual({ mode: 'degrade', reason: 'not a Cloudflare Pages build' });
  });
  it('PRERENDER_ALLOW_EMPTY=1 is the escape hatch on Cloudflare', () => {
    expect(failurePolicy({ CF_PAGES: '1', PRERENDER_ALLOW_EMPTY: '1' })).toEqual({ mode: 'degrade', reason: 'PRERENDER_ALLOW_EMPTY=1' });
  });
});

describe('mapDatabaseEnv', () => {
  it('maps the plain names the other scripts use onto the VITE_ names the query layer reads', () => {
    const env = { SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_ANON_KEY: 'anon' };
    expect(mapDatabaseEnv(env)).toEqual({ configured: true, url: 'http://127.0.0.1:54321' });
    expect(env.VITE_SUPABASE_URL).toBe('http://127.0.0.1:54321');
    expect(env.VITE_SUPABASE_ANON_KEY).toBe('anon');
  });
  it('never overrides VITE_ values that are already set', () => {
    const env = { VITE_SUPABASE_URL: 'https://ref.supabase.co', VITE_SUPABASE_ANON_KEY: 'k', SUPABASE_URL: 'http://other' };
    expect(mapDatabaseEnv(env)).toEqual({ configured: true, url: 'https://ref.supabase.co' });
    expect(env.VITE_SUPABASE_URL).toBe('https://ref.supabase.co');
  });
  it('reports unconfigured when either half is missing', () => {
    expect(mapDatabaseEnv({ VITE_SUPABASE_URL: 'https://ref.supabase.co' })).toEqual({ configured: false, url: 'https://ref.supabase.co' });
    expect(mapDatabaseEnv({})).toEqual({ configured: false, url: undefined });
  });
});
