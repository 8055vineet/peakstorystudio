#!/usr/bin/env node
// Proves the RLS policies actually behave. Run: npm run db:verify
//
// Not part of `npm test`: this needs a running local Supabase, and CI has none.
// Reads credentials from the environment; `supabase status -o env` supplies them.

import { createClient } from '@supabase/supabase-js';

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

await service.from('weddings').delete().in('slug', [slugPub, slugDraft, 'rls-probe-anon-write']);
await service.from('inquiries').delete().eq('email', inqProbeEmail);

console.log(failures.length ? `\n${failures.length} RLS check(s) FAILED` : '\nall RLS checks passed');
process.exit(failures.length ? 1 : 0);
