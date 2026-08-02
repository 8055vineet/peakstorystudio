import { useCallback, useEffect, useRef, useState } from 'react';

// Generic list+mutate hook for an admin resource. Task 3 supplies { list,
// update } for the leads dashboard; Task 7's makeResourceQueries supplies
// { list, create, update, remove, reorder } for five content types. This
// file must stay entirely ignorant of what any of those functions fetch or
// mutate — it only ever calls whatever it is handed, by name.
//
// status: 'loading' | 'ready' | 'error'. No optimistic writes anywhere:
// `items` only ever changes to what queries.list() most recently returned,
// never to a value this hook fabricates from an update's arguments. A row
// stays showing its old data until the database confirms otherwise.
//
// CONSTRAINT — one hook instance per resource, always. `queries` is only
// ever read through a ref (see queriesRef below), and nothing in this file
// treats "the queries object's identity changed" as "go fetch again" — the
// mount effect that calls reload() runs exactly once, on mount, full stop.
// That is deliberate: a caller re-creating an equivalent { list, update }
// object on every render (a completely normal thing to do without
// memoizing it) must not cause a refetch loop. The cost of that choice is
// that swapping `queries` to point at a genuinely *different* resource —
// e.g. the same mounted hook instance handed weddings' queries first and
// testimonials' queries later — does NOT refetch either. `items` keeps
// showing the first resource's rows at status 'ready'; the second
// resource's list() is never even called. Confirmed by swapping `list`
// between two mocked resources mid-test and observing the second is never
// invoked and `items` never changes.
//
// So: a tabbed admin screen covering several content types must give each
// tab's content type its own useResource() call — a separate component (so
// each one mounts/unmounts with its own effect), or a `key` prop on
// whichever component calls this hook that changes when the resource does,
// forcing a remount. Never reuse one mounted useResource() call across more
// than one resource.
export function useResource(queries) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  // queries is read through a ref so reload/mutate stay referentially
  // stable across renders (no effect re-run just because a caller passed a
  // freshly-literal object this render) while still always calling whatever
  // functions are current right now. Synced in an effect rather than
  // assigned inline during render — mutating a ref's `.current` while
  // rendering is exactly what react-hooks/refs forbids, since it is a side
  // effect the render pass has no business having.
  const queriesRef = useRef(queries);
  useEffect(() => {
    queriesRef.current = queries;
  }, [queries]);

  const aliveRef = useRef(true);
  // Same hazard useSession guards against: a slow reload from a stale
  // request landing after a newer one has already started must not
  // overwrite it.
  const generationRef = useRef(0);

  // Returns { ok: true } or { ok: false, error } — not just void. mutate()
  // below needs to know whether the fetch that's supposed to confirm its
  // write actually happened, and "call reload() and hope" is exactly how a
  // failed post-write refresh went unnoticed before this return value
  // existed.
  const reload = useCallback(async () => {
    const generation = ++generationRef.current;
    setStatus('loading');
    try {
      const list = await queriesRef.current.list();
      if (aliveRef.current && generation === generationRef.current) {
        setItems(list);
        setStatus('ready');
        setError(null);
      }
      return { ok: true };
    } catch (err) {
      // Deliberately does not touch `items` — the last known-good list
      // stays on screen. A failed refresh reads as "could not load", not
      // as the resource silently emptying out.
      if (aliveRef.current && generation === generationRef.current) {
        setStatus('error');
        setError(err);
      }
      return { ok: false, error: err };
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    // Deferred through .then() rather than invoked directly, same shape as
    // useTurnstile's loadScript().then(...) and useSession's
    // getSession().then(resolve) — every setState this effect can trigger
    // happens inside a .then() callback, never synchronously in the effect
    // body itself.
    Promise.resolve().then(reload);
    return () => { aliveRef.current = false; };
  }, [reload]);

  // mutate(name, ...args): runs queries[name](...args) and, only once that
  // resolves, reloads so `items` reflects what the database actually has.
  // If the named query rejects, reload is never called and the rejection
  // propagates — the caller sees the failure and nothing here has changed
  // what `items` shows. If the name was not supplied at all, this rejects
  // before calling anything, so a caller wiring the wrong action fails
  // loudly instead of silently doing nothing.
  const mutate = useCallback(async (name, ...args) => {
    const fn = queriesRef.current[name];
    if (typeof fn !== 'function') {
      throw new Error(`useResource: no query named "${name}" was supplied`);
    }
    const result = await fn(...args);
    const outcome = await reload();
    if (!outcome.ok) {
      // The write itself succeeded — this is not a failed mutation, and
      // `result` really is the database's confirmation of it — but the
      // follow-up fetch that was supposed to bring `items` up to date
      // failed, so the screen this resolves into is stale. Resolving
      // normally here would tell the caller "you're looking at what
      // happened," which is false: reject instead, so a caller with only
      // a success/failure branch still lands on the honest one. `written`
      // distinguishes this from a genuine mutation failure for any caller
      // that wants to say something more specific than "could not update."
      const staleError = new Error(
        `useResource: "${name}" succeeded, but the list could not be refreshed afterward: ${outcome.error?.message ?? 'unknown error'}`,
      );
      staleError.cause = outcome.error;
      staleError.written = true;
      throw staleError;
    }
    return result;
  }, [reload]);

  return {
    items, status, error, reload, mutate,
  };
}
