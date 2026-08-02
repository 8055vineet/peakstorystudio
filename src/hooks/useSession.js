import { useCallback, useEffect, useRef, useState } from 'react';
import {
  signIn as signInRequest,
  signOut as signOutRequest,
  getSession,
  getProfile,
  onAuthStateChange,
} from '../lib/auth';

// status:
//   loading       — we do not yet know whether anyone is signed in
//   anonymous     — nobody is signed in
//   authenticated — signed in AND profiles.role = 'admin'
//   forbidden     — signed in, but not an admin
//
// `forbidden` is NOT a security decision. Row Level Security refuses every
// row and every write to a non-admin regardless of what this hook returns;
// see the Phase 1b policies. It exists so the UI can say something true —
// showing a sign-in form to someone who is already signed in is a dead end
// they cannot escape by doing what it asks.
export function useSession() {
  const [state, setState] = useState({ status: 'loading', session: null, profile: null });
  const [error, setError] = useState(null);
  const aliveRef = useRef(true);

  const resolve = useCallback(async (session) => {
    if (!session) {
      if (aliveRef.current) setState({ status: 'anonymous', session: null, profile: null });
      return;
    }
    let profile = null;
    try {
      profile = await getProfile(session.user.id);
    } catch {
      // A profile lookup that fails is indistinguishable, from here, from a
      // profile that says 'client'. Both must land on forbidden: assuming
      // admin on an error would hand the dashboard to a failed check.
      profile = null;
    }
    if (!aliveRef.current) return;
    setState({
      status: profile?.role === 'admin' ? 'authenticated' : 'forbidden',
      session,
      profile,
    });
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    getSession().then(resolve).catch(() => resolve(null));
    const unsubscribe = onAuthStateChange((session) => { resolve(session); });
    return () => {
      aliveRef.current = false;
      unsubscribe();
    };
  }, [resolve]);

  const signIn = useCallback(async (email, password) => {
    setError(null);
    try {
      const { session } = await signInRequest(email, password);
      await resolve(session);
      return true;
    } catch (err) {
      if (aliveRef.current) setError(err?.code ?? 'NETWORK_ERROR');
      return false;
    }
  }, [resolve]);

  const signOut = useCallback(async () => {
    await signOutRequest();
    if (aliveRef.current) setState({ status: 'anonymous', session: null, profile: null });
  }, []);

  return { ...state, error, signIn, signOut };
}
