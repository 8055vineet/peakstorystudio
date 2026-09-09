import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_HEADING_FONT, DEFAULT_BODY_FONT, DEFAULT_QUOTE_FONT } from '../data/fontOptions';

// The two Vite entry documents. What is in their <head> is served before
// any JavaScript runs, so it is checked as text rather than by rendering.
const ROOT = resolve(process.cwd());
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');

const FAVICON_LINKS = [
  '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">',
  '<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
];

describe.each(['index.html', 'admin.html'])('%s favicon', (file) => {
  it('no longer ships the emoji data-URI icon', () => {
    expect(read(file)).not.toMatch(/rel="icon"[^>]*href="data:/);
  });

  it.each(FAVICON_LINKS)('links %s', (link) => {
    expect(read(file)).toContain(link);
  });
});

describe('favicon files', () => {
  it.each(['public/favicon-32.png', 'public/favicon-192.png', 'public/apple-touch-icon.png'])('%s is committed', (file) => {
    expect(existsSync(resolve(ROOT, file))).toBe(true);
    expect(readFileSync(resolve(ROOT, file)).subarray(1, 4).toString()).toBe('PNG');
  });
});

// Google Fonts: the family list in a css2 URL, e.g. "Cormorant+Garamond"
// from "family=Cormorant+Garamond:ital,wght@...".
function familiesIn(href) {
  return [...href.matchAll(/family=([^:&]+)/g)].map((m) => m[1].replace(/\+/g, ' '));
}

describe('index.html fonts', () => {
  const html = read('index.html');
  const href = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/)?.[1] ?? '';

  it('preconnects to both Google Fonts origins', () => {
    expect(html).toContain('<link rel="preconnect" href="https://fonts.googleapis.com">');
    expect(html).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
  });

  it('loads exactly the three default families, nothing else', () => {
    expect(familiesIn(href).sort()).toEqual([DEFAULT_HEADING_FONT, DEFAULT_BODY_FONT, DEFAULT_QUOTE_FONT].sort());
  });

  it('loads the heading face in italic too — the headings use it', () => {
    expect(href).toMatch(/Cormorant\+Garamond:ital,wght@[^&]*1,400/);
  });
});

describe('admin.html fonts', () => {
  it('loads Cinzel itself — the admin is a separate document and cannot see index.html\'s link', () => {
    const html = read('admin.html');
    const href = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/)?.[1] ?? '';
    expect(familiesIn(href)).toContain('Cinzel');
    expect(familiesIn(href)).toContain(DEFAULT_BODY_FONT);
  });
});
