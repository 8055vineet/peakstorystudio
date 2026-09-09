#!/usr/bin/env node
// Seeds (or, with --remove, deletes) one published wedding and one published
// More page so verify:prerender has something to verify. CI's local stack
// starts empty and verify:admin removes its own probe, which left the
// per-route checks in scripts/verify-prerender.mjs with nothing to check —
// green by vacuity. Local-only by construction (assert-local-target), and
// everything it writes is prefixed "ci-fixture" so a stray run is obvious
// and reversible: `node scripts/seed-prerender-fixture.mjs --remove`.
import { createClient } from '@supabase/supabase-js';
import { exitUnlessLocalTarget } from './lib/assert-local-target.mjs';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('seed-prerender-fixture: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see README, "Local database").');
  process.exit(1);
}
exitUnlessLocalTarget('seed-prerender-fixture');

const remove = process.argv.includes('--remove');
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

export const FIXTURE = {
  weddingSlug: 'ci-fixture-wedding',
  collectionSlug: 'ci-fixture-page',
  // A path the built site ships, so the cover resolves without a bucket.
  coverPath: '/images/stories/wedding/1.webp',
  photoPath: '/images/stories/wedding/2.webp',
};

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function removeFixture() {
  const weddings = await must(db.from('weddings').select('id, cover_media_id').eq('slug', FIXTURE.weddingSlug), 'find wedding');
  const collections = await must(db.from('collections').select('id').eq('slug', FIXTURE.collectionSlug), 'find collection');
  const mediaIds = new Set(weddings.map((w) => w.cover_media_id).filter(Boolean));
  for (const w of weddings) {
    const photos = await must(db.from('wedding_photos').select('media_id').eq('wedding_id', w.id), 'find photos');
    photos.forEach((p) => mediaIds.add(p.media_id));
  }
  for (const c of collections) {
    const items = await must(db.from('collection_items').select('media_id').eq('collection_id', c.id), 'find items');
    items.forEach((i) => i.media_id && mediaIds.add(i.media_id));
  }
  if (weddings.length) await must(db.from('weddings').delete().eq('slug', FIXTURE.weddingSlug), 'delete wedding');
  if (collections.length) await must(db.from('collections').delete().eq('slug', FIXTURE.collectionSlug), 'delete collection');
  for (const id of mediaIds) await must(db.from('media').delete().eq('id', id), 'delete media');
  console.log(`seed-prerender-fixture: removed ${weddings.length} wedding(s), ${collections.length} page(s), ${mediaIds.size} media row(s)`);
}

async function seedFixture() {
  await removeFixture(); // idempotent: a rerun replaces, never duplicates
  const [cover, photo] = await must(db.from('media').insert([
    { storage_path: FIXTURE.coverPath, width: 1600, height: 1067, alt_text: 'CI fixture cover' },
    { storage_path: FIXTURE.photoPath, width: 1600, height: 1067, alt_text: 'CI fixture photograph' },
  ]).select('id'), 'insert media');
  const wedding = await must(db.from('weddings').insert({
    slug: FIXTURE.weddingSlug, title: 'CI Fixture Wedding', couple: 'Fixture & Fixture', location: 'Lucknow',
    event_date: '2026-01-15', summary: 'A wedding that exists only so the prerender gate has a page to verify.',
    tags: ['Wedding'], status: 'published', cover_media_id: cover.id, sort_order: 999,
  }).select('id').single(), 'insert wedding');
  await must(db.from('wedding_photos').insert({ wedding_id: wedding.id, media_id: photo.id, sort_order: 0 }), 'insert photo');
  const collection = await must(db.from('collections').insert({
    slug: FIXTURE.collectionSlug, title: 'CI Fixture Page', description: 'A More page for the prerender gate.', status: 'published', sort_order: 999,
  }).select('id').single(), 'insert collection');
  await must(db.from('collection_items').insert({ collection_id: collection.id, media_id: photo.id, sort_order: 0 }), 'insert item');
  console.log(`seed-prerender-fixture: seeded /stories/${FIXTURE.weddingSlug} and /more/${FIXTURE.collectionSlug}`);
}

try {
  if (remove) await removeFixture(); else await seedFixture();
  process.exit(0);
} catch (err) {
  console.error(`seed-prerender-fixture: ${err.message}`);
  process.exit(1);
}
