import { describe, it, expect } from 'vitest';
import { decideDispatch } from '../rebuild-floor.js';

// Times are plain millisecond numbers here; the ISO-string cases at the end
// cover the form Postgres hands back through supabase-js.
const T0 = 1_700_000_000_000;
const WINDOW = 90_000;

describe('decideDispatch', () => {
  it('dispatches on the first ever request (no previous dispatch)', () => {
    expect(decideDispatch({ now: T0, lastDispatchAt: null, followupSent: false }))
      .toEqual({ dispatch: true, reason: 'window_open', followupSent: false });
    expect(decideDispatch({ now: T0, lastDispatchAt: undefined, followupSent: false }))
      .toEqual({ dispatch: true, reason: 'window_open', followupSent: false });
  });

  it('dispatches when the last dispatch is at or beyond the window', () => {
    expect(decideDispatch({ now: T0 + WINDOW, lastDispatchAt: T0, followupSent: false }))
      .toEqual({ dispatch: true, reason: 'window_open', followupSent: false });
    expect(decideDispatch({ now: T0 + WINDOW + 1, lastDispatchAt: T0, followupSent: false }))
      .toEqual({ dispatch: true, reason: 'window_open', followupSent: false });
  });

  it('allows exactly one follow-up inside the window', () => {
    expect(decideDispatch({ now: T0 + 10_000, lastDispatchAt: T0, followupSent: false }))
      .toEqual({ dispatch: true, reason: 'followup', followupSent: true });
  });

  it('skips a third request inside the window once the follow-up was sent', () => {
    expect(decideDispatch({ now: T0 + 20_000, lastDispatchAt: T0, followupSent: true }))
      .toEqual({ dispatch: false, reason: 'window_busy', followupSent: true });
  });

  it('always dispatches when forced, and resets followupSent', () => {
    expect(decideDispatch({ now: T0 + 20_000, lastDispatchAt: T0, followupSent: true, force: true }))
      .toEqual({ dispatch: true, reason: 'forced', followupSent: false });
    expect(decideDispatch({ now: T0, lastDispatchAt: null, followupSent: false, force: true }))
      .toEqual({ dispatch: true, reason: 'forced', followupSent: false });
  });

  it('resets followupSent once the window has expired', () => {
    expect(decideDispatch({ now: T0 + WINDOW, lastDispatchAt: T0, followupSent: true }))
      .toEqual({ dispatch: true, reason: 'window_open', followupSent: false });
  });

  it('honours a custom windowMs', () => {
    expect(decideDispatch({ now: T0 + 5_000, lastDispatchAt: T0, followupSent: true, windowMs: 4_000 }))
      .toEqual({ dispatch: true, reason: 'window_open', followupSent: false });
    expect(decideDispatch({ now: T0 + 3_000, lastDispatchAt: T0, followupSent: true, windowMs: 4_000 }))
      .toEqual({ dispatch: false, reason: 'window_busy', followupSent: true });
  });

  it('accepts ISO strings for now and lastDispatchAt', () => {
    const last = new Date(T0).toISOString();
    expect(decideDispatch({ now: new Date(T0 + 10_000).toISOString(), lastDispatchAt: last, followupSent: false }))
      .toEqual({ dispatch: true, reason: 'followup', followupSent: true });
    expect(decideDispatch({ now: new Date(T0 + WINDOW).toISOString(), lastDispatchAt: last, followupSent: true }))
      .toEqual({ dispatch: true, reason: 'window_open', followupSent: false });
    // Postgres' timestamptz text form (space separator, +00 offset) parses too.
    expect(decideDispatch({ now: T0 + 10_000, lastDispatchAt: '2023-11-14 22:13:20+00', followupSent: false }))
      .toEqual({ dispatch: true, reason: 'followup', followupSent: true });
  });

  it('treats an unparseable lastDispatchAt as no previous dispatch', () => {
    expect(decideDispatch({ now: T0, lastDispatchAt: 'not-a-date', followupSent: true }))
      .toEqual({ dispatch: true, reason: 'window_open', followupSent: false });
  });
});
