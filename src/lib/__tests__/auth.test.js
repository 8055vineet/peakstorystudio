import { describe, it, expect, vi, beforeEach } from 'vitest';

const signInWithPassword = vi.fn();
const signOutMock = vi.fn();
const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle: (...args) => maybeSingle(...args) }));
const select = vi.fn(() => ({ eq: (...args) => eq(...args) }));
const from = vi.fn(() => ({ select: (...args) => select(...args) }));

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args) => signInWithPassword(...args),
      signOut: (...args) => signOutMock(...args),
      getSession: (...args) => getSessionMock(...args),
      onAuthStateChange: (...args) => onAuthStateChangeMock(...args),
    },
    from: (...args) => from(...args),
  },
  isSupabaseConfigured: true,
}));

const { signIn, signOut, getProfile, AuthError } = await import('../auth.js');

beforeEach(() => {
  signInWithPassword.mockReset();
  signOutMock.mockReset();
  getSessionMock.mockReset();
  onAuthStateChangeMock.mockReset();
  maybeSingle.mockReset();
  eq.mockClear();
  select.mockClear();
  from.mockClear();
});

describe('signIn', () => {
  it('returns the session on success and passes the exact credentials through', async () => {
    const session = { user: { id: 'user-1' }, access_token: 'tok' };
    signInWithPassword.mockResolvedValue({ data: { session, user: session.user }, error: null });

    const result = await signIn('director@peakstory.test', 'correct-horse');

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'director@peakstory.test',
      password: 'correct-horse',
    });
    expect(result).toEqual({ session });
  });

  it('throws AuthError with code INVALID_CREDENTIALS when Supabase reports invalid credentials', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
    });

    const failure = await signIn('director@peakstory.test', 'wrong-password').catch((error) => error);

    expect(failure).toBeInstanceOf(AuthError);
    expect(failure.code).toBe('INVALID_CREDENTIALS');
  });

  it('throws NETWORK_ERROR when the call rejects', async () => {
    signInWithPassword.mockRejectedValue(new Error('failed to fetch'));

    const failure = await signIn('director@peakstory.test', 'correct-horse').catch((error) => error);

    expect(failure).toBeInstanceOf(AuthError);
    expect(failure.code).toBe('NETWORK_ERROR');
  });

  it('throws NOT_CONFIGURED — without calling Supabase — when isSupabaseConfigured is false', async () => {
    vi.resetModules();
    vi.doMock('../supabase', () => ({ supabase: null, isSupabaseConfigured: false }));

    const { signIn: signInUnconfigured, AuthError: AuthErrorUnconfigured } = await import('../auth.js');
    const failure = await signInUnconfigured('director@peakstory.test', 'correct-horse').catch((error) => error);

    expect(failure).toBeInstanceOf(AuthErrorUnconfigured);
    expect(failure.code).toBe('NOT_CONFIGURED');
    expect(signInWithPassword).not.toHaveBeenCalled();

    vi.doUnmock('../supabase');
    vi.resetModules();
  });
});

describe('getProfile', () => {
  it('returns null rather than throwing when no row exists', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getProfile('user-1');

    expect(result).toBeNull();
  });

  it('maps user_id/display_name to userId/displayName', async () => {
    maybeSingle.mockResolvedValue({
      data: { user_id: 'user-1', role: 'admin', display_name: 'Studio Director' },
      error: null,
    });

    const result = await getProfile('user-1');

    expect(result).toEqual({ userId: 'user-1', role: 'admin', displayName: 'Studio Director' });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});

describe('signOut', () => {
  it('resolves even when Supabase reports an error', async () => {
    signOutMock.mockResolvedValue({ error: { message: 'network down' } });

    await expect(signOut()).resolves.toBeUndefined();
  });

  it('resolves even when the underlying call rejects', async () => {
    signOutMock.mockRejectedValue(new Error('failed to fetch'));

    await expect(signOut()).resolves.toBeUndefined();
  });
});
