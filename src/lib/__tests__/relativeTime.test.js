import { describe, it, expect } from 'vitest';
import { relativeTime } from '../relativeTime.js';

const NOW = new Date('2026-09-08T12:00:00Z');
const before = (ms) => new Date(NOW.getTime() - ms);

describe('relativeTime', () => {
  it('returns null for a missing or invalid date', () => {
    expect(relativeTime(null, NOW)).toBeNull();
    expect(relativeTime(undefined, NOW)).toBeNull();
    expect(relativeTime(new Date('nope'), NOW)).toBeNull();
  });

  it('says "just now" under 45 seconds, including a clock slightly ahead of now', () => {
    expect(relativeTime(before(0), NOW)).toBe('just now');
    expect(relativeTime(before(44_000), NOW)).toBe('just now');
    expect(relativeTime(before(-5_000), NOW)).toBe('just now');
  });

  it('counts minutes, singular and plural', () => {
    expect(relativeTime(before(45_000), NOW)).toBe('1 minute ago');
    expect(relativeTime(before(12 * 60_000), NOW)).toBe('12 minutes ago');
    expect(relativeTime(before(59 * 60_000 + 20_000), NOW)).toBe('59 minutes ago');
  });

  it('counts hours, then days', () => {
    expect(relativeTime(before(60 * 60_000), NOW)).toBe('1 hour ago');
    expect(relativeTime(before(3 * 60 * 60_000 + 40 * 60_000), NOW)).toBe('3 hours ago');
    expect(relativeTime(before(24 * 60 * 60_000), NOW)).toBe('1 day ago');
    expect(relativeTime(before(6 * 24 * 60 * 60_000), NOW)).toBe('6 days ago');
  });

  it('falls back to a calendar date beyond a week', () => {
    expect(relativeTime(before(8 * 24 * 60 * 60_000), NOW)).toBe('on Aug 31, 2026');
  });

  it('accepts an ISO string as well as a Date', () => {
    expect(relativeTime('2026-09-08T11:50:00Z', NOW)).toBe('10 minutes ago');
  });
});
