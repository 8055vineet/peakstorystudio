import { describe, it, expect } from 'vitest';
import { googleFontsHref, familySpec, nonDefaultFamilies, FONT_AXES } from '../googleFonts';
import {
  HEADING_FONTS, BODY_FONTS, QUOTE_FONTS,
  DEFAULT_HEADING_FONT, DEFAULT_BODY_FONT, DEFAULT_QUOTE_FONT,
} from '../../data/fontOptions';

const EVERY_CHOICE = [...new Set([...HEADING_FONTS, ...BODY_FONTS, ...QUOTE_FONTS].map((f) => f.value))];

describe('FONT_AXES', () => {
  it('has an axis spec for every family the admin can choose', () => {
    for (const family of EVERY_CHOICE) expect(FONT_AXES, family).toHaveProperty(family);
  });

  // The css2 endpoint rejects the WHOLE request (HTTP 400, no fonts at all)
  // when one family's tuples are out of order, so every ital,wght list must
  // be sorted: all upright weights ascending, then all italic weights.
  it('lists every ital,wght tuple in the order the css2 API requires', () => {
    for (const [family, spec] of Object.entries(FONT_AXES)) {
      if (!spec.startsWith('ital,wght@')) continue;
      const tuples = spec.slice('ital,wght@'.length).split(';').map((t) => t.split(',').map(Number));
      const sorted = [...tuples].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      expect(tuples, family).toEqual(sorted);
    }
  });
});

describe('familySpec', () => {
  it('encodes a family with its axis spec, spaces as plus signs', () => {
    expect(familySpec('Playfair Display')).toBe(`Playfair+Display:${FONT_AXES['Playfair Display']}`);
  });

  it('gives the heading default italics, which the headings use', () => {
    expect(familySpec('Cormorant Garamond')).toMatch(/^Cormorant\+Garamond:ital,wght@0,300;.*;1,400;/);
  });

  it('asks for only the regular face of a single-weight family like Marcellus', () => {
    expect(familySpec('Marcellus')).toBe('Marcellus');
  });

  it('falls back to the bare family name for a family it has no spec for', () => {
    expect(familySpec('Some Future Face')).toBe('Some+Future+Face');
  });
});

describe('googleFontsHref', () => {
  it('builds a css2 URL with display=swap for the families given, in order', () => {
    expect(googleFontsHref(['Playfair Display', 'Inter'])).toBe(
      `https://fonts.googleapis.com/css2?family=Playfair+Display:${FONT_AXES['Playfair Display']}&family=Inter:${FONT_AXES.Inter}&display=swap`,
    );
  });

  it('drops duplicates and blanks', () => {
    expect(googleFontsHref(['Inter', '', 'Inter', null, undefined])).toBe(
      `https://fonts.googleapis.com/css2?family=Inter:${FONT_AXES.Inter}&display=swap`,
    );
  });

  it('returns an empty string when there is nothing to load', () => {
    expect(googleFontsHref([])).toBe('');
    expect(googleFontsHref(['', null])).toBe('');
    expect(googleFontsHref()).toBe('');
  });
});

describe('nonDefaultFamilies', () => {
  it('returns nothing when the settings resolve to the three shipped defaults', () => {
    expect(nonDefaultFamilies({ heading: DEFAULT_HEADING_FONT, body: DEFAULT_BODY_FONT, quote: DEFAULT_QUOTE_FONT })).toEqual([]);
  });

  it('returns only the families index.html does not already load', () => {
    expect(nonDefaultFamilies({ heading: 'Playfair Display', body: DEFAULT_BODY_FONT, quote: 'Marcellus' }))
      .toEqual(['Playfair Display', 'Marcellus']);
  });

  it('lists a family once when two roles share it', () => {
    expect(nonDefaultFamilies({ heading: 'Poppins', body: 'Poppins', quote: DEFAULT_QUOTE_FONT })).toEqual(['Poppins']);
  });

  it('treats a default family used in another role as already loaded', () => {
    expect(nonDefaultFamilies({ heading: 'Quicksand', body: 'Plus Jakarta Sans', quote: 'Cormorant Garamond' })).toEqual([]);
  });

  it('tolerates a missing or partial fonts object (outage fallback)', () => {
    expect(nonDefaultFamilies(undefined)).toEqual([]);
    expect(nonDefaultFamilies({})).toEqual([]);
    expect(nonDefaultFamilies({ heading: 'Inter' })).toEqual(['Inter']);
  });
});
