// Cloudflare Turnstile server-side verification.
//
// fetch is injected so this can be tested without reaching the network. It is
// the only real spam control in the pipeline: the honeypot catches only naive
// bots, and the rate limit deliberately fails open.

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token, remoteIp, { secret, fetchImpl = fetch } = {}) {
  if (!secret) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (!token) return { ok: false, reason: 'MISSING_TOKEN' };

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);

  let response;
  try {
    response = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body });
  } catch {
    return { ok: false, reason: 'VERIFY_UNAVAILABLE' };
  }

  if (!response.ok) return { ok: false, reason: 'VERIFY_UNAVAILABLE' };

  const result = await response.json();
  if (result?.success) return { ok: true };

  return { ok: false, reason: 'REJECTED', codes: result?.['error-codes'] ?? [] };
}
