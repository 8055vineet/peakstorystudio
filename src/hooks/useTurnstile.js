import { useCallback, useEffect, useRef, useState } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_ID = 'cf-turnstile-script';

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
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', () => reject(new Error('Turnstile script failed to load')));
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
    // A widget that has already recovered and issued a fresh token should
    // not keep reporting the stale error from a prior error-callback — left
    // set, Task 7 has no way to know the widget is usable again and a
    // couple who hit one transient error would be blocked from booking at
    // all.
    setError(null);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  return { containerRef, token, ready, error, reset };
}
