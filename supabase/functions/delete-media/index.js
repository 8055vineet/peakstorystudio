// The authorisation point for permanently deleting a photograph.
//
// Deletion is the one operation the admin app performs that cannot be
// undone, so it runs server-side behind the same two checks sign-upload
// established: WHO is calling comes from Supabase Auth (getUser on the
// caller's token, never a claim inside it), and WHAT they may do comes from
// profiles.role read with the service-role key. The browser never holds a
// storage credential and is never handed one — this function performs the
// storage DELETE itself.
//
// Referential integrity is the guard against deleting a photograph
// something still renders: every consumer of a media row references it by
// foreign key (weddings.cover_media_id, wedding_photos.media_id,
// gallery_photos.media_id, films.thumbnail_media_id,
// collection_items.media_id, and the four site_settings slots), and none of
// those constraints cascade. The row delete below is attempted FIRST and
// Postgres itself refuses it with 23503 while any reference exists — this
// function just translates that refusal into 409 IN_USE. No hand-rolled
// usage query could be more complete than the constraints are.
//
// Order matters: row first, object second. A deleted row whose object
// lingers is an orphaned ~400 KB nobody can reach (the same accepted-debt
// family as PS-029, docs/KNOWN-ISSUES.md); a deleted object whose row
// remains would be a photograph the site still tries to render. The first
// failure mode is cheap, the second is visible — so the row leads.
//
// Not every media row has a storage object at all: seeded/static rows hold
// an absolute URL or a site-relative `/images/...` path served by the web
// host, and only bucket keys (`uploads/<uuid>.<ext>`) name something this
// function can delete from storage. `objectDeleted` in the response is
// true (object removed), false (removal attempted and failed — logged,
// orphan accepted), or null (there was no object to remove).

import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import { deleteObject } from '../_shared/s3-presign.js';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// The body is one UUID — nothing legitimate approaches this.
const MAX_BODY_BYTES = 2 * 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A storage object exists only for bucket keys. Absolute URLs (seeded rows)
// and site-relative paths (the shipped static photographs) are served by
// the web host — deleting their media row is the whole deletion.
function isBucketKey(storagePath) {
  return typeof storagePath === 'string'
    && storagePath !== ''
    && !storagePath.startsWith('/')
    && !/^https?:\/\//i.test(storagePath);
}

function corsHeaders(requestOrigin) {
  // Browser-read control only, not an access control — see sign-upload's
  // identical function for the full explanation. The actual controls here
  // are the JWT check and the admin-role check below.
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

  const { mediaId } = payload ?? {};
  if (typeof mediaId !== 'string' || !UUID_PATTERN.test(mediaId)) {
    return json(400, { ok: false, error: 'MALFORMED_REQUEST' }, origin);
  }

  // WHO — same contract as sign-upload: no header, invalid token, and
  // rejected token all collapse to one indistinguishable UNAUTHENTICATED.
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

  // WHAT — role from the database via the service-role key, never from the
  // token. No profiles row and a non-admin role are the same FORBIDDEN.
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('role')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('delete-media: profile lookup failed', profileError.message);
    return json(403, { ok: false, error: 'FORBIDDEN' }, origin);
  }

  if (profile?.role !== 'admin') {
    return json(403, { ok: false, error: 'FORBIDDEN' }, origin);
  }

  // Row first. Postgres enforces "still in use" through the foreign keys —
  // 23503 here IS the usage check (see the module comment). The returned
  // row doubles as the existence check and carries the storage path the
  // object step needs.
  const { data: deleted, error: deleteError } = await db
    .from('media')
    .delete()
    .eq('id', mediaId)
    .select('storage_path')
    .maybeSingle();

  if (deleteError) {
    if (deleteError.code === '23503') {
      return json(409, { ok: false, error: 'IN_USE' }, origin);
    }
    console.error('delete-media: row delete failed', deleteError.message);
    return json(500, { ok: false, error: 'SERVER_ERROR' }, origin);
  }

  if (!deleted) {
    return json(404, { ok: false, error: 'NOT_FOUND' }, origin);
  }

  // Object second, best-effort. The row is gone either way — a failure here
  // orphans one unreachable object (logged, accepted) rather than failing a
  // deletion the admin has every right to consider done.
  if (!isBucketKey(deleted.storage_path)) {
    return json(200, { ok: true, objectDeleted: null }, origin);
  }

  // S3_ENDPOINT is documented as the BROWSER-reachable storage host (see
  // functions/.env.example) because sign-upload only ever embeds it in
  // presigned URLs. This function is different: it dials storage itself,
  // from inside the edge runtime — where the local stack's 127.0.0.1 means
  // the container, not the machine. S3_INTERNAL_ENDPOINT exists for that
  // split, and its local value is host.docker.internal:54321 (out to the
  // machine, back in through Kong) rather than any in-network shortcut,
  // because the local storage API validates SigV4 against the host KONG
  // says the client asked for — verified live: both kong:8000 and the
  // storage container directly come back SignatureDoesNotMatch, and only
  // the through-Kong host validates. Against R2 the public endpoint is
  // dialable from anywhere, so this stays unset and S3_ENDPOINT serves both.
  const endpoint = Deno.env.get('S3_INTERNAL_ENDPOINT') || Deno.env.get('S3_ENDPOINT');
  const region = Deno.env.get('S3_REGION');
  const bucket = Deno.env.get('S3_BUCKET');
  const accessKeyId = Deno.env.get('S3_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('S3_SECRET_ACCESS_KEY');

  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    console.error('delete-media: S3 configuration is incomplete; media row deleted, object orphaned');
    return json(200, { ok: true, objectDeleted: false }, origin);
  }

  try {
    await deleteObject({
      endpoint,
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      key: deleted.storage_path,
    });
  } catch (err) {
    console.error('delete-media: object delete failed; media row deleted, object orphaned', err?.message);
    return json(200, { ok: true, objectDeleted: false }, origin);
  }

  return json(200, { ok: true, objectDeleted: true }, origin);
});
