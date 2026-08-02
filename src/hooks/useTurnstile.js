import { useCallback, useEffect, useRef, useState } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_ID = 'cf-turnstile-script';

// How long to wait on a script tag this hook did not create before giving up
// on it. Only ever applies to the adopted-tag path below.
const ADOPTED_SCRIPT_TIMEOUT_MS = 10000;

function loadScript() {
  if (typeof document === 'undefined') return Promise.reject(new Error('no document'));

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    // Something else — e.g. Cloudflare's own documented <script> tag, hand
    // placed in index.html — may own this id without ever setting our
    // tracking expando. Do not assume that means success: check the one
    // fact we can (whether the global already landed), and otherwise listen
    // for the outcome rather than dereferencing an undefined promise.
    if (existing.__loadPromise) return existing.__loadPromise;
    existing.__loadPromise = window.turnstile
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
        // A tag that already finished loading — successfully or not — will
        // never fire either event again, so listeners alone can leave this
        // pending forever: no widget, no error, nothing for the couple to
        // act on. This app shows a splash screen before the form mounts,
        // which makes "already settled" the likely case rather than the
        // exotic one, so the wait is bounded and a timeout is reported the
        // same way a failed load is.
        const timer = setTimeout(
          () => reject(new Error('Turnstile script did not load in time')),
          ADOPTED_SCRIPT_TIMEOUT_MS,
        );
        existing.addEventListener('load', () => {
          clearTimeout(timer);
          resolve();
        });
        existing.addEventListener('error', () => {
          clearTimeout(timer);
          reject(new Error('Turnstile script failed to load'));
        });
      });
    return existing.__loadPromise;
  }

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  script.__loadPromise = new Promise((resolve, reject) => {
    script.addEventListener('load', resolve);
    script.addEventListener('error', () => {
      // Otherwise this failure is cached forever: every later mount would
      // reuse the same rejected promise, and a couple on a flaky connection
      // would have no way to recover short of a full page reload.
      script.remove();
      reject(new Error('Turnstile script failed to load'));
    });
  });
  document.head.appendChild(script);
  return script.__loadPromise;
}

// Renders the Turnstile widget into containerRef and hands back the token it
// produces. The token is single-use: Cloudflare rejects a replay, so the form
// resets the widget after every submission attempt.
export function useTurnstile(siteKey) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!siteKey) return undefined;

    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (value) => setToken(value),
          'expired-callback': () => setToken(''),
          'error-callback': () => {
            setToken('');
            setError('Verification is unavailable right now.');
          },
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError('Verification could not load.');
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  const reset = useCallback(() => {
    setToken('');

    // Only a widget that exists can clear its own error. When there is one, a
    // stale error-callback message must go, or a couple who hit one transient
    // error stays blocked from booking even after the widget recovers.
    //
    // When there is no widget the error came from the script failing to load,
    // and nothing will ever re-raise it. Clearing it there would erase the
    // only explanation the couple has and leave a silent dead end — no
    // widget, no message, no way to know why they cannot submit. The form
    // resets after every attempt, so that would happen on the first retry.
    if (widgetIdRef.current && window.turnstile) {
      setError(null);
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  return { containerRef, token, ready, error, reset };
}
