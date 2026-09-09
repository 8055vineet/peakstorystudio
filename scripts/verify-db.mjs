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

// --- site_publish (Phase 5, 20260908130000_site_publish.sql) ---
//
// The singleton row the request-rebuild Edge Function reads and writes with
// the service role. Browsers only ever read it (admins), so every session
// write must fail at the grant (42501), and content_changed_at must move
// only when a PUBLICLY VISIBLE row changes: a published wedding, never a
// draft. The probe weddings seeded at the top are the only rows mutated,
// except one idempotent no-op on the owner's site_settings row (the value
// is written back unchanged; its updated_at advancing is the PS-047
// trigger doing its job). Running this leaves content_changed_at = now(),
// which the admin treats as "changes waiting" — harmless locally, where no
// deploy hook is configured, and this script refuses non-local targets.
console.log('\nsite_publish checks:');

const publishStamp = async () => {
  const { data } = await service
    .from('site_publish').select('content_changed_at').eq('id', 1).maybeSingle();
  return data?.content_changed_at ?? null;
};
const ms = (iso) => (iso ? new Date(iso).getTime() : NaN);

const { data: publishRow } = await service.from('site_publish').select('id').eq('id', 1).maybeSingle();
check('site_publish singleton row exists', publishRow?.id === 1);

const { error: anonPublishErr } = await anon
  .from('site_publish').update({ last_dispatch_status: 'hacked' }).eq('id', 1);
const { data: adminPublishRead, error: adminPublishReadErr } = await probeAdmin.client
  .from('site_publish').select('id, content_changed_at, last_dispatch_at').eq('id', 1);
check(
  'an admin reads the site_publish row',
  !adminPublishReadErr && Array.isArray(adminPublishRead) && adminPublishRead.length === 1,
  adminPublishReadErr?.message ?? '',
);
const { error: adminPublishErr } = await probeAdmin.client
  .from('site_publish').update({ last_dispatch_status: 'hacked' }).eq('id', 1);
const { data: publishAfter } = await service
  .from('site_publish').select('last_dispatch_status').eq('id', 1).maybeSingle();
check(
  'anon cannot update site_publish',
  anonPublishErr?.code === '42501' && publishAfter?.last_dispatch_status !== 'hacked',
  anonPublishErr ? `code=${anonPublishErr.code}` : 'no error',
);
check(
  'an admin cannot update site_publish',
  adminPublishErr?.code === '42501' && publishAfter?.last_dispatch_status !== 'hacked',
  adminPublishErr ? `code=${adminPublishErr.code}` : 'no error',
);

// Trigger rule, exercised branch by branch with the service role.
const stampStart = await publishStamp();
check('content_changed_at is set after the migration', Boolean(stampStart));

const slugDraftInsert = 'rls-probe-publish-draft-insert';
await service.from('weddings').delete().eq('slug', slugDraftInsert);
await service.from('weddings').insert(
  { slug: slugDraftInsert, title: 'Probe Draft Insert', couple: 'Probe Couple', location: 'Probe', status: 'draft' },
);
const stampAfterDraftInsert = await publishStamp();
check('inserting a draft wedding does not mark content changed', stampAfterDraftInsert === stampStart);

await service.from('weddings').update({ title: 'Probe Draft (edited)' }).eq('slug', slugDraft);
const stampAfterDraftUpdate = await publishStamp();
check('editing a draft wedding does not mark content changed', stampAfterDraftUpdate === stampStart);

await service.from('weddings').delete().eq('slug', slugDraftInsert);
const stampAfterDraftDelete = await publishStamp();
check('deleting a draft wedding does not mark content changed', stampAfterDraftDelete === stampStart);

const { data: pubBefore } = await service
  .from('weddings').select('updated_at').eq('slug', slugPub).single();
await service.from('weddings').update({ title: 'Probe Published (edited)' }).eq('slug', slugPub);
const stampAfterPubUpdate = await publishStamp();
const { data: pubAfter } = await service
  .from('weddings').select('updated_at').eq('slug', slugPub).single();
check(
  'editing a published wedding marks content changed',
  ms(stampAfterPubUpdate) > ms(stampStart),
  `${stampStart} -> ${stampAfterPubUpdate}`,
);
check(
  'weddings.updated_at advances on update (PS-047)',
  ms(pubAfter?.updated_at) > ms(pubBefore?.updated_at),
  `${pubBefore?.updated_at} -> ${pubAfter?.updated_at}`,
);

await service.from('weddings').update({ status: 'published' }).eq('slug', slugDraft);
const stampAfterPublish = await publishStamp();
check(
  'publishing a draft wedding marks content changed',
  ms(stampAfterPublish) > ms(stampAfterPubUpdate),
  `${stampAfterPubUpdate} -> ${stampAfterPublish}`,
);
await service.from('weddings').update({ status: 'draft', title: 'Probe Draft' }).eq('slug', slugDraft);
const stampAfterUnpublish = await publishStamp();
check(
  'unpublishing a wedding marks content changed',
  ms(stampAfterUnpublish) > ms(stampAfterPublish),
  `${stampAfterPublish} -> ${stampAfterUnpublish}`,
);

// A browser session must reach the security-definer trigger function even
// though it cannot call it directly (execute is revoked below the trigger).
await probeAdmin.client.from('weddings').update({ title: 'Probe Published' }).eq('slug', slugPub);
const stampAfterAdminEdit = await publishStamp();
check(
  'an admin session editing a published wedding marks content changed',
  ms(stampAfterAdminEdit) > ms(stampAfterUnpublish),
  `${stampAfterUnpublish} -> ${stampAfterAdminEdit}`,
);

await service.from('weddings').delete().eq('slug', slugPub);
const stampAfterPubDelete = await publishStamp();
check(
  'deleting a published wedding marks content changed',
  ms(stampAfterPubDelete) > ms(stampAfterAdminEdit),
  `${stampAfterAdminEdit} -> ${stampAfterPubDelete}`,
);

const { data: settingsBefore } = await service
  .from('site_settings').select('quote_credit, updated_at').eq('id', 1).single();
await service.from('site_settings').update({ quote_credit: settingsBefore.quote_credit }).eq('id', 1);
const stampAfterSettings = await publishStamp();
const { data: settingsAfter } = await service
  .from('site_settings').select('quote_credit, updated_at').eq('id', 1).single();
check(
  'updating site_settings marks content changed',
  ms(stampAfterSettings) > ms(stampAfterPubDelete),
  `${stampAfterPubDelete} -> ${stampAfterSettings}`,
);
check(
  'site_settings.updated_at advances on update (PS-047)',
  ms(settingsAfter?.updated_at) > ms(settingsBefore?.updated_at)
    && settingsAfter?.quote_credit === settingsBefore?.quote_credit,
  `${settingsBefore?.updated_at} -> ${settingsAfter?.updated_at}`,
);

await removeProbeUsers();

await service.from('weddings').delete().in('slug', [slugPub, slugDraft, slugDraftInsert, 'rls-probe-anon-write']);
await service.from('inquiries').delete().eq('email', inqProbeEmail);

console.log(failures.length ? `\n${failures.length} RLS check(s) FAILED` : '\nall RLS checks passed');
process.exit(failures.length ? 1 : 0);
