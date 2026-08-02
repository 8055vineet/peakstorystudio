#!/usr/bin/env node
// End-to-end gate for the inquiry pipeline.
//
// Posts to the running submit-inquiry function and asserts against Postgres
// directly, because a 200 from the function is not evidence that a row landed.
// Requires the local stack (npm run db:start) and the function server
// (npm run db:functions) to be running.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error(
    'Missing credentials. supabase status names them API_URL/ANON_KEY/SERVICE_ROLE_KEY;\n' +
    'this script reads SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY. Map them:\n' +
    '  eval "$(supabase status -o env | sed \'s/^/export /\')"\n' +
    '  export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"',
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const endpoint = `${url}/functions/v1/submit-inquiry`;
const probeEmail = 'verify-inquiry-probe@example.invalid';

const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

function payload(overrides = {}) {
  return {
    name: 'Verify Probe',
    email: probeEmail,
    phone: '+91 98200 00000',
    weddingDate: '2027-02-14',
    venue: 'Verification Venue',
    services: ['Cinematic Film'],
    message: 'Automated end-to-end probe.',
    website: '',
    turnstileToken: 'verify-probe',
    ...overrides,
  };
}

async function post(body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  return { status: response.status, body: parsed };
}

async function clean() {
  await admin.from('inquiries').delete().eq('email', probeEmail);
  await admin.from('inquiries').delete().eq('email', `bot-${probeEmail}`);
  await admin.from('inquiry_rate_limits').delete().neq('ip_hash', '');
}

async function main() {
  console.log('verify:inquiry — end-to-end check of the booking pipeline\n');

  try {
    await fetch(endpoint, { method: 'OPTIONS' });
  } catch {
    console.error(`Cannot reach ${endpoint}. Is "npm run db:functions" running?`);
    process.exit(1);
  }

  await clean();

  console.log('a valid inquiry');
  const stored = await post(payload());
  check('returns HTTP 200', stored.status === 200, `got ${stored.status}`);
  check('reports ok with an id', Boolean(stored.body?.ok && stored.body?.id));

  const { data: rows, error } = await admin
    .from('inquiries')
    .select('id, name, email, phone, wedding_date, venue, services, message, status, notification_status')
    .eq('email', probeEmail);

  check('reached Postgres as exactly one row', !error && rows?.length === 1, error?.message ?? `${rows?.length} rows`);

  const row = rows?.[0];
  if (row) {
    // The honeypot path deliberately answers with a freshly generated UUID
    // matching no row, so "returned an id" is not on its own evidence that
    // the id names anything. Tie the response to the row it claims to be.
    check('returned the id of the row it actually stored', stored.body?.id === row.id,
      `response ${stored.body?.id} vs row ${row.id}`);
    check('stored the name', row.name === 'Verify Probe', row.name);
    check('stored the phone', row.phone === '+91 98200 00000', row.phone);
    check('stored the wedding date without a timezone shift', row.wedding_date === '2027-02-14', row.wedding_date);
    check('stored the venue', row.venue === 'Verification Venue', row.venue);
    check('stored the services array', JSON.stringify(row.services) === JSON.stringify(['Cinematic Film']), JSON.stringify(row.services));
    check('defaulted status to new', row.status === 'new', row.status);
    check(
      'recorded a notification outcome',
      ['sent', 'failed', 'skipped'].includes(row.notification_status),
      row.notification_status,
    );
  }

  console.log('\nan invalid inquiry');
  const invalid = await post(payload({ email: 'not-an-email', phone: '' }));
  check('returns HTTP 400', invalid.status === 400, `got ${invalid.status}`);
  check('names VALIDATION_FAILED', invalid.body?.error === 'VALIDATION_FAILED');
  check('reports the offending fields', Boolean(invalid.body?.fields?.email && invalid.body?.fields?.phone));

  console.log('\na bot filling the honeypot');
  const bot = await post(payload({ email: `bot-${probeEmail}`, website: 'http://spam.example' }));
  check('answers 200 so the bot learns nothing', bot.status === 200);
  // The response is deliberately indistinguishable from a real success — the
  // id is a freshly generated UUID matching no row, because a fixed sentinel
  // would let a bot identify the trap by trying it once. So the only way to
  // check this is to ask the database.
  check('returns a success-shaped body', bot.body?.ok === true && Boolean(bot.body?.id));
  const { count } = await admin
    .from('inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('email', `bot-${probeEmail}`);
  check('stored nothing despite answering 200', count === 0, `${count} rows`);

  console.log('\na body larger than the cap');
  const oversized = await post(payload({ message: 'x'.repeat(70 * 1024) }));
  check('returns HTTP 413', oversized.status === 413, `got ${oversized.status}`);
  check('names PAYLOAD_TOO_LARGE', oversized.body?.error === 'PAYLOAD_TOO_LARGE');

  console.log('\nrepeated submissions');
  await admin.from('inquiry_rate_limits').delete().neq('ip_hash', '');
  let limited = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await post(payload());
    if (response.status === 429) {
      limited = response;
      break;
    }
  }
  check('eventually returns HTTP 429', limited !== null);
  check('names RATE_LIMITED', limited?.body?.error === 'RATE_LIMITED');
  check(
    'tells the caller when to retry',
    Number.isFinite(limited?.body?.retryAfterSeconds) && limited.body.retryAfterSeconds > 0,
    String(limited?.body?.retryAfterSeconds),
  );

  await clean();

  console.log('');
  if (failures.length > 0) {
    console.error(`verify:inquiry FAILED — ${failures.length} check(s): ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('verify:inquiry passed — a booking inquiry reaches the database.');
}

main().catch(async (error) => {
  console.error('verify:inquiry crashed:', error.message);
  await clean().catch(() => {});
  process.exit(1);
});
