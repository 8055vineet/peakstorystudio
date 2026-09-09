import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// The files in public/ that Cloudflare Pages reads at the edge. They are
// plain text with no code path to test, so these assertions pin the
// contract Pages applies to them (https://developers.cloudflare.com/pages/
// configuration/redirects/): a _redirects rule matches BEFORE the static
// asset lookup, so a "/*" catch-all would proxy every request — hashed
// JS/CSS chunks, images, robots.txt itself — to index.html. Pages already
// serves index.html for any unknown path when there is no 404.html, which
// is all the SPA needs.
const ROOT = resolve(process.cwd());
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
const rules = (text) => text.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));

describe('public/_redirects', () => {
  it('has no "/*" catch-all — it would proxy every asset to index.html on Pages', () => {
    for (const rule of rules(read('public/_redirects'))) {
      expect(rule.startsWith('/*')).toBe(false);
    }
  });

  it('redirects trailing-slash forms of the prerendered dynamic routes to their canonical URLs', () => {
    // Prerendered files are flat (stories/<slug>.html), served at /stories/<slug>.
    // Cloudflare documents placeholders in _redirects; what it does with an
    // unmatched trailing slash is undocumented, so the rule is explicit.
    const lines = rules(read('public/_redirects')).map((line) => line.split(/\s+/));
    expect(lines).toContainEqual(['/stories/:slug/', '/stories/:slug', '301']);
    expect(lines).toContainEqual(['/more/:slug/', '/more/:slug', '301']);
  });

  it('has no /admin rule — one there loops forever on Pages', () => {
    // Observed on the first real deploy (2026-09-09): `/admin /admin.html 200`
    // sent /admin into an infinite redirect. A rule matches before the asset
    // lookup, so /admin was rewritten to /admin.html; Pages then applies its
    // own canonicalisation, which 308s any .html path to its extension-less
    // form (https://developers.cloudflare.com/pages/configuration/serving-pages/)
    // — back to /admin, matching the rule again. No rule is needed: that same
    // canonicalisation already serves admin.html at /admin. The Vite dev
    // server has no such behaviour, which is what adminEntryRewrite in
    // vite.config.js exists for.
    for (const rule of rules(read('public/_redirects'))) {
      expect(rule.startsWith('/admin')).toBe(false);
    }
  });
});

describe('public/robots.txt', () => {
  it('exists, allows every crawler everything, and points at the sitemap', () => {
    expect(existsSync(resolve(ROOT, 'public/robots.txt'))).toBe(true);
    const lines = rules(read('public/robots.txt'));
    expect(lines).toContain('User-agent: *');
    expect(lines).toContain('Allow: /');
    expect(lines.some((line) => /^Disallow:\s*\S/.test(line))).toBe(false);
    expect(lines).toContain('Sitemap: https://peakstorystudio.in/sitemap.xml');
  });
});

describe('the SPA fallback', () => {
  it('is never disabled by a 404.html — Pages serves the root for unknown paths only while none exists', () => {
    expect(existsSync(resolve(process.cwd(), 'public/404.html'))).toBe(false);
  });
});
