import { describe, it, expect, vi } from 'vitest';

// vite.config.js imports vite and the React plugin at module level. Neither
// is under test here, and the real `vite` cannot even load in this suite's
// jsdom environment (esbuild's own load-time invariant check fails against
// jsdom's TextEncoder: "… instanceof Uint8Array is incorrectly false"), so
// both are stubbed to the identity/no-op the config needs from them.
vi.mock('vite', () => ({ defineConfig: (config) => config }));
vi.mock('@vitejs/plugin-react', () => ({ default: () => ({ name: 'react-stub' }) }));
// The config resolves its aliases from import.meta.url, which vitest's
// jsdom (web-mode) transform serves as an http:// URL, not file:// — the
// alias paths are irrelevant here, so fileURLToPath is stubbed too.
vi.mock('node:url', () => {
  const stub = { URL: globalThis.URL, fileURLToPath: (url) => String(url) };
  return { ...stub, default: stub };
});

// The admin is a second Vite entry, admin.html. Cloudflare Pages rewrites
// /admin and /admin/ to it through public/_redirects; this plugin is the
// same rewrite for `vite` and `vite preview`, so the URL the studio types
// works identically in local development and on the host. Tested by
// calling the middleware with a fake request rather than by starting a
// server — the contract is "which URLs are rewritten, and to what".
const { adminEntryRewrite, rewriteAdminUrl } = await import('../../vite.config.js');

describe('rewriteAdminUrl', () => {
  it.each([
    ['/admin', '/admin.html'],
    ['/admin/', '/admin.html'],
    ['/admin?tab=gallery', '/admin.html?tab=gallery'],
    ['/admin/?tab=gallery', '/admin.html?tab=gallery'],
  ])('rewrites %s to %s, keeping the query string', (input, expected) => {
    expect(rewriteAdminUrl(input)).toBe(expected);
  });

  it.each([
    '/admin.html',
    '/admin.html?tab=gallery',
    '/administrator',
    '/admin/photos',
    '/gallery',
    '/',
    '/src/admin/main.jsx',
  ])('leaves %s alone', (input) => {
    expect(rewriteAdminUrl(input)).toBe(input);
  });
});

describe('adminEntryRewrite plugin', () => {
  function registeredMiddleware(hookName) {
    const use = vi.fn();
    const plugin = adminEntryRewrite();
    plugin[hookName]({ middlewares: { use } });
    expect(use).toHaveBeenCalledTimes(1);
    return use.mock.calls[0][0];
  }

  it.each(['configureServer', 'configurePreviewServer'])('%s registers a middleware that rewrites /admin/ and calls next()', (hookName) => {
    const middleware = registeredMiddleware(hookName);
    const req = { url: '/admin/' };
    const next = vi.fn();

    middleware(req, {}, next);

    expect(req.url).toBe('/admin.html');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes every other request through untouched, still calling next()', () => {
    const middleware = registeredMiddleware('configureServer');
    const req = { url: '/gallery' };
    const next = vi.fn();

    middleware(req, {}, next);

    expect(req.url).toBe('/gallery');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
