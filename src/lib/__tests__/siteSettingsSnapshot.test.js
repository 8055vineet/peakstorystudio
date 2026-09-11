import { describe, it, expect, afterEach } from 'vitest';
import { readSiteSettingsSnapshot } from '../siteSettingsSnapshot';
import { SITE_SETTINGS_FALLBACK } from '../../data/siteSettingsFallback';

// scripts/prerender.mjs stamps the settings row into every route's <head> as
// <script type="application/json" id="site-settings">. Reading it back is
// what lets the first render paint the real hero, quote and logo instead of
// the shipped fallback, and lets the intro mount on the very first frame.

function stamp(json) {
  const tag = document.createElement('script');
  tag.type = 'application/json';
  tag.id = 'site-settings';
  tag.textContent = json;
  document.head.appendChild(tag);
  return tag;
}

afterEach(() => { document.getElementById('site-settings')?.remove(); });

describe('readSiteSettingsSnapshot', () => {
  it('returns null when the page carries no snapshot', () => {
    expect(readSiteSettingsSnapshot()).toBeNull();
  });

  it('returns the snapshot merged over the fallback, so a key the build did not write still has a value', () => {
    const partial = { ...SITE_SETTINGS_FALLBACK, logo: '/built/logo.webp', quote: { text: 'Built words', credit: 'by the build' } };
    delete partial.appearance;
    stamp(JSON.stringify(partial));
    const snapshot = readSiteSettingsSnapshot();
    expect(snapshot.logo).toBe('/built/logo.webp');
    expect(snapshot.quote.text).toBe('Built words');
    expect(snapshot.appearance).toEqual(SITE_SETTINGS_FALLBACK.appearance);
  });

  it('decodes the escaped < the build writes', () => {
    stamp(JSON.stringify({ ...SITE_SETTINGS_FALLBACK, quote: { text: 'a < b', credit: 'x' } }).replace(/</g, '\\u003c'));
    expect(readSiteSettingsSnapshot().quote.text).toBe('a < b');
  });

  it('returns null, never throws, for malformed or non-object content', () => {
    stamp('{not json');
    expect(readSiteSettingsSnapshot()).toBeNull();
    document.getElementById('site-settings').remove();
    stamp('"a string"');
    expect(readSiteSettingsSnapshot()).toBeNull();
    document.getElementById('site-settings').remove();
    stamp('[]');
    expect(readSiteSettingsSnapshot()).toBeNull();
  });
});
