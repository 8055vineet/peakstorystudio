#!/usr/bin/env node
// End-to-end gate for the admin publishing pipeline.
//
// Seeds a throwaway admin, signs in with the anon key, calls sign-upload and
// PUTs a generated PNG straight to storage, records a `media` row, creates a
// wedding, attaches the photo, and publishes it — then reads the wedding
// back through src/lib/queries/weddings.js, the exact module the public
// site calls, and asserts against Postgres that every field survived
// intact, including that the date did not shift. A published-row check in
// Postgres only proves the admin wrote it; reading it back the way the site
// does is the only thing that proves the site can see it.
//
// Runs under vite-node, not plain node. src/lib/queries/weddings.js imports
// src/lib/supabase.js, which reads import.meta.env.VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY — a Vite-only construct plain node has no notion
// of at all (confirmed: `node --input-type=module -e
// "import('./src/lib/supabase.js')"` throws "Cannot read properties of
// undefined (reading 'VITE_SUPABASE_URL')"). vite-node is the same runtime
// `vitest` already uses to run this project's component tests; using it
// here is what lets this script import the real query module instead of
// hand-rolling a second copy of its query shape that could silently drift
// from the one the site actually calls.
//
// Requires the local stack (npm run db:start) and its Edge Functions
// serving. Locally `supabase start` already serves them; CI's admin-e2e job
// also runs `npm run db:functions` explicitly, same as inquiry-e2e does.
import { createClient } from '@supabase/supabase-js';

// src/lib/supabase.js only ever reads the VITE_-prefixed names. Map them
// from the plain names this script (like verify-inquiry.mjs and
// seed-admin.mjs) reads below, so a caller sets credentials once. This must
// run before the dynamic import further down — that import is what actually
// asks vite-node to resolve import.meta.env for the module tree it pulls in.
process.env.VITE_SUPABASE_URL ??= process.env.SUPABASE_URL;
process.env.VITE_SUPABASE_ANON_KEY ??= process.env.SUPABASE_ANON_KEY;

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

// Imported for real, not reimplemented — see the module comment above.
const { getWeddingBySlug } = await import('../src/lib/queries/weddings.js');

// VITE_MEDIA_BASE_URL is what turns a real upload's bucket-relative
// storage_path (e.g. `uploads/<uuid>.png`) into a URL src/lib/mediaUrl.js's
// publicMediaUrl() actually resolves — see that file and PS-033 in
// docs/KNOWN-ISSUES.md. Reimplemented here (rather than importing mediaUrl())
// so the expected value is computed independently of the function under
// test — asserting `getWeddingBySlug`'s output against the very function it
// calls internally would prove nothing if that call were ever removed.
const mediaBaseUrl = process.env.VITE_MEDIA_BASE_URL;
function expectedMediaUrl(storagePath) {
  if (!mediaBaseUrl || !storagePath) return null;
  return `${mediaBaseUrl.replace(/\/+$/, '')}/${String(storagePath).replace(/^\/+/, '')}`;
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const signUploadEndpoint = `${url}/functions/v1/sign-upload`;

const PROBE_EMAIL = 'verify-admin-probe@example.test';
const PROBE_PASSWORD = 'Verify-Admin-Probe-Pw!2026';
const PROBE_TITLE = 'Verify Admin E2E Probe';
const PROBE_ALT_TEXT = 'verify-admin-probe photograph';
const PROBE_COUPLE = 'Verify & Admin';
const PROBE_LOCATION = 'Verification Venue';
const PROBE_SUMMARY = 'Automated end-to-end probe wedding.';
const PROBE_EVENT_DATE = '2027-05-20';
const PROBE_VIDEO_URL = 'https://videos.example.invalid/verify-admin-probe.mp4';
const PROBE_TAGS = ['verify-admin-e2e'];
const PROBE_INQUIRY_EMAIL = 'verify-admin-inquiry-control@example.invalid';

// A minimal, valid 1x1 PNG (68 bytes) — confirmed with `file(1)` to decode
// as real PNG image data. sign-upload never inspects file bytes, only the
// declared contentType/byteSize, but the object actually PUT to storage
// should still be a real image, not an arbitrary string standing in for one.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

// Mirrors src/lib/queries/media.js's readErrorBody: supabase-js wraps a
// non-2xx function response as FunctionsHttpError and hangs the original
// Response off .context; a network failure carries no context at all.
async function readFunctionErrorBody(error) {
  try {
    return await error?.context?.json?.();
  } catch {
    return null;
  }
}

async function findUserIdByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  return data.users.find((u) => u.email === email)?.id ?? null;
}

// Cleans up every row and object this script can create, run before AND
// after main() — before, so a crashed prior run's leftovers can't taint
// this run's checks; after, so a clean run leaves nothing behind either.
async function clean() {
  const { data: weddings } = await admin.from('weddings').select('id').eq('title', PROBE_TITLE);
  for (const wedding of weddings ?? []) {
    const { data: photos } = await admin
      .from('wedding_photos')
      .select('media_id')
      .eq('wedding_id', wedding.id);
    for (const photo of photos ?? []) {
      const { data: media } = await admin
        .from('media')
        .select('storage_path')
        .eq('id', photo.media_id)
        .maybeSingle();
      if (media?.storage_path) {
        await admin.storage.from('media').remove([media.storage_path]);
      }
      await admin.from('media').delete().eq('id', photo.media_id);
    }
    // Cascades wedding_photos (on delete cascade in the schema).
    await admin.from('weddings').delete().eq('id', wedding.id);
  }

  // Orphaned probe media — e.g. a prior run that uploaded and recorded the
  // media row but crashed before a wedding existed to attach it to.
  const { data: orphanMedia } = await admin
    .from('media')
    .select('id, storage_path')
    .eq('alt_text', PROBE_ALT_TEXT);
  for (const media of orphanMedia ?? []) {
    if (media.storage_path) {
      await admin.storage.from('media').remove([media.storage_path]);
    }
    await admin.from('media').delete().eq('id', media.id);
  }

  await admin.from('inquiries').delete().eq('email', PROBE_INQUIRY_EMAIL);

  const userId = await findUserIdByEmail(PROBE_EMAIL);
  if (userId) {
    // Cascades the profiles row (on delete cascade in the schema).
    await admin.auth.admin.deleteUser(userId);
  }
}

async function main() {
  console.log('verify:admin — end-to-end check of the admin publishing pipeline\n');

  // Checked as its own assertion, not just implied by the coverImage/
  // fullGallery checks further down: an unset VITE_MEDIA_BASE_URL is exactly
  // what let this gate pass vacuously before (both sides of that comparison
  // collapsed to '', so it "passed" while proving nothing about URL
  // resolution). Failing loudly and early here means a future CI change that
  // drops the env var again shows up as this line, not as two
  // easy-to-misread mismatches near the bottom of the run.
  check(
    'VITE_MEDIA_BASE_URL is configured for this run',
    Boolean(mediaBaseUrl),
    'unset — src/lib/mediaUrl.js resolves every storage_path to \'\', so the checks below would pass vacuously instead of proving a real URL comes out',
  );

  try {
    await fetch(signUploadEndpoint, { method: 'OPTIONS' });
  } catch {
    console.error(`Cannot reach ${signUploadEndpoint}. Is the local stack's Edge Functions serving?`);
    process.exit(1);
  }

  await clean();

  console.log('seeding a throwaway admin');
  // service-role bypasses RLS — there is no admin session yet for RLS to
  // check against, same rationale as scripts/seed-admin.mjs. A fresh probe
  // account is used rather than the real admin@example.test so this script
  // never depends on — or mutates — whatever password a real operator set.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: PROBE_EMAIL,
    password: PROBE_PASSWORD,
    email_confirm: true,
  });
  check('creates a fresh admin auth user', !createErr && Boolean(created?.user?.id), createErr?.message);
  const probeUserId = created?.user?.id;

  const { error: profileErr } = await admin
    .from('profiles')
    .upsert({ user_id: probeUserId, role: 'admin' }, { onConflict: 'user_id' });
  check('grants it the admin role', !profileErr, profileErr?.message);

  console.log('\nanonymous refusals');
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });

  const anonSignUpload = await anon.functions.invoke('sign-upload', {
    body: { contentType: 'image/png', byteSize: PNG_BYTES.byteLength, fileName: 'anon-probe.png' },
  });
  const anonSignUploadBody = anonSignUpload.error
    ? await readFunctionErrorBody(anonSignUpload.error)
    : anonSignUpload.data;
  check(
    'an anonymous sign-upload is refused',
    Boolean(anonSignUpload.error) && anonSignUploadBody?.error === 'UNAUTHENTICATED',
    JSON.stringify(anonSignUploadBody),
  );

  // Seeded so "anon reads nothing" cannot be vacuously true because the
  // table happens to be empty — same discipline as scripts/verify-db.mjs's
  // own inquiries check.
  await admin.from('inquiries').delete().eq('email', PROBE_INQUIRY_EMAIL);
  const { error: inquirySeedErr } = await admin
    .from('inquiries')
    .insert({ name: 'Verify Admin Control', email: PROBE_INQUIRY_EMAIL, phone: '+91 90000 00000' });
  check('seeds a control inquiry row to read against', !inquirySeedErr, inquirySeedErr?.message);

  const { data: anonInquiries, error: anonInquiryErr } = await anon
    .from('inquiries')
    .select('id')
    .eq('email', PROBE_INQUIRY_EMAIL);
  check(
    'an anonymous read of inquiries returns nothing',
    Boolean(anonInquiryErr) || (Array.isArray(anonInquiries) && anonInquiries.length === 0),
    JSON.stringify(anonInquiries ?? anonInquiryErr),
  );

  console.log('\nsigning in as the seeded admin');
  const session = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signInData, error: signInErr } = await session.auth.signInWithPassword({
    email: PROBE_EMAIL,
    password: PROBE_PASSWORD,
  });
  check(
    'signs in with the anon key and gets a session',
    !signInErr && Boolean(signInData?.session?.access_token),
    signInErr?.message,
  );

  console.log('\nsign-upload and the PUT');
  const { data: signed, error: signErr } = await session.functions.invoke('sign-upload', {
    body: { contentType: 'image/png', byteSize: PNG_BYTES.byteLength, fileName: 'verify-admin-probe.png' },
  });
  check(
    'sign-upload succeeds for the authenticated admin',
    !signErr && signed?.ok === true,
    signErr?.message ?? JSON.stringify(signed),
  );
  check(
    'returns a presigned URL and a server-generated storage path',
    Boolean(signed?.url) && Boolean(signed?.storagePath?.startsWith('uploads/')),
    signed?.storagePath,
  );

  let putResponse = null;
  if (signed?.url) {
    putResponse = await fetch(signed.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: PNG_BYTES,
    });
  }
  check('PUTs the generated PNG to the signed URL', Boolean(putResponse?.ok), `HTTP ${putResponse?.status}`);

  console.log('\nrecording the media row, creating and publishing the wedding');
  const { data: mediaRow, error: mediaErr } = await session
    .from('media')
    .insert({ storage_path: signed?.storagePath, alt_text: PROBE_ALT_TEXT, width: 1, height: 1 })
    .select('id, storage_path')
    .single();
  check('inserts the media row as the admin', !mediaErr && Boolean(mediaRow?.id), mediaErr?.message);

  const probeSlug = `verify-admin-e2e-probe-${crypto.randomUUID().slice(0, 8)}`;
  const { data: wedding, error: weddingErr } = await session
    .from('weddings')
    .insert({
      slug: probeSlug,
      title: PROBE_TITLE,
      couple: PROBE_COUPLE,
      location: PROBE_LOCATION,
      event_date: PROBE_EVENT_DATE,
      summary: PROBE_SUMMARY,
      cover_media_id: mediaRow?.id,
      video_url: PROBE_VIDEO_URL,
      tags: PROBE_TAGS,
      status: 'draft',
      sort_order: 9999,
    })
    .select('id, status')
    .single();
  check('creates the wedding as a draft', !weddingErr && wedding?.status === 'draft', weddingErr?.message);

  const { error: attachErr } = await session
    .from('wedding_photos')
    .insert({ wedding_id: wedding?.id, media_id: mediaRow?.id, sort_order: 0 });
  check('attaches the photo to the wedding', !attachErr, attachErr?.message);

  // Proves the point the brief makes explicit: a wedding in the database
  // but not yet published must be invisible through the layer the public
  // site actually calls — not merely absent from some separate "is it
  // public" flag.
  const draftRead = await getWeddingBySlug(probeSlug);
  check('the public query layer cannot see it while still a draft', draftRead === null, JSON.stringify(draftRead));

  const { data: published, error: publishErr } = await session
    .from('weddings')
    .update({ status: 'published' })
    .eq('id', wedding?.id)
    .select('status')
    .single();
  check('publishes the wedding', !publishErr && published?.status === 'published', publishErr?.message);

  console.log('\nreading it back directly against Postgres');
  const { data: dbRow, error: dbErr } = await admin
    .from('weddings')
    .select('slug, title, couple, location, event_date, summary, video_url, tags, status, cover_media_id')
    .eq('id', wedding?.id)
    .single();
  check('Postgres has the row', !dbErr, dbErr?.message);
  if (dbRow) {
    check('slug matches', dbRow.slug === probeSlug, dbRow.slug);
    check('title matches', dbRow.title === PROBE_TITLE, dbRow.title);
    check('couple matches', dbRow.couple === PROBE_COUPLE, dbRow.couple);
    check('location matches', dbRow.location === PROBE_LOCATION, dbRow.location);
    check('event_date did not shift', dbRow.event_date === PROBE_EVENT_DATE, dbRow.event_date);
    check('summary matches', dbRow.summary === PROBE_SUMMARY, dbRow.summary);
    check('video_url matches', dbRow.video_url === PROBE_VIDEO_URL, dbRow.video_url);
    check('tags match', JSON.stringify(dbRow.tags) === JSON.stringify(PROBE_TAGS), JSON.stringify(dbRow.tags));
    check('status is published', dbRow.status === 'published', dbRow.status);
    check('cover_media_id points at the uploaded photo', dbRow.cover_media_id === mediaRow?.id, dbRow.cover_media_id);
  }

  console.log('\nreading it back through the public query layer (src/lib/queries/weddings.js)');
  const publicWedding = await getWeddingBySlug(probeSlug);
  check('the public query layer can see the published wedding', Boolean(publicWedding));
  if (publicWedding) {
    check('title matches', publicWedding.title === PROBE_TITLE, publicWedding.title);
    check('couple matches', publicWedding.couple === PROBE_COUPLE, publicWedding.couple);
    check('location matches', publicWedding.location === PROBE_LOCATION, publicWedding.location);
    check('eventDate did not shift', publicWedding.eventDate === PROBE_EVENT_DATE, publicWedding.eventDate);
    check(
      'the formatted display date agrees, with no month/year shift',
      publicWedding.date === 'May 2027',
      publicWedding.date,
    );
    check('summary matches', publicWedding.summary === PROBE_SUMMARY, publicWedding.summary);
    check('videoUrl matches', publicWedding.videoUrl === PROBE_VIDEO_URL, publicWedding.videoUrl);
    check('tags match', JSON.stringify(publicWedding.tags) === JSON.stringify(PROBE_TAGS), JSON.stringify(publicWedding.tags));
    check(
      "coverImage resolves the uploaded photo's storage_path to a real URL",
      Boolean(expectedMediaUrl(mediaRow?.storage_path))
        && publicWedding.coverImage === expectedMediaUrl(mediaRow?.storage_path),
      publicWedding.coverImage,
    );
    check(
      'the attached photo appears in fullGallery, resolved to a real URL',
      publicWedding.fullGallery?.length === 1
        && publicWedding.fullGallery[0] === expectedMediaUrl(mediaRow?.storage_path),
      JSON.stringify(publicWedding.fullGallery),
    );
  }

  await clean();

  console.log('');
  if (failures.length > 0) {
    console.error(`verify:admin FAILED — ${failures.length} check(s): ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('verify:admin passed — an admin can publish a wedding and the public site can see it.');
}

main().catch(async (error) => {
  console.error('verify:admin crashed:', error.message);
  await clean().catch(() => {});
  process.exit(1);
});
