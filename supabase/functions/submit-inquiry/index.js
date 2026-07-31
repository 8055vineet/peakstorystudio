// The only write path to public.inquiries.
//
// Anon has no insert privilege on that table (see the Phase 1b RLS migration),
// so this function — holding the service-role key, which bypasses RLS — is the
// single door. Client-side validation is a convenience, not a control; every
// rule is re-checked here.

import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import { validateInquiry } from '../_shared/inquiry-validation.js';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(requestOrigin) {
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

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, origin);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false, error: 'MALFORMED_REQUEST' }, origin);
  }

  // Honeypot. A human never sees this field, so anything in it is a bot.
  // Answer 200 rather than an error: a rejection tells the bot what tripped it.
  if (typeof payload?.website === 'string' && payload.website.trim() !== '') {
    console.log('submit-inquiry: honeypot tripped, discarding');
    return json(200, { ok: true, id: null }, origin);
  }

  const { valid, fields, value } = validateInquiry(payload, { today: today() });
  if (!valid) {
    return json(400, { ok: false, error: 'VALIDATION_FAILED', fields }, origin);
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  );

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
    // Log the reason for the operator, return a generic code to the browser —
    // database errors can carry schema detail that is not the public's to see.
    console.error('submit-inquiry: insert failed', error.message);
    return json(500, { ok: false, error: 'SERVER_ERROR' }, origin);
  }

  return json(200, { ok: true, id: data.id }, origin);
});
