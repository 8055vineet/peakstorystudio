// The only code path that may create or remove admin accounts.
//
// Same auth skeleton as sign-upload and delete-media — WHO from Supabase
// Auth (getUser on the caller's own token), WHAT from profiles read with
// the service-role key — but the gate here is stricter: `is_owner`, not
// `role`. An admin the owner created can manage every piece of content and
// still gets 403 from every action in this file. That split is the entire
// design: content power is delegable, the team itself is not.
//
// Public signups stay disabled platform-wide (enable_signup = false), so
// accounts exist only when this function — or the one-time seed script —
// creates them deliberately. Created admins are email-preconfirmed: they
// exist to be handed to a colleague, not to prove mailbox ownership.

import { createClient } from 'npm:@supabase/supabase-js@2.111.0';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// action + email + password — nothing legitimate approaches this.
const MAX_BODY_BYTES = 4 * 1024;

// Same permissive shape the inquiry validator uses: real validation of an
// address is delivering to it; this only rejects the obviously-not-an-email.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsHeaders(requestOrigin) {
  // Browser-read control only — the actual controls are the JWT check and
  // the is_owner check below. See sign-upload's identical function.
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
    headers: {
      ...extraHeaders,
      ...corsHeaders(requestOrigin),
      'Content-Type': 'application/json',
    },
  });
}

// Bounded body read; identical in shape and rationale to sign-upload's.
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

// Every admin profile joined to its auth email, owner first. Uses the
// per-id admin lookup rather than listUsers so the result set is exactly
// the profiles table's view of the team, never capped by a page size.
async function listMembers(db) {
  const { data: profiles, error } = await db
    .from('profiles')
    .select('user_id, role, display_name, is_owner, created_at')
    .eq('role', 'admin')
    .order('is_owner', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`profiles list failed: ${error.message}`);
  }

  const members = [];
  for (const profile of profiles ?? []) {
    let email = null;
    const { data: userData, error: userError } = await db.auth.admin.getUserById(profile.user_id);
    if (userError) {
      // An auth row missing for a profile is a data problem worth seeing in
      // the list, not a reason the whole console fails to load.
      console.error(`manage-team: no auth user for profile ${profile.user_id}: ${userError.message}`);
    } else {
      email = userData?.user?.email ?? null;
    }
    members.push({
      userId: profile.user_id,
      email,
      displayName: profile.display_name,
      isOwner: profile.is_owner === true,
      createdAt: profile.created_at,
    });
  }
  return members;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, origin);
  }

  const body = await readBodyWithLimit(req, MAX_BODY_BYTES);
  if (body.tooLarge) {
    return json(400, { ok: false, error: 'MALFORMED_REQUEST' }, origin);
  }

  let payload;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return json(400, { ok: false, error: 'MALFORMED_REQUEST' }, origin);
  }

  const action = payload?.action;
  if (!['list', 'create', 'remove'].includes(action)) {
    return json(400, { ok: false, error: 'MALFORMED_REQUEST' }, origin);
  }

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

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: callerProfile, error: profileError } = await db
    .from('profiles')
    .select('role, is_owner')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('manage-team: profile lookup failed', profileError.message);
    return json(403, { ok: false, error: 'FORBIDDEN' }, origin);
  }

  // The stricter gate: a full admin who is not the owner is FORBIDDEN here,
  // by design — see the module comment.
  if (callerProfile?.role !== 'admin' || callerProfile?.is_owner !== true) {
    return json(403, { ok: false, error: 'FORBIDDEN' }, origin);
  }

  try {
    if (action === 'list') {
      return json(200, { ok: true, members: await listMembers(db) }, origin);
    }

    if (action === 'create') {
      const email = String(payload?.email ?? '').trim().toLowerCase();
      const password = String(payload?.password ?? '');
      if (!EMAIL_PATTERN.test(email)) {
        return json(400, { ok: false, error: 'INVALID_EMAIL' }, origin);
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        return json(400, { ok: false, error: 'PASSWORD_TOO_SHORT', minLength: MIN_PASSWORD_LENGTH }, origin);
      }

      const { data: created, error: createError } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) {
        // GoTrue's duplicate-address failure — the one create error a caller
        // can act on — gets its own code; everything else is a server error.
        const message = String(createError.message ?? '').toLowerCase();
        if (createError.status === 422 || message.includes('already') || message.includes('registered')) {
          return json(409, { ok: false, error: 'EMAIL_EXISTS' }, origin);
        }
        console.error('manage-team: createUser failed', createError.message);
        return json(500, { ok: false, error: 'SERVER_ERROR' }, origin);
      }

      const { error: insertError } = await db
        .from('profiles')
        .upsert({ user_id: created.user.id, role: 'admin', is_owner: false }, { onConflict: 'user_id' });
      if (insertError) {
        // The auth account exists but carries no admin role — remove it
        // rather than leave a half-created login lying around.
        console.error('manage-team: profile insert failed, rolling back auth user', insertError.message);
        await db.auth.admin.deleteUser(created.user.id).catch(() => {});
        return json(500, { ok: false, error: 'SERVER_ERROR' }, origin);
      }

      return json(200, {
        ok: true,
        member: {
          userId: created.user.id, email, displayName: null, isOwner: false, createdAt: created.user.created_at,
        },
      }, origin);
    }

    // action === 'remove'
    const userId = String(payload?.userId ?? '');
    if (!UUID_PATTERN.test(userId)) {
      return json(400, { ok: false, error: 'MALFORMED_REQUEST' }, origin);
    }

    const { data: target, error: targetError } = await db
      .from('profiles')
      .select('user_id, is_owner')
      .eq('user_id', userId)
      .maybeSingle();
    if (targetError) {
      console.error('manage-team: target lookup failed', targetError.message);
      return json(500, { ok: false, error: 'SERVER_ERROR' }, origin);
    }
    if (!target) {
      return json(404, { ok: false, error: 'NOT_FOUND' }, origin);
    }
    // Refusing the owner also refuses self-removal — the caller IS the
    // owner — so the studio can never lock itself out of team management.
    if (target.is_owner === true) {
      return json(403, { ok: false, error: 'CANNOT_REMOVE_OWNER' }, origin);
    }

    const { error: deleteError } = await db.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('manage-team: deleteUser failed', deleteError.message);
      return json(500, { ok: false, error: 'SERVER_ERROR' }, origin);
    }
    // profiles row goes with the auth user (on delete cascade).
    return json(200, { ok: true }, origin);
  } catch (err) {
    console.error('manage-team: unexpected failure', err?.message);
    return json(500, { ok: false, error: 'SERVER_ERROR' }, origin);
  }
});
