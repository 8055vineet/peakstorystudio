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
    } catch (err) {
      // Deliberately does not touch `items` — the last known-good list
      // stays on screen. A failed refresh reads as "could not load", not
      // as the resource silently emptying out.
      if (aliveRef.current && generation === generationRef.current) {
        setStatus('error');
        setError(err);
      }
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
    await reload();
    return result;
  }, [reload]);

  return {
    items, status, error, reload, mutate,
  };
}
