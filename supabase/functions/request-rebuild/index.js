// Asks Cloudflare Pages to rebuild the site, so a content change made in the
// admin becomes a fresh set of prerendered pages within minutes.
//
// Cloudflare exposes this as a Deploy Hook: a URL that, when POSTed, queues
// a production build. That URL is the ONLY credential involved — there is
// no token, no signature, nothing else to check; anyone holding it can queue
// builds against the project's (finite) build quota for as long as it lives.
// So it is held here, in this function's secrets (CF_DEPLOY_HOOK_URL), never
// in git, never in a VITE_ variable, and never echoed back in a response or
// a log line. The browser only ever learns "dispatched" or not.
//
// Who may trigger it is decided exactly as sign-upload decides who may
// upload: getUser() against Supabase Auth to learn who the token belongs
// to, then a service-role read of profiles.role. A role claimed inside the
// token is never consulted.
//
// The floor rule (see ../_shared/rebuild-floor.js, and spec section 6): if a
// dispatch happened under 90 seconds ago, one more is still sent — a build
// that started before the change could have read stale content, and
// Cloudflare queues the extra one — but never a third inside the window.
// `force: true` (the admin's "Rebuild now" button) skips the floor. State
// lives in the public.site_publish singleton row, written only from here
// with the service role; the browser can read it, never write it.
//
// A missing hook URL is a quiet, expected condition — local development
// never has one — so it answers 200 { ok: false, error: 'NOT_CONFIGURED' }
// rather than a 500, and the admin shows "rebuilds are not configured".

import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import { decideDispatch } from '../_shared/rebuild-floor.js';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// The body is at most `{ "force": true }`. An empty body is also accepted
// (force defaults to false) so the automatic dispatch needs no payload.
const MAX_BODY_BYTES = 1024;

// How long to wait on Cloudflare before recording the attempt as a network
// error. The hook answers in well under a second when it works at all.
const HOOK_TIMEOUT_MS = 10_000;

function corsHeaders(requestOrigin) {
  // Browser read control only, not a write control — see sign-upload's
  // identical corsHeaders for the full reasoning. The actual controls on
  // who may dispatch a build are the JWT check and the admin-role check.
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

function json(status, body, requestOrigin, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    // extraHeaders spread first so a caller can never displace the CORS
    // headers or the content type — same ordering as the other functions.
    headers: {
      ...extraHeaders,
      ...corsHeaders(requestOrigin),
      'Content-Type': 'application/json',
    },
  });
}

// Bounded body read, identical in shape to sign-upload's readBodyWithLimit;
// see submit-inquiry's original for why `await req.text()` does not give the
// same guarantee and why this drains rather than cancelling.
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

// Drains the body so the connection is fully consumed before a rejection is
// written on it — see sign-upload's identical drainBody.
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

// POSTs the Deploy Hook once. Resolves to a short status string that is
// safe to store and show: 'ok', 'http_<status>', or 'network_error'. Never
// throws, and never includes the URL in what it returns or logs.
async function postDeployHook(hookUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOOK_TIMEOUT_MS);
  try {
    const res = await fetch(hookUrl, { method: 'POST', signal: controller.signal });
    // Consume the (tiny) body so the connection is released cleanly.
    await res.text().catch(() => {});
    return res.ok ? 'ok' : `http_${res.status}`;
  } catch (error) {
    console.error('request-rebuild: deploy hook POST failed', error?.name ?? 'Error');
    return 'network_error';
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, origin);
  }

  // Body size guard first, before auth, for the same reason as the other
  // functions: nothing may move ahead of it. content-length is only a fast
  // path; the bounded stream read is the control.
  const contentLengthHeader = req.headers.get('content-length');
  const contentLength = contentLengthHeader === null ? NaN : Number(contentLengthHeader);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    await drainBody(req);
    return json(400, { ok: false, error: 'MALFORMED_REQUEST' }, origin);
  }

  const body = await readBodyWithLimit(req, MAX_BODY_BYTES);
  if (body.tooLarge) {
    return json(400, { ok: false, error: 'MALFORMED_REQUEST' }, origin);
  }

  // An empty body means "no options"; anything present must be a JSON
  // object whose only recognised field is a boolean `force`.
  let payload = {};
  if (body.text.trim() !== '') {
    try {
      payload = JSON.parse(body.text);
    } catch {
      return json(400, { ok: false, error: 'MALFORMED_REQUEST' }, origin);
    }
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return json(400, { ok: false, error: 'MALFORMED_REQUEST' }, origin);
  }
  if (payload.force !== undefined && typeof payload.force !== 'boolean') {
    return json(400, { ok: false, error: 'MALFORMED_REQUEST' }, origin);
  }
  const force = payload.force === true;

  // WHO is calling — verified against Supabase Auth from the caller's own
  // token, exactly as sign-upload does. Missing, malformed, expired, and
  // rejected tokens all resolve to the same UNAUTHENTICATED response.
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader) {
    return json(401, { ok: false, error: 'UNAUTHENTICATED' }, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return json(401, { ok: false, error: 'UNAUTHENTICATED' }, origin);
  }

  // WHAT they may do — read from profiles with the service-role key,
  // bypassing RLS, never from a claim inside the token.
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('role')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('request-rebuild: profile lookup failed', profileError.message);
    return json(403, { ok: false, error: 'FORBIDDEN' }, origin);
  }

  // No profiles row and a non-admin role are the same outcome: FORBIDDEN.
  if (profile?.role !== 'admin') {
    return json(403, { ok: false, error: 'FORBIDDEN' }, origin);
  }

  // Not configured is a quiet, expected state (every local stack), reported
  // as ok:false at 200 so the admin can say so without treating it as an
  // outage. Checked after the auth gates so an anonymous caller cannot
  // probe whether production has a hook set.
  const hookUrl = (Deno.env.get('CF_DEPLOY_HOOK_URL') ?? '').trim();
  if (hookUrl === '') {
    return json(200, { ok: false, error: 'NOT_CONFIGURED' }, origin);
  }

  const { data: state, error: stateError } = await db
    .from('site_publish')
    .select('last_dispatch_at, followup_sent, dispatch_count')
    .eq('id', 1)
    .maybeSingle();

  if (stateError) {
    console.error('request-rebuild: site_publish read failed', stateError.message);
    return json(500, { ok: false, error: 'STATE_MISSING' }, origin);
  }
  if (!state) {
    console.error('request-rebuild: site_publish row id=1 is missing');
    return json(500, { ok: false, error: 'STATE_MISSING' }, origin);
  }

  const decision = decideDispatch({
    now: Date.now(),
    lastDispatchAt: state.last_dispatch_at,
    followupSent: state.followup_sent === true,
    force,
  });

  if (!decision.dispatch) {
    return json(200, { ok: true, dispatched: false, reason: decision.reason }, origin);
  }

  const status = await postDeployHook(hookUrl);

  // Only a hook that answered 2xx counts as a dispatch: last_dispatch_at is
  // what the admin compares content_changed_at against, so stamping it on a
  // failed POST would turn a lost build into a permanent "rebuild requested"
  // with no retry. A failure records only its status; the row stays
  // "waiting", the admin shows the failure, and the next quiet window
  // retries. (A Cloudflare 5xx may still have queued the build; the follow-up
  // rule tolerates that duplicate.)
  const dispatched = status === 'ok';
  const { error: updateError } = await db
    .from('site_publish')
    .update(dispatched
      ? {
        last_dispatch_at: new Date().toISOString(),
        last_dispatch_status: status,
        dispatch_count: (state.dispatch_count ?? 0) + 1,
        followup_sent: decision.followupSent,
      }
      : { last_dispatch_status: status })
    .eq('id', 1);

  if (updateError) {
    // The build was already requested; failing to note it is worth a log
    // line, not a failed response.
    console.error('request-rebuild: site_publish update failed', updateError.message);
  }

  return json(200, {
    ok: true,
    dispatched: status === 'ok',
    reason: decision.reason,
    status,
  }, origin);
});
