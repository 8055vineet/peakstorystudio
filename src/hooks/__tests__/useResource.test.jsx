import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useResource } from '../useResource.js';

// Generic by design — Tasks 7-9 reuse this hook unchanged for five content
// types, so nothing in here may know about inquiries. `list`/`update` below
// stand in for whatever async functions a given resource actually supplies.
const list = vi.fn();
const update = vi.fn();

beforeEach(() => {
  list.mockReset();
  update.mockReset();
});

describe('useResource', () => {
  it('starts loading and settles to ready with the list on mount', async () => {
    list.mockResolvedValue([{ id: '1' }, { id: '2' }]);
    const { result } = renderHook(() => useResource({ list, update }));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toEqual([{ id: '1' }, { id: '2' }]);
    expect(result.current.error).toBeNull();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('settles to error, not an empty ready list, when list() rejects', async () => {
    const failure = new Error('permission denied');
    list.mockRejectedValue(failure);
    const { result } = renderHook(() => useResource({ list, update }));

    await waitFor(() => expect(result.current.status).toBe('error'));
    // Distinct from a genuinely empty resource — an empty array here would
    // read as "no inquiries" instead of "could not load inquiries".
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe(failure);
  });

  it('reload() re-runs list() and replaces items with what it returns', async () => {
    list.mockResolvedValueOnce([{ id: '1' }]);
    const { result } = renderHook(() => useResource({ list, update }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    list.mockResolvedValueOnce([{ id: '1' }, { id: '2' }]);
    await act(async () => { await result.current.reload(); });

    expect(list).toHaveBeenCalledTimes(2);
    expect(result.current.items).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('a failing reload() flips status to error but keeps the last known-good items', async () => {
    list.mockResolvedValueOnce([{ id: '1' }]);
    const { result } = renderHook(() => useResource({ list, update }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    list.mockRejectedValueOnce(new Error('network down'));
    await act(async () => { await result.current.reload(); });

    expect(result.current.status).toBe('error');
    // No optimistic wipe: the last confirmed data stays on screen rather
    // than disappearing behind a failed refresh.
    expect(result.current.items).toEqual([{ id: '1' }]);
  });

  it('mutate() calls the named query, then reloads — the reload result is what items reflect', async () => {
    list.mockResolvedValueOnce([{ id: '1', status: 'new' }]);
    const { result } = renderHook(() => useResource({ list, update }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    update.mockResolvedValue({ id: '1', status: 'booked' });
    list.mockResolvedValueOnce([{ id: '1', status: 'booked' }]);

    let outcome;
    await act(async () => {
      outcome = await result.current.mutate('update', '1', 'booked');
    });

    expect(update).toHaveBeenCalledWith('1', 'booked');
    expect(list).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ id: '1', status: 'booked' });
    expect(result.current.items).toEqual([{ id: '1', status: 'booked' }]);
  });

  it('mutate() rejects and does NOT reload when the named query itself fails — no optimistic UI', async () => {
    list.mockResolvedValueOnce([{ id: '1', status: 'new' }]);
    const { result } = renderHook(() => useResource({ list, update }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const failure = new Error('update rejected by RLS');
    update.mockRejectedValue(failure);

    let caught;
    await act(async () => {
      await result.current.mutate('update', '1', 'booked').catch((err) => { caught = err; });
    });

    expect(caught).toBe(failure);
    // Only the initial mount call — the failed mutate must not have
    // triggered a reload, and the row must still show its old status.
    expect(list).toHaveBeenCalledTimes(1);
    expect(result.current.items).toEqual([{ id: '1', status: 'new' }]);
  });

  it('mutate() rejects with no side effects when the named query was not supplied', async () => {
    list.mockResolvedValue([{ id: '1' }]);
    const { result } = renderHook(() => useResource({ list }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await expect(result.current.mutate('remove', '1')).rejects.toThrow();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('does not know anything about inquiries — it only calls whatever functions it is given', () => {
    const src = String(useResource);
    expect(src).not.toMatch(/inquir/i);
  });
});
