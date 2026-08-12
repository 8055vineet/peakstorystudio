import { useCallback, useEffect, useRef, useState } from 'react';
import { getClientGalleries } from '../lib/queries/clientGalleries';

// The client portal's data hook, in the pattern of useInquirySubmission:
// components (AuthModal, ClientGalleryModal) call this; only the query
// module touches Supabase. Two consumers, one shape:
//
//   const { status, galleries, error, lookup, reset } = useClientAccess(code);
//
// - AuthModal passes no code and drives `lookup(enteredCode)` imperatively
//   on submit; a resolved non-empty list is a successful sign-in.
// - ClientGalleryModal passes the signed-in user's stored code; the hook
//   fetches on mount and code change so reopening the portal always shows the
//   current list (the admin may have added an entry since sign-in).
//
// status: 'idle' | 'loading' | 'ready' | 'error'. `galleries` only ever
// holds what the last successful lookup returned.
export function useClientAccess(code = null) {
  const [state, setState] = useState({ status: 'idle', galleries: [], error: null });
  const aliveRef = useRef(true);
  const generationRef = useRef(0);

  const lookup = useCallback(async (candidate) => {
    const generation = ++generationRef.current;
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    try {
      const galleries = await getClientGalleries(candidate);
      if (aliveRef.current && generation === generationRef.current) {
        setState({ status: 'ready', galleries, error: null });
      }
      return galleries;
    } catch (err) {
      if (aliveRef.current && generation === generationRef.current) {
        setState({ status: 'error', galleries: [], error: err });
      }
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    generationRef.current += 1;
    setState({ status: 'idle', galleries: [], error: null });
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    if (code) {
      // Deferred through .then, same shape as useResource's mount fetch —
      // no synchronous setState in the effect body.
      Promise.resolve().then(() => lookup(code).catch(() => {}));
    }
    return () => { aliveRef.current = false; };
  }, [code, lookup]);

  return { ...state, lookup, reset };
}
