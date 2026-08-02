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

  it('unsubscribes from auth changes on unmount', async () => {
    const unsubscribe = vi.fn();
    onAuthStateChange.mockReturnValue(unsubscribe);
    getSession.mockResolvedValue(null);

    const { result, unmount } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  // The brief singles this catch out: a failed profile lookup must land on
  // forbidden, never authenticated, because defaulting to admin on a failed
  // check is how a check becomes decoration. These four cover the ways a
  // profile lookup can fail to say "admin" without ever throwing an
  // explicit "you are not one" — the ones a refactor could plausibly get
  // wrong. Verified by mutation: replacing `profile = null` in the catch
  // with `profile = { role: 'admin' }` fails "rejects" and "no .user"
  // (the two that actually reach that catch); it does not need to move the
  // other two, which guard the `role === 'admin'` comparison itself.
  describe('forbidden on a failed or ambiguous profile check', () => {
    it('lands on forbidden, never authenticated, when getProfile rejects', async () => {
      getSession.mockResolvedValue(SESSION);
      getProfile.mockRejectedValue(new Error('permission denied'));
      const { result } = renderHook(() => useSession());

      await waitFor(() => expect(result.current.status).toBe('forbidden'));
    });

    it('lands on forbidden when the profile row has no role key', async () => {
      getSession.mockResolvedValue(SESSION);
      getProfile.mockResolvedValue({ userId: 'user-1', displayName: 'No Role Set' });
      const { result } = renderHook(() => useSession());

      await waitFor(() => expect(result.current.status).toBe('forbidden'));
    });

    it('lands on forbidden when role is "Admin" in the wrong case', async () => {
      getSession.mockResolvedValue(SESSION);
      getProfile.mockResolvedValue({ userId: 'user-1', role: 'Admin', displayName: 'Wrong Case' });
      const { result } = renderHook(() => useSession());

      await waitFor(() => expect(result.current.status).toBe('forbidden'));
    });

    it('lands on forbidden, not a crash, when the session has no .user', async () => {
      getSession.mockResolvedValue({ access_token: 'tok' });
      const { result } = renderHook(() => useSession());

      await waitFor(() => expect(result.current.status).toBe('forbidden'));
    });
  });

  describe('signIn only reports success for an actual admin', () => {
    it('returns true when signIn resolves to an authenticated admin', async () => {
      getSession.mockResolvedValue(null);
      signIn.mockResolvedValue({ session: SESSION });
      getProfile.mockResolvedValue({ userId: 'user-1', role: 'admin', displayName: 'Studio Director' });
      const { result } = renderHook(() => useSession());
      await waitFor(() => expect(result.current.status).toBe('anonymous'));

      let outcome;
      await act(async () => {
        outcome = await result.current.signIn('director@peakstory.test', 'correct-horse');
      });

      expect(outcome).toBe(true);
      expect(result.current.status).toBe('authenticated');
    });

    it('returns false — not true — when the credentials are correct but the account is not an admin', async () => {
      getSession.mockResolvedValue(null);
      signIn.mockResolvedValue({ session: SESSION });
      getProfile.mockResolvedValue({ userId: 'user-1', role: 'client', displayName: 'A Couple' });
      const { result } = renderHook(() => useSession());
      await waitFor(() => expect(result.current.status).toBe('anonymous'));

      let outcome;
      await act(async () => {
        outcome = await result.current.signIn('couple@peakstory.test', 'their-password');
      });

      expect(outcome).toBe(false);
      expect(result.current.status).toBe('forbidden');
    });
  });

  it('clears local session state in signOut even when the request rejects', async () => {
    getSession.mockResolvedValue(SESSION);
    getProfile.mockResolvedValue({ userId: 'user-1', role: 'admin', displayName: 'Studio Director' });
    signOut.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
  });
});
