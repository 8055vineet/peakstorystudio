import { describe, it, expect, afterEach } from 'vitest';
import { formatDateOnly, formatTimestamp } from '../formatDate.js';

describe('formatDateOnly', () => {
  it('formats a bare date column as "Mon D, YYYY"', () => {
    expect(formatDateOnly('2027-02-14')).toBe('Feb 14, 2027');
  });

  it('returns null for a missing value', () => {
    expect(formatDateOnly(null)).toBeNull();
    expect(formatDateOnly('')).toBeNull();
    expect(formatDateOnly(undefined)).toBeNull();
  });

  describe('does not shift the day in a timezone west of Greenwich', () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      // Assigning back an undefined original coerces to the STRING
      // "undefined", which is not a zone — every later test in the file
      // then runs under a resolved timezone of undefined rather than the
      // one it started in. Delete instead of assigning when there was
      // nothing there.
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    });

    it('renders Jan 1 as Jan 1 under UTC-10 — the exact bug new Date(dateOnlyString) reintroduces', () => {
      // The historical bug this guards against: new Date('2027-01-01')
      // parses as 2027-01-01T00:00:00Z, which is still 2026-12-31 14:00 in
      // UTC-10 — reading the day back with a local getter or
      // toLocaleDateString (no explicit timeZone) would print "Dec 31,
      // 2026" instead of "Jan 1, 2027". formatDateOnly never constructs a
      // Date at all for this input, so it must be immune regardless of TZ.
      process.env.TZ = 'Pacific/Honolulu';
      expect(formatDateOnly('2027-01-01')).toBe('Jan 1, 2027');
    });

    it('renders Dec 31 as Dec 31 under UTC+14 too', () => {
      process.env.TZ = 'Pacific/Kiritimati';
      expect(formatDateOnly('2026-12-31')).toBe('Dec 31, 2026');
    });
  });
});

describe('formatTimestamp', () => {
  it('formats a timestamptz as "Mon D, YYYY"', () => {
    expect(formatTimestamp('2026-08-01T10:00:00Z')).toBe('Aug 1, 2026');
  });

  it('returns null for a missing or unparseable value', () => {
    expect(formatTimestamp(null)).toBeNull();
    expect(formatTimestamp('')).toBeNull();
    expect(formatTimestamp('not-a-date')).toBeNull();
  });
});
