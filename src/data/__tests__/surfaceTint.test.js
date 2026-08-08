import { describe, it, expect } from 'vitest';
import { surfaceRamp, DEFAULT_WARMTH } from '../surfaceTint';

describe('surfaceRamp', () => {
  it('reproduces today’s cream palette at the 0.5 default', () => {
    expect(DEFAULT_WARMTH).toBe(0.5);
    expect(surfaceRamp(0.5)).toEqual({
      50: '#ffffff', 100: '#faf9f6', 200: '#f5f3ee', 300: '#e8e4dc', 400: '#d5cfc2',
    });
  });

  it('returns the cool-white anchor at 0 and the warm-ivory anchor at 1', () => {
    expect(surfaceRamp(0)).toEqual({
      50: '#ffffff', 100: '#fcfcfb', 200: '#f4f4f2', 300: '#e7e6e2', 400: '#d6d4cd',
    });
    expect(surfaceRamp(1)).toEqual({
      50: '#fbf6ec', 100: '#f6efe1', 200: '#efe6d4', 300: '#e2d6c1', 400: '#cfc0a5',
    });
  });

  it('clamps out-of-range and non-finite inputs', () => {
    expect(surfaceRamp(-3)).toEqual(surfaceRamp(0));
    expect(surfaceRamp(9)).toEqual(surfaceRamp(1));
    expect(surfaceRamp(NaN)).toEqual(surfaceRamp(0.5));
    expect(surfaceRamp(undefined)).toEqual(surfaceRamp(0.5));
  });

  it('interpolates on the cream line between anchors (no muddy excursion)', () => {
    const q = surfaceRamp(0.25); // halfway cool→cream
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(q[200].slice(i, i + 2), 16));
    // between cool #f4f4f2 (244,244,242) and cream #f5f3ee (245,243,238)
    expect(r).toBeGreaterThanOrEqual(0xf4); expect(r).toBeLessThanOrEqual(0xf5);
    expect(g).toBeGreaterThanOrEqual(0xf3); expect(g).toBeLessThanOrEqual(0xf4);
    expect(b).toBeGreaterThanOrEqual(0xee); expect(b).toBeLessThanOrEqual(0xf2);
  });
});
