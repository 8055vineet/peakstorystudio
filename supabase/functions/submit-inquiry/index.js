// The only write path to public.inquiries.
//
// Anon has no insert privilege on that table (see the Phase 1b RLS migration),
// so this function — holding the service-role key, which bypasses RLS — is the
// single door. Client-side validation is a convenience, not a control; every
// rule is re-checked here.

import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import { validateInquiry } from '../_shared/inquiry-validation.js';
import { verifyTurnstile } from '../_shared/turnstile.js';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// The validator's own limits put a legitimate payload well under 16 KB, so
// 64 KB is generous headroom, not a tight fit.
const MAX_BODY_BYTES = 64 * 1024;

function corsHeaders(requestOrigin) {
  // This controls which origins a BROWSER will let its own JavaScript read
  // the response from — nothing more. It is not a write control: the insert
  // below still runs for a request carrying any Origin header at all (or
  // none), because CORS is enforced by the browser refusing to hand the
  // response to script, not by this server refusing the request. A
  // non-browser client — curl, a script, a bot — ignores CORS entirely and
  // reads the response regardless of what this function sets. The only
  // actual control on who may submit is Task 4's Turnstile captcha check.
  //
  // Unset means local development, where the dev server's origin varies.
  // Phase 4's deploy checklist sets ALLOWED_ORIGINS to the real domain.
  const allowOrigin = allowedOrigins.length === 0
    ? '*'
    : (allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0]);

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(status, body, requestOrigin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' },
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Reads the body up to maxBytes, discarding rather than retaining anything
// once that cap is passed, so memory use is genuinely bounded no matter how
// large the sender claims (or attempts) to send. `await req.text()` would not
// give this guarantee — it buffers the whole body into memory first and only
// lets you measure it afterward, which is exactly the unbounded-memory
// problem this exists to avoid.
//
// Once over the cap this keeps reading (and immediately dropping) whatever
// arrives, rather than cancelling the stream outright. Tried against this
// function directly, cancelling mid-upload left the connection unable to
// deliver the response at all — the runtime logged "error writing a body to
// connection" and the client hung past a minute waiting on a socket that was
// never coming. Draining to completion trades an instant rejection for a
// guaranteed one: memory still never holds more than a chunk beyond the cap,
// and the connection is left in a state where the 413 actually reaches the
// caller instead of the request timing out with no response at all.
async function readBodyWithLimit(req, maxBytes) {
  if (!req.body) {
    return { text: '', tooLarge: false };
  }

  const reader = req.body.getReader();
  const chunks = [];
  let total = 0;
  let tooLarge = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (tooLarge) {
      continue;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      tooLarge = true;
      chunks.length = 0;
      continue;
    }
    chunks.push(value);
  }

  if (tooLarge) {
    return { text: '', tooLarge: true };
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(combined), tooLarge: false };
}

// Reads the body to completion, discarding every chunk, so the connection is
// left fully drained before a response is written on it. See the comment on
// readBodyWithLimit above for why this matters: responding before the body is
// consumed leaves the connection unable to deliver that response at all.
async function drainBody(req) {
  if (!req.body) {
    return;
  }
  const reader = req.body.getReader();
  try {
    for (;;) {
      const { done } = await reader.read();
      if (done) {
        break;
      }
    }
  } catch {
    // The connection is being rejected anyway; nothing more to do if the
    // stream itself errors while draining it.
  }
}

// A human never sees the honeypot field, so any non-empty value in it — of
// any type, not just a string — is a bot filling in every field it can find.
function isHoneypotTripped(website) {
  if (website === undefined || website === null) {
    return false;
  }
  if (typeof website === 'string') {
    return website.trim() !== '';
  }
  return true;
}

function clientIp(req) {
  // x-forwarded-for is a comma-separated chain; the first entry is the client.
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? '';
}

async function hashIp(ip) {
  const salt = Deno.env.get('RATE_LIMIT_SALT') ?? '';
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, origin);
  }

  // Body size guard. This must run before anything reads the body — including
  // Task 4's rate limiting, added later in this same file — so an oversized
  // body can never slip past whatever guard happens to run first.
  //
  // content-length is a cheap fast path, not the control: it can be absent
  // under chunked transfer encoding, or simply wrong. The bounded stream read
  // below is what actually enforces the cap.
  const contentLengthHeader = req.headers.get('content-length');
  const contentLength = contentLengthHeader === null ? NaN : Number(contentLengthHeader);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    // Drain the still-unread body before responding — see drainBody's
    // comment for why cancelling it outright leaves the response unable to
    // reach the caller at all. Nothing here is retained: bytes are read and
    // immediately discarded, so memory stays bounded regardless of size.
    await drainBody(req);
    return json(413, { ok: false, error: 'PAYLOAD_TOO_LARGE' }, origin);
  }

  const body = await readBodyWithLimit(req, MAX_BODY_BYTES);
  if (body.tooLarge) {
    return json(413, { ok: false, error: 'PAYLOAD_TOO_LARGE' }, origin);
  }

  let payload;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return json(400, { ok: false, error: 'MALFORMED_REQUEST' }, origin);
  }

  // Honeypot. Answer 200 rather than an error: a rejection tells the bot what
  // tripped it. The id is deliberately fake — freshly generated per request
  // and matching no row — so the response is indistinguishable from a real
  // success; a fixed sentinel like `id: null` would let a bot tell the trap
  // apart from success just by trying it once and comparing.
  if (isHoneypotTripped(payload?.website)) {
    console.log('submit-inquiry: honeypot tripped, discarding');
    return json(200, { ok: true, id: crypto.randomUUID() }, origin);
  }

  const ip = clientIp(req);

  const captcha = await verifyTurnstile(payload?.turnstileToken, ip, {
    secret: Deno.env.get('TURNSTILE_SECRET_KEY'),
  });
  if (!captcha.ok) {
    if (captcha.reason === 'NOT_CONFIGURED') {
      // Fail closed. An unconfigured captcha must never silently become an
      // open form; Cloudflare's published test keys make local setup free.
      console.error('submit-inquiry: TURNSTILE_SECRET_KEY is not set');
      return json(500, { ok: false, error: 'CAPTCHA_NOT_CONFIGURED' }, origin);
    }
    console.log('submit-inquiry: captcha rejected', captcha.reason);
    return json(403, { ok: false, error: 'CAPTCHA_FAILED' }, origin);
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    // There is no session to persist in a server function handling one
    // request at a time.
    { auth: { persistSession: false } },
  );

  // Fail open. With no readable IP, hashing a constant would drop every
  // visitor into one shared bucket and start turning paying customers away —
  // worse than admitting spam, which Turnstile has already filtered.
  if (ip) {
    const windowMinutes = Number(Deno.env.get('INQUIRY_RATE_WINDOW_MINUTES') ?? '60');
    const maxRequests = Number(Deno.env.get('INQUIRY_RATE_LIMIT') ?? '5');
    const { data: limit, error: limitError } = await db
      .rpc('consume_inquiry_rate_limit', {
        p_ip_hash: await hashIp(ip),
        p_max_requests: Number.isFinite(maxRequests) && maxRequests > 0 ? maxRequests : 5,
        p_window: `${Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : 60} minutes`,
      })
      .single();

    if (limitError) {
      console.error('submit-inquiry: rate limit check failed', limitError.message);
    } else if (limit && limit.allowed === false) {
      return json(
        429,
        { ok: false, error: 'RATE_LIMITED', retryAfterSeconds: limit.retry_after_seconds },
        origin,
      );
    }
  } else {
    console.warn('submit-inquiry: no client IP available, skipping rate limit');
  }

  const { valid, fields, value } = validateInquiry(payload, { today: today() });
  if (!valid) {
    return json(400, { ok: false, error: 'VALIDATION_FAILED', fields }, origin);
  }

  const { data, error } = await db
    .from('inquiries')
    .insert({
      name: value.name,
      email: value.email,
      phone: value.phone,
      wedding_date: value.weddingDate,
      venue: value.venue,
      services: value.services,
      message: value.message,
    })
    .select('id')
    .single();

  if (error) {
    // This is the one path where a lead is genuinely lost, so log what lets the
    // studio follow up by hand: the Postgres code and hint that say what went
    // wrong, and the three fields needed to call the couple back.
    //
    // error.details is deliberately omitted. On a constraint violation Postgres
    // sets it to "Failing row contains (...)" — the entire row, including
    // whatever the couple wrote in the free-text message. The three fields named
    // below are meant to be the privacy boundary of this log, and including
    // details would quietly make that untrue. From Phase 4 these lines go to
    // hosted log storage, so what lands here is what leaves the machine.
    console.error('submit-inquiry: insert failed', {
      code: error.code,
      message: error.message,
      hint: error.hint,
      submission: { name: value.name, email: value.email, phone: value.phone },
    });
    return json(500, { ok: false, error: 'SERVER_ERROR' }, origin);
  }

  return json(200, { ok: true, id: data.id }, origin);
});
