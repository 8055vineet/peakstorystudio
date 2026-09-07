// The address a request is rate-limited under. Nothing else in the inquiry
// pipeline reads it, and it is the one input to consume_inquiry_rate_limit a
// visitor can try to choose — so which headers are believed, and in what
// order, IS the rate limiter's security model.
//
// Kept free of Deno and browser globals, like every other _shared module, so
// the Vitest suite exercises exactly the code submit-inquiry runs.
//
// cf-connecting-ip is the one header Cloudflare itself sets on every request
// that reaches it, overwriting whatever the client sent — so it is the only
// entry here a visitor cannot forge.
//
// x-forwarded-for is the fallback, and read from the END of the chain rather
// than the start, because Cloudflare (and most proxies) APPEND the peer
// address to whatever x-forwarded-for the client already sent instead of
// replacing it — so element [0] is attacker-controlled and only the last
// element is the one the nearest trusted hop actually appended. Trusting [0]
// (the "naive" reading of "the first entry is the client") is exactly what
// let a spoofed x-forwarded-for defeat the rate limit: three requests
// carrying three different first-entries landed in three different buckets.
//
// x-real-ip is deliberately NOT consulted. Some reverse proxies set it under
// the same assumption as cf-connecting-ip, but Cloudflare is not one of them,
// and nothing here can tell a proxy-set x-real-ip from a client-sent one. It
// used to be read second, ahead of x-forwarded-for — which meant that if
// cf-connecting-ip ever failed to reach the runtime, a client could send a
// fresh x-real-ip on every request and land in a fresh bucket each time: the
// same hole as trusting x-forwarded-for[0], through a different header.
export function clientIp(req) {
  const cfConnecting = req.headers.get('cf-connecting-ip')?.trim();
  if (cfConnecting) return cfConnecting;

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return '';
}
