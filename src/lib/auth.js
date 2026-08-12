import { supabase, isSupabaseConfigured } from './supabase';

// This module decides nothing about access. It exists so components have a
// typed, un-logged way to ask Postgres who is signed in. Row Level Security
// — ten `is_admin()` policies from Phase 1b — is what actually protects
// every table and every write. A signed-in non-admin who defeats every check
// in this file still sees an empty dashboard and every write still fails,
// because the database refuses it regardless of what this file returns.

export class AuthError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AuthError';
    this.code = code;
  }
}

function mapSignInError(error) {
  // AuthApiError carries a stable machine code ('invalid_credentials') in
  // recent supabase-js; older responses only set status 400. Either signal
  // means the credentials were wrong, not that the network failed.
  if (error?.code === 'invalid_credentials' || error?.status === 400) {
    return new AuthError('INVALID_CREDENTIALS');
  }
  return new AuthError('NETWORK_ERROR');
}

// Never log the email or password passed in here, nor the session or token
// this resolves to.
export async function signIn(email, password) {
  if (!isSupabaseConfigured) {
    throw new AuthError('NOT_CONFIGURED');
  }

  let result;
  try {
    result = await supabase.auth.signInWithPassword({ email, password });
  } catch {
    throw new AuthError('NETWORK_ERROR');
  }

  const { data, error } = result;
  if (error) {
    throw mapSignInError(error);
  }

  return { session: data.session };
}

// Resolves even when Supabase reports an error, or the call itself throws: a
// client that cannot reach the server must still be able to forget its
// session locally rather than being stuck signed in.
export async function signOut() {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.auth.signOut();
  } catch {
    // Ignored — see comment above.
  }
}

export async function getSession() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

// `handler` receives the current session (or null) whenever it changes.
// Returns an unsubscribe function.
export function onAuthStateChange(handler) {
  if (!isSupabaseConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    handler(session);
  });
  return () => data.subscription.unsubscribe();
}

// Uses maybeSingle() so a signed-in user with no profiles row — which RLS
// permits to exist — resolves to null instead of throwing. Callers (see
// useSession) must treat null the same as role !== 'admin', never as admin.
export async function getProfile(userId) {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, role, display_name, is_owner')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new AuthError('NETWORK_ERROR');
  }
  if (!data) return null;

  return {
    userId: data.user_id,
    role: data.role,
    displayName: data.display_name,
    // Owner-only surfaces (the Team panel) key off this; content permissions
    // never do — those stay on `role`, enforced by RLS.
    isOwner: data.is_owner === true,
  };
}
