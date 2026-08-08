// FALLBACK + MATH for the admin surface-warmth control (Phase 3i). Pure data
// and a pure function: the public site applies surfaceRamp()'s output as
// CSS variables (--offwhite-50..400) and the admin renders a live preview
// from the same function. The hex anchors live here — a data module, the
// same status as tailwind.config.js — never inline in a component.
export const DEFAULT_WARMTH = 0.5;

const SURFACE_KEYS = ['50', '100', '200', '300', '400'];

// Three hand-tuned cream ramps. CREAM is today's exact palette and sits at
// the slider midpoint, so warmth 0.5 reproduces the shipped site pixel for
// pixel; 0 cools toward white, 1 warms toward golden ivory. Both ends of
// each segment are low-chroma creams, so every interpolated value stays on
// the cream line.
const COOL = { 50: '#ffffff', 100: '#fcfcfb', 200: '#f4f4f2', 300: '#e7e6e2', 400: '#d6d4cd' };
const CREAM = { 50: '#ffffff', 100: '#faf9f6', 200: '#f5f3ee', 300: '#e8e4dc', 400: '#d5cfc2' };
const WARM = { 50: '#fbf6ec', 100: '#f6efe1', 200: '#efe6d4', 300: '#e2d6c1', 400: '#cfc0a5' };

function clamp01(n) {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : DEFAULT_WARMTH;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function channels(hex) {
  return [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((h) => parseInt(h, 16));
}

function toHex(n) {
  return Math.round(n).toString(16).padStart(2, '0');
}

function lerpHex(a, b, t) {
  const ca = channels(a);
  const cb = channels(b);
  return `#${ca.map((v, i) => toHex(v + (cb[i] - v) * t)).join('')}`;
}

// A five-key map of surface hexes for a warmth in [0, 1]. Two-segment,
// anchored on today's cream at 0.5.
export function surfaceRamp(warmth) {
  const w = clamp01(warmth);
  const [a, b, t] = w <= 0.5 ? [COOL, CREAM, w / 0.5] : [CREAM, WARM, (w - 0.5) / 0.5];
  const ramp = {};
  SURFACE_KEYS.forEach((key) => { ramp[key] = lerpHex(a[key], b[key], t); });
  return ramp;
}
