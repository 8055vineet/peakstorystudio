import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { renderHook, act } from '@testing-library/react';

const getPublishStatus = vi.fn();
const requestRebuild = vi.fn();
const getBuildInfo = vi.fn();

vi.mock('../../lib/queries/adminPublish', () => ({
  getPublishStatus: (...args) => getPublishStatus(...args),
  requestRebuild: (...args) => requestRebuild(...args),
  getBuildInfo: (...args) => getBuildInfo(...args),
}));

const { usePublishStatus } = await import('../usePublishStatus.js');

const T0 = new Date('2026-09-08T12:00:00Z');
const minutesBefore = (minutes) => new Date(T0.getTime() - minutes * 60_000);

// The three states site_publish + build-info.json can be in, relative to
// T0 (the fake clock at mount). Every timestamp is in the past so "now"
// arithmetic (waitingTooLong) is deterministic.
const IDLE = {
  publish: {
    contentChangedAt: minutesBefore(30), lastDispatchAt: minutesBefore(20), lastDispatchStatus: 'ok', dispatchCount: 1,
  },
  build: { builtAt: minutesBefore(15), degraded: false },
};
const WAITING = {
  publish: {
    contentChangedAt: minutesBefore(1), lastDispatchAt: minutesBefore(20), lastDispatchStatus: 'ok', dispatchCount: 1,
  },
  build: { builtAt: minutesBefore(15), degraded: false },
};
const DISPATCHED = {
  publish: {
    contentChangedAt: minutesBefore(1), lastDispatchAt: new Date(T0), lastDispatchStatus: 'ok', dispatchCount: 2,
  },
  build: { builtAt: minutesBefore(15), degraded: false },
};

function serve({ publish, build }) {
  getPublishStatus.mockResolvedValue(publish);
  getBuildInfo.mockResolvedValue(build);
}

// Fake timers + React: advance the clock, then let every promise the
// tick released settle inside act so state updates are flushed. RTL's
// waitFor only knows Jest's fake timers, so it is not used here.
async function advance(ms) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  getPublishStatus.mockReset();
  requestRebuild.mockReset();
  getBuildInfo.mockReset();
  requestRebuild.mockResolvedValue({
    ok: true, dispatched: true, reason: 'window_open', status: 'ok',
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePublishStatus', () => {
  it('starts unknown, then loads both the publish row and the build info on mount', async () => {
    serve(IDLE);
    const { result } = renderHook(() => usePublishStatus());

    expect(result.current.status).toBe('unknown');
    expect(result.current.lastBuiltAt).toBeNull();

    await advance(0);

    expect(getPublishStatus).toHaveBeenCalledTimes(1);
    expect(getBuildInfo).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
    expect(result.current.lastBuiltAt).toEqual(IDLE.build.builtAt);
    expect(result.current.lastDispatchAt).toEqual(IDLE.publish.lastDispatchAt);
    expect(result.current.lastDispatchStatus).toBe('ok');
    expect(result.current.changesWaitingSince).toBeNull();
    expect(result.current.waitingTooLong).toBe(false);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('tolerates a missing build-info.json and polls again every pollMs', async () => {
    getPublishStatus.mockResolvedValue(IDLE.publish);
    getBuildInfo.mockResolvedValue(null);
    const { result } = renderHook(() => usePublishStatus({ pollMs: 30_000 }));
    await advance(0);

    expect(result.current.lastBuiltAt).toBeNull();
    // A dispatch newer than an unknown build counts as still landing.
    expect(result.current.status).toBe('dispatched');

    await advance(30_000);
    expect(getPublishStatus).toHaveBeenCalledTimes(2);
    await advance(30_000);
    expect(getPublishStatus).toHaveBeenCalledTimes(3);
  });

  it('lands a failed poll in error without throwing', async () => {
    getPublishStatus.mockRejectedValue(new Error('site_publish: read failed: permission denied'));
    getBuildInfo.mockResolvedValue(null);
    const { result } = renderHook(() => usePublishStatus());
    await advance(0);

    expect(result.current.error?.message).toMatch(/permission denied/);
    expect(result.current.status).toBe('unknown');
  });

  it('reports waiting and auto-dispatches exactly once after the quiet window', async () => {
    serve(WAITING);
    const { result } = renderHook(() => usePublishStatus({ pollMs: 30_000, quietMs: 20_000 }));
    await advance(0);

    expect(result.current.status).toBe('waiting');
    expect(result.current.changesWaitingSince).toEqual(WAITING.publish.contentChangedAt);

    await advance(19_999);
    expect(requestRebuild).not.toHaveBeenCalled();

    // Once the function has recorded the dispatch, the next read says so.
    getPublishStatus.mockResolvedValue(DISPATCHED.publish);
    await advance(1);
    expect(requestRebuild).toHaveBeenCalledTimes(1);
    expect(requestRebuild).toHaveBeenCalledWith({ force: false });

    await advance(0);
    expect(result.current.status).toBe('dispatched');
    expect(result.current.lastResult).toEqual({
      ok: true, dispatched: true, reason: 'window_open', status: 'ok',
    });

    // Two more polls and two more quiet windows: nothing else fires.
    await advance(60_000);
    expect(requestRebuild).toHaveBeenCalledTimes(1);
  });

  it('restarts the quiet window when contentChangedAt advances', async () => {
    serve(WAITING);
    renderHook(() => usePublishStatus({ pollMs: 5_000, quietMs: 20_000 }));
    await advance(0);

    // The 5 s poll sees a newer change (a second save in the burst).
    getPublishStatus.mockResolvedValue({
      ...WAITING.publish, contentChangedAt: new Date(T0.getTime() + 5_000),
    });
    await advance(5_000);

    // The original window would have fired at 20 s; it was restarted at 5 s.
    await advance(16_000);
    expect(requestRebuild).not.toHaveBeenCalled();

    getPublishStatus.mockResolvedValue(DISPATCHED.publish);
    await advance(5_000);
    expect(requestRebuild).toHaveBeenCalledTimes(1);
  });

  it('retries on the next quiet window when the dispatch did not clear the waiting state', async () => {
    serve(WAITING);
    requestRebuild.mockResolvedValue({ ok: true, dispatched: false, reason: 'window_busy' });
    renderHook(() => usePublishStatus({ pollMs: 30_000, quietMs: 20_000 }));
    await advance(0);

    await advance(20_000);
    expect(requestRebuild).toHaveBeenCalledTimes(1);
    await advance(20_000);
    expect(requestRebuild).toHaveBeenCalledTimes(2);
  });

  it('stops auto-dispatching for the rest of its life after NOT_CONFIGURED, but still honours rebuild(true)', async () => {
    serve(WAITING);
    requestRebuild.mockResolvedValue({ ok: false, error: 'NOT_CONFIGURED' });
    const { result } = renderHook(() => usePublishStatus({ pollMs: 30_000, quietMs: 20_000 }));
    await advance(0);

    await advance(20_000);
    expect(requestRebuild).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('configured-missing');

    // Still "waiting" in the database; several more polls and windows pass.
    await advance(120_000);
    expect(requestRebuild).toHaveBeenCalledTimes(1);
    expect(result.current.waitingTooLong).toBe(false);

    await act(async () => { await result.current.rebuild(true); });
    expect(requestRebuild).toHaveBeenCalledTimes(2);
    expect(requestRebuild).toHaveBeenLastCalledWith({ force: true });
    expect(result.current.lastResult).toEqual({ ok: false, error: 'NOT_CONFIGURED' });
    expect(result.current.status).toBe('configured-missing');
  });

  it('rebuild(true) is busy while in flight and stores the result', async () => {
    serve(IDLE);
    let resolveRebuild;
    requestRebuild.mockImplementation(() => new Promise((resolve) => { resolveRebuild = resolve; }));
    const { result } = renderHook(() => usePublishStatus());
    await advance(0);

    let pending;
    act(() => { pending = result.current.rebuild(true); });
    expect(result.current.busy).toBe(true);
    expect(requestRebuild).toHaveBeenCalledWith({ force: true });

    getPublishStatus.mockResolvedValue(DISPATCHED.publish);
    await act(async () => {
      resolveRebuild({ ok: true, dispatched: true, reason: 'forced', status: 'ok' });
      await pending;
    });

    expect(result.current.busy).toBe(false);
    expect(result.current.lastResult).toEqual({
      ok: true, dispatched: true, reason: 'forced', status: 'ok',
    });
    // Refreshed after the call: the dispatch the function just recorded shows.
    expect(result.current.status).toBe('dispatched');
  });

  it('lands a rebuild failure in error (with its code) and in lastResult, never throwing', async () => {
    serve(IDLE);
    requestRebuild.mockRejectedValue(Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN' }));
    const { result } = renderHook(() => usePublishStatus());
    await advance(0);

    await act(async () => { await result.current.rebuild(true); });

    expect(result.current.error?.code).toBe('FORBIDDEN');
    expect(result.current.lastResult).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(result.current.busy).toBe(false);
  });

  it('flags waitingTooLong once changes have waited more than 20 minutes', async () => {
    serve(WAITING);
    requestRebuild.mockResolvedValue({ ok: true, dispatched: false, reason: 'window_busy' });
    const { result } = renderHook(() => usePublishStatus({ pollMs: 30_000, quietMs: 20_000 }));
    await advance(0);
    expect(result.current.waitingTooLong).toBe(false);

    // contentChangedAt was one minute before T0; 19 more minutes is not yet too long.
    await advance(19 * 60_000);
    expect(result.current.waitingTooLong).toBe(false);

    await advance(60_000 + 30_000);
    expect(result.current.status).toBe('waiting');
    expect(result.current.waitingTooLong).toBe(true);
  });

  it('cancels polling and the pending quiet window on unmount', async () => {
    serve(WAITING);
    const { unmount } = renderHook(() => usePublishStatus({ pollMs: 30_000, quietMs: 20_000 }));
    await advance(0);
    expect(getPublishStatus).toHaveBeenCalledTimes(1);

    unmount();

    await advance(120_000);
    expect(getPublishStatus).toHaveBeenCalledTimes(1);
    expect(requestRebuild).not.toHaveBeenCalled();
  });
});

describe('polling cadence', () => {
  it('polls every 10 seconds while changes are waiting, so a 20-second quiet window can actually restart', async () => {
    serve(WAITING);
    renderHook(() => usePublishStatus());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const afterMount = getPublishStatus.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(10_000); await Promise.resolve(); });
    expect(getPublishStatus.mock.calls.length).toBeGreaterThan(afterMount);
  });

  it('keeps the slow 30-second poll when nothing is waiting', async () => {
    serve(IDLE);
    renderHook(() => usePublishStatus());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const afterMount = getPublishStatus.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(10_000); await Promise.resolve(); });
    expect(getPublishStatus.mock.calls.length).toBe(afterMount);
  });
});
