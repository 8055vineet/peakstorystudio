import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { getPublishStatus, requestRebuild, getBuildInfo } from '../lib/queries/adminPublish';

// The admin's half of the freshness loop (docs/superpowers/specs/
// 2026-09-08-seo-design.md section 6). The public site is prerendered at
// build time, so a content change is live only once Cloudflare has rebuilt.
// While the admin is open this hook:
//   - polls site_publish and <origin>/build-info.json every pollMs;
//   - when content has changed since the last dispatch ("waiting"), waits
//     quietMs for the burst of saves to end — restarting the window
//     whenever contentChangedAt advances — then asks request-rebuild once;
//   - exposes rebuild(force) for the Overview's "Rebuild now" button.
//
// One instance per admin session: AdminDashboard owns it and hands the
// Weddings list what it needs. Every row polling on its own would be a
// request storm for one fact.
//
// A NOT_CONFIGURED answer (no deploy hook — every local stack) turns the
// automatic path off for the hook's lifetime: the answer will not change
// until the function's secrets do, and re-asking every quiet window would
// be noise. rebuild(true) still goes through and reports it again.

const WAITING_TOO_LONG_MS = 20 * 60_000;

export function usePublishStatus({ pollMs = 30_000, quietMs = 20_000 } = {}) {
  const [publish, setPublish] = useState(null);
  const [buildInfo, setBuildInfo] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [notConfigured, setNotConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  // Two error slots, exposed as one: a rebuild failure must survive the
  // refresh that follows it (which would otherwise wipe it on success),
  // and a poll failure must not be mistaken for a button outcome.
  const [pollError, setPollError] = useState(null);
  const [actionError, setActionError] = useState(null);
  // Bumped after every rebuild attempt so the quiet-window effect re-runs:
  // if the row still says "waiting" (the window was busy, or the call
  // failed), a fresh window starts rather than the change sitting forever.
  const [cycle, setCycle] = useState(0);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const autoDisabledRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    try {
      // getBuildInfo never rejects (null when unknown); getPublishStatus
      // does, and that is the error worth showing.
      const [nextPublish, nextBuild] = await Promise.all([getPublishStatus(), getBuildInfo()]);
      if (!mountedRef.current) return;
      setPublish(nextPublish);
      setBuildInfo(nextBuild);
      setNow(Date.now());
      setPollError(null);
    } catch (err) {
      if (mountedRef.current) setPollError(err);
    }
  }, []);

  const runRebuild = useCallback(async (force) => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    setBusy(true);
    setActionError(null);
    let result = null;
    try {
      result = await requestRebuild({ force });
      if (!mountedRef.current) return result;
      setLastResult(result);
      if (result?.ok === false && result?.error === 'NOT_CONFIGURED') {
        autoDisabledRef.current = true;
        setNotConfigured(true);
      }
    } catch (err) {
      if (!mountedRef.current) return null;
      const code = err?.code ?? 'NETWORK_ERROR';
      setActionError(err);
      setLastResult({ ok: false, error: code });
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
    await refresh();
    if (mountedRef.current) setCycle((value) => value + 1);
    return result;
  }, [refresh]);

  // Poll. The first read is deferred through .then() rather than invoked
  // directly — same shape as useResource's Promise.resolve().then(reload)
  // — so every setState this effect can trigger happens inside a promise
  // callback, never synchronously in the effect body itself.
  useEffect(() => {
    Promise.resolve().then(refresh);
    const interval = setInterval(refresh, pollMs);
    return () => clearInterval(interval);
  }, [refresh, pollMs]);

  const contentChangedAt = publish?.contentChangedAt ?? null;
  const lastDispatchAt = publish?.lastDispatchAt ?? null;
  const lastBuiltAt = buildInfo?.builtAt ?? null;
  const contentChangedMs = contentChangedAt ? contentChangedAt.getTime() : null;

  const waiting = Boolean(
    contentChangedAt && (!lastDispatchAt || contentChangedAt > lastDispatchAt),
  );

  // The quiet window. Keyed on contentChangedMs (not the Date object, whose
  // identity changes every poll) so the window restarts exactly when the
  // change actually advances, and on `cycle` so a window follows every
  // attempt that left the row still waiting.
  useEffect(() => {
    if (!waiting || autoDisabledRef.current) return undefined;
    const timer = setTimeout(() => {
      if (!inFlightRef.current && !autoDisabledRef.current) runRebuild(false);
    }, quietMs);
    return () => clearTimeout(timer);
  }, [waiting, contentChangedMs, cycle, quietMs, runRebuild]);

  const rebuild = useCallback((force = false) => runRebuild(Boolean(force)), [runRebuild]);

  const status = useMemo(() => {
    if (!publish) return 'unknown';
    if (notConfigured) return 'configured-missing';
    if (waiting) return 'waiting';
    if (lastDispatchAt && lastDispatchAt.getTime() > (lastBuiltAt?.getTime() ?? 0)) return 'dispatched';
    return 'idle';
  }, [publish, notConfigured, waiting, lastDispatchAt, lastBuiltAt]);

  const waitingTooLong = waiting && !notConfigured
    && now - contentChangedAt.getTime() > WAITING_TOO_LONG_MS;

  return {
    status,
    lastBuiltAt,
    changesWaitingSince: waiting ? contentChangedAt : null,
    lastDispatchAt,
    lastDispatchStatus: publish?.lastDispatchStatus ?? null,
    waitingTooLong,
    busy,
    lastResult,
    error: actionError ?? pollError,
    refresh,
    rebuild,
  };
}
