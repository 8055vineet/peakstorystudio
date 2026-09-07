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
  // Mirrors `state` for resolve(), which is memoised with no deps and so
  // cannot see the current render's `state`. Written in the same breath as
  // every setState below — never synced from an effect, which would lag a
  // render behind and let a resolve() read the state a sign-out just
  // replaced.
  const stateRef = useRef(state);
  // Every resolve() takes a ticket. Only the newest may write state.
  //
  // Without this, a sign-out arriving while a slow profile lookup is still in
  // flight loses the race: the older resolve() finishes last and reinstates
  // 'authenticated' over the 'anonymous' that should have replaced it. The
  // person clicked sign out and the dashboard stayed. Observed, not theorised.
  const generationRef = useRef(0);

  // Returns the status it settled on, not just void: signIn needs that
  // value to know whether it actually reached 'authenticated', rather than
  // merely that signing in itself didn't throw.
  const resolve = useCallback(async (session) => {
    const generation = ++generationRef.current;
    const isCurrent = () => aliveRef.current && generation === generationRef.current;

    if (!session) {
      if (isCurrent()) {
        const next = { status: 'anonymous', session: null, profile: null };
        stateRef.current = next;
        setState(next);
      }
      return 'anonymous';
    }
    let profile = null;
    let lookupFailed = false;
    try {
      profile = await getProfile(session.user.id);
    } catch {
      // The lookup did not ANSWER — it failed. That is a different thing
      // from a profile that says 'client', and only one of them may demote
      // an admin who is already in: Supabase re-emits onAuthStateChange on
      // every hourly TOKEN_REFRESHED and every tab-focus SIGNED_IN, and a
      // network blip on one of those used to unmount the dashboard over a
      // half-filled form with "does not have admin access". This branch
      // also covers a session with no `.user` — reading `.id` off it
      // throws synchronously into this same catch.
      lookupFailed = true;
      profile = null;
    }
    let status = profile?.role === 'admin' ? 'authenticated' : 'forbidden';
    // Only an already-trusted admin, for the SAME user, survives a failed
    // lookup — and keeps the profile that was already trusted while taking
    // the fresh session so the refreshed token is what later requests
    // carry. The first resolve (nothing trusted yet) and a failure for a
    // different user still fail closed: assuming admin on an error would
    // hand the dashboard to a failed check.
    const trusted = stateRef.current;
    if (
      lookupFailed
      && trusted.status === 'authenticated'
      && trusted.session?.user?.id === session.user?.id
    ) {
      status = 'authenticated';
      profile = trusted.profile;
    }
    // Retained defensively. It stops a resolve() that started before
    // unmount from writing state after it — but as of React 18.3, which
    // dropped the unmounted-setState warning, an ignored update to an
    // unmounted component simply doesn't re-render, so there's nothing
    // observable from outside the hook that proves this line still does
    // anything. Do not delete it on the strength of a passing test suite:
    // no test can fail if it's removed, but the bug it guards against
    // (a stale async response outliving the component that started it) is
    // real regardless.
    if (!isCurrent()) return status;
    const next = { status, session, profile };
    stateRef.current = next;
    setState(next);
    return status;
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
      const status = await resolve(session);
      // A signed-in non-admin is not a signIn failure — the credentials
      // were correct — but returning true here would tell a caller it's
      // safe to navigate into the dashboard. Only 'authenticated' means
      // that; 'forbidden' must return false just like a rejected password
      // does, so a caller that navigates on true can't walk a client into
      // a dashboard RLS will empty out from under them.
      return status === 'authenticated';
    } catch (err) {
      if (aliveRef.current) setError(err?.code ?? 'NETWORK_ERROR');
      return false;
    }
  }, [resolve]);

  const signOut = useCallback(async () => {
    // Signing out must always work locally, whatever the server says.
    // auth.js already swallows a failed signOut server-side, but this hook
    // must not depend on that staying true — someone tightening auth.js
    // later would otherwise silently strand a couple/admin in the
    // "authenticated" state after clicking sign out.
    // Claim a generation before awaiting, so an in-flight profile lookup
    // that started earlier cannot land after this and reinstate the session
    // the person just ended.
    const generation = ++generationRef.current;
    try {
      await signOutRequest();
    } catch {
      // Ignored — see above.
    } finally {
      // Same defensive guard as in resolve(), and with the same caveat: no
      // test can fail if it is removed, because React 18.3 ignores an update
      // to an unmounted component silently. The generation check, by
      // contrast, is observable — a stale resolve() overwriting this is a
      // real bug with a real test.
      if (aliveRef.current && generation === generationRef.current) {
        const next = { status: 'anonymous', session: null, profile: null };
        stateRef.current = next;
        setState(next);
      }
    }
  }, []);

  return { ...state, error, signIn, signOut };
}
