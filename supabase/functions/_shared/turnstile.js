// Cloudflare Turnstile server-side verification.
//
// fetch is injected so this can be tested without reaching the network. It is
// the only real spam control in the pipeline: the honeypot catches only naive
// bots, and the rate limit deliberately fails open.

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Cloudflare can slow down without going fully down; a hung siteverify call
// would otherwise hold the worker (and the visitor's browser) for as long as
// the platform's own connection timeout, which is far longer than a visitor
// will wait. Capping it here means a slowdown degrades to "unavailable"
// within a bounded time instead of stalling the request indefinitely.
const SITEVERIFY_TIMEOUT_MS = 5000;

export async function verifyTurnstile(token, remoteIp, { secret, fetchImpl = fetch } = {}) {
  // A whitespace-only secret is still a misconfiguration, not a rejected
  // visitor — trim before the emptiness check so it reports NOT_CONFIGURED
  // (a 500 that says the server is broken) rather than masquerading as
  // CAPTCHA_FAILED (a 403 that blames the couple for something they never did).
  const trimmedSecret = secret?.trim();
  if (!trimmedSecret) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (!token) return { ok: false, reason: 'MISSING_TOKEN' };

  const body = new FormData();
  body.append('secret', trimmedSecret);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);

  let response;
  try {
    response = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
  } catch {
    // Covers a network error, a non-2xx-adjacent throw, and — the case this
    // timeout exists for — an AbortError once SITEVERIFY_TIMEOUT_MS elapses.
    // All three mean the same thing to a caller: verification could not be
    // completed, not that the visitor failed it.
    return { ok: false, reason: 'VERIFY_UNAVAILABLE' };
  }

  if (!response.ok) return { ok: false, reason: 'VERIFY_UNAVAILABLE' };

  const result = await response.json();
  if (result?.success) return { ok: true };

  return { ok: false, reason: 'REJECTED', codes: result?.['error-codes'] ?? [] };
}
