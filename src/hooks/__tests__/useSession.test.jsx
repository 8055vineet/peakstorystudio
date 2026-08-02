import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const signIn = vi.fn();
const signOut = vi.fn();
const getSession = vi.fn();
const getProfile = vi.fn();
const onAuthStateChange = vi.fn();

vi.mock('../../lib/auth', () => ({
  signIn: (...args) => signIn(...args),
  signOut: (...args) => signOut(...args),
  getSession: (...args) => getSession(...args),
  getProfile: (...args) => getProfile(...args),
  onAuthStateChange: (...args) => onAuthStateChange(...args),
}));

const { useSession } = await import('../useSession.js');

const SESSION = { user: { id: 'user-1' }, access_token: 'tok' };

beforeEach(() => {
  signIn.mockReset();
  signOut.mockReset();
  getSession.mockReset();
  getProfile.mockReset();
  onAuthStateChange.mockReset();
  onAuthStateChange.mockReturnValue(() => {});
});

describe('useSession', () => {
  it('starts loading, settles to anonymous with no session', async () => {
    getSession.mockResolvedValue(null);
    const { result } = renderHook(() => useSession());

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it('settles to authenticated when the session profile role is admin', async () => {
    getSession.mockResolvedValue(SESSION);
    getProfile.mockResolvedValue({ userId: 'user-1', role: 'admin', displayName: 'Studio Director' });
    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.session).toEqual(SESSION);
    expect(result.current.profile).toEqual({ userId: 'user-1', role: 'admin', displayName: 'Studio Director' });
  });

  it('settles to forbidden — not anonymous — when the session profile role is client', async () => {
    getSession.mockResolvedValue(SESSION);
    getProfile.mockResolvedValue({ userId: 'user-1', role: 'client', displayName: 'A Couple' });
    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe('forbidden'));
    expect(result.current.status).not.toBe('anonymous');
    expect(result.current.session).toEqual(SESSION);
  });

  it('settles to forbidden when there is a session but no profile row at all', async () => {
    getSession.mockResolvedValue(SESSION);
    getProfile.mockResolvedValue(null);
    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe('forbidden'));
    expect(result.current.profile).toBeNull();
  });

  it('leaves status at anonymous and exposes the error code when signIn fails', async () => {
    getSession.mockResolvedValue(null);
    signIn.mockRejectedValue(Object.assign(new Error('invalid'), { code: 'INVALID_CREDENTIALS' }));
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    let outcome;
    await act(async () => {
      outcome = await result.current.signIn('director@peakstory.test', 'wrong-password');
    });

    expect(outcome).toBe(false);
    expect(result.current.status).toBe('anonymous');
    expect(result.current.error).toBe('INVALID_CREDENTIALS');
  });

  it('unsubscribes from auth changes on unmount, and does not set state after unmount', async () => {
    const unsubscribe = vi.fn();
    let changeHandler;
    onAuthStateChange.mockImplementation((handler) => {
      changeHandler = handler;
      return unsubscribe;
    });
    getSession.mockResolvedValue(null);
    getProfile.mockResolvedValue({ userId: 'user-1', role: 'admin', displayName: 'Studio Director' });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    // Fires an auth change after unmount; the hook must not touch state
    // (which would throw/warn "Can't perform a React state update on an
    // unmounted component").
    await act(async () => {
      changeHandler(SESSION);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
