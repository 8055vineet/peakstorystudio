#!/usr/bin/env node
// Proves the RLS policies actually behave. Run: npm run db:verify
//
// Not part of `npm test`: this needs a running local Supabase, and CI has none.
// Reads credentials from the environment; `supabase status -o env` supplies them.

import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { exitUnlessLocalTarget } from './lib/assert-local-target.mjs';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Try:');
  console.error(`  eval "$(supabase status -o env | sed 's/^/export /')"`);
  console.error(
    '  export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"'
  );
  process.exit(2);
}

// Creates and removes throwaway auth accounts and content rows. Local stack
// only unless ALLOW_REMOTE_DB=yes — see scripts/lib/assert-local-target.mjs.
exitUnlessLocalTarget('db:verify');

const anon = createClient(URL, ANON);
const service = createClient(URL, SERVICE, { auth: { persistSession: false } });

const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name} ${detail}`); failures.push(name); }
};

console.log('RLS checks:');

// Seed two weddings the test controls: one published, one draft.
const slugPub = 'rls-probe-published';
const slugDraft = 'rls-probe-draft';
await service.from('weddings').delete().in('slug', [slugPub, slugDraft]);
const { error: seedErr } = await service.from('weddings').insert([
  { slug: slugPub, title: 'Probe Published', couple: 'Probe Couple', location: 'Probe', status: 'published' },
  { slug: slugDraft, title: 'Probe Draft', couple: 'Probe Couple', location: 'Probe', status: 'draft' },
]);
if (seedErr) { console.error('could not seed probe rows:', seedErr.message); process.exit(2); }

const { data: pub } = await anon.from('weddings').select('slug').eq('slug', slugPub);
check('anon reads published weddings', Array.isArray(pub) && pub.length === 1);

const { data: draft } = await anon.from('weddings').select('slug').eq('slug', slugDraft);
check('anon cannot read draft weddings', Array.isArray(draft) && draft.length === 0);

const { error: insErr } = await anon
  .from('weddings')
  .insert({ slug: 'rls-probe-anon-write', title: 'x', couple: 'x', location: 'x' });
check('anon cannot insert weddings', Boolean(insErr));

const { error: updErr } = await anon.from('weddings').update({ title: 'hacked' }).eq('slug', slugPub);
const { data: afterUpd } = await service.from('weddings').select('title').eq('slug', slugPub).single();
check('anon cannot update weddings', Boolean(updErr) || afterUpd.title === 'Probe Published');

// Seed a probe inquiry the test controls. Without this, "anon cannot read
// inquiries" would be vacuously true whenever the table happens to be empty,
// regardless of what the policy says — the same class of bug the weddings
// checks above avoid by seeding first.
const inqProbeEmail = 'rls-probe@example.com';
await service.from('inquiries').delete().eq('email', inqProbeEmail);
const { error: inqSeedErr } = await service
  .from('inquiries')
  .insert({ name: 'RLS Probe', email: inqProbeEmail, phone: '000-000-0000' });
if (inqSeedErr) { console.error('could not seed probe inquiry:', inqSeedErr.message); process.exit(2); }

// Assert positively that the row exists and service-role can see it, so a
// silent seeding failure can't masquerade as the anon check below passing.
const { data: inqServiceRead } = await service.from('inquiries').select('id').eq('email', inqProbeEmail);
check('service role can read the seeded inquiry', Array.isArray(inqServiceRead) && inqServiceRead.length === 1);

const { data: inqRead, error: inqReadErr } = await anon.from('inquiries').select('id').eq('email', inqProbeEmail);
check('anon cannot read inquiries', Boolean(inqReadErr) || (Array.isArray(inqRead) && inqRead.length === 0));

const { error: inqInsErr } = await anon
  .from('inquiries')
  .insert({ name: 'x', email: 'x@example.com', phone: '0' });
check('anon cannot insert inquiries', Boolean(inqInsErr));

// profiles: the row that says who is an admin and who is the owner must be
// unwritable from ANY browser session, an admin's own included. Before
// 20260907120000_profiles_write_lockdown.sql an admin could PATCH their own
// row to is_owner = true and pass manage-team's owner-only gate. The two
// probe accounts are created with the service-role key — the only way to
// mint one — and removed again below. Passwords are random per run, so a
// leftover from a crashed run is never a known admin login.
const PROBE_ADMIN_EMAIL = 'rls-probe-admin@example.test';
const PROBE_CLIENT_EMAIL = 'rls-probe-client@example.test';

async function removeProbeUsers() {
  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  for (const user of data.users) {
    if ([PROBE_ADMIN_EMAIL, PROBE_CLIENT_EMAIL].includes(user.email)) {
      // Cascades the profiles row (on delete cascade in the schema).
      await service.auth.admin.deleteUser(user.id);
    }
  }
}

// Creates the auth user and its profiles row, then signs in with the anon
// key, so the returned client carries exactly the session a browser would.
async function signInProbeUser(email, role) {
  const password = randomBytes(24).toString('base64url');
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr) throw new Error(`createUser ${email} failed: ${createErr.message}`);
  const { error: profileErr } = await service
    .from('profiles')
    .upsert({ user_id: created.user.id, role }, { onConflict: 'user_id' });
  if (profileErr) throw new Error(`profiles upsert for ${email} failed: ${profileErr.message}`);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`sign-in as ${email} failed: ${signInErr.message}`);
  return { client, userId: created.user.id };
}

await removeProbeUsers();
const probeAdmin = await signInProbeUser(PROBE_ADMIN_EMAIL, 'admin');
const probeClient = await signInProbeUser(PROBE_CLIENT_EMAIL, 'client');

const { error: anonProfileErr } = await anon
  .from('profiles').update({ display_name: 'hacked' }).eq('user_id', probeAdmin.userId);
check('anon cannot update profiles', Boolean(anonProfileErr));

const { error: ownerErr } = await probeAdmin.client
  .from('profiles').update({ is_owner: true }).eq('user_id', probeAdmin.userId);
const { data: adminRow } = await service
  .from('profiles').select('is_owner').eq('user_id', probeAdmin.userId).single();
check(
  'an admin cannot make themselves owner',
  Boolean(ownerErr) && adminRow?.is_owner === false,
  ownerErr ? '' : `is_owner=${adminRow?.is_owner}`,
);

const { error: adminDeleteErr } = await probeAdmin.client
  .from('profiles').delete().eq('user_id', probeClient.userId);
const { count: clientRowCount } = await service
  .from('profiles').select('user_id', { count: 'exact', head: true }).eq('user_id', probeClient.userId);
check('an admin cannot delete another profile', Boolean(adminDeleteErr) && clientRowCount === 1);

const { data: adminReads } = await probeAdmin.client
  .from('profiles').select('user_id').in('user_id', [probeAdmin.userId, probeClient.userId]);
check('an admin still reads every profile', Array.isArray(adminReads) && adminReads.length === 2);

const { error: escalateErr } = await probeClient.client
  .from('profiles').update({ role: 'admin' }).eq('user_id', probeClient.userId);
const { data: clientRow } = await service
  .from('profiles').select('role').eq('user_id', probeClient.userId).single();
check('a client cannot promote themselves to admin', Boolean(escalateErr) && clientRow?.role === 'client');

const { data: clientReads } = await probeClient.client.from('profiles').select('user_id');
check(
  'a client reads only their own profile',
  Array.isArray(clientReads) && clientReads.length === 1 && clientReads[0].user_id === probeClient.userId,
);

await removeProbeUsers();

await service.from('weddings').delete().in('slug', [slugPub, slugDraft, 'rls-probe-anon-write']);
await service.from('inquiries').delete().eq('email', inqProbeEmail);

console.log(failures.length ? `\n${failures.length} RLS check(s) FAILED` : '\nall RLS checks passed');
process.exit(failures.length ? 1 : 0);
