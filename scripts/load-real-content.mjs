#!/usr/bin/env node
// Replaces the seeded placeholder gallery and wedding-story content with the
// studio's real photographs (public/images/gallery/**, public/images/stories/**,
// committed in the content/real-photos branch). Films and testimonials are
// deliberately untouched: films wait on real video hosting (Phase 4), and the
// seeded testimonial replacement is the owner's call in the admin (PS-002).
//
// Unlike db:seed this does NOT reset the database — the inquiries table holds
// real leads — and it deletes only the content rows it replaces, plus the
// media rows those rows referenced (films keep their own media).
//
// Couple names are deliberately conservative: only names the owner supplied
// (the Downloads folder names). No invented pairings, dates, or venues —
// correct or extend via the admin at any time.
//
// Run: node scripts/load-real-content.mjs   (same env vars as db:seed)

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Try:');
  console.error(`  eval "$(supabase status -o env | sed 's/^/export /')"`);
  console.error('  export SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"');
  process.exit(2);
}
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

const GALLERY_SETS = [
  { dir: '/images/gallery/prewedding', count: 10, category: 'Pre-Wedding', title: (i) => `Pre-wedding ${i}`, alt: (i) => `Pre-wedding photograph ${i} — Peak Story Studio` },
  { dir: '/images/gallery/wedding', count: 24, category: 'Wedding', title: (i) => `Wedding day ${i}`, alt: (i) => `Wedding photograph ${i} — Peak Story Studio` },
];

const STORY = {
  slug: 'pragya',
  title: "Pragya's Wedding",
  couple: 'Pragya',
  location: 'Lucknow',
  event_date: null, // unknown — never guessed; set the real date in the admin
  summary:
    'From the engagement and the haldi and mehendi celebrations to the wedding day — one story, photographed by Peak Story Studio.',
  tags: ['Engagement', 'Haldi & Mehendi', 'Wedding'],
  cover: '/images/stories/wedding/1.jpg',
  chapters: [
    { dir: '/images/stories/engagement', count: 11, alt: (i) => `Engagement photograph ${i}` },
    { dir: '/images/stories/haldi-mehendi', count: 12, alt: (i) => `Haldi and mehendi photograph ${i}` },
    { dir: '/images/stories/wedding', count: 7, alt: (i) => `Wedding photograph ${i}` },
  ],
};

async function insertMedia(url, altText) {
  const { data, error } = await db
    .from('media')
    .insert({ storage_path: url, alt_text: altText || '' })
    .select('id')
    .single();
  if (error) throw new Error(`media insert failed for ${url}: ${error.message}`);
  return data.id;
}

async function main() {
  // 1. Collect the media ids the outgoing content references, so exactly
  //    those can be deleted afterwards (films' media must survive).
  const oldMedia = new Set();
  const { data: oldWeddings } = await db.from('weddings').select('cover_media_id');
  (oldWeddings ?? []).forEach((w) => w.cover_media_id && oldMedia.add(w.cover_media_id));
  const { data: oldWp } = await db.from('wedding_photos').select('media_id');
  (oldWp ?? []).forEach((r) => r.media_id && oldMedia.add(r.media_id));
  const { data: oldGp } = await db.from('gallery_photos').select('media_id');
  (oldGp ?? []).forEach((r) => r.media_id && oldMedia.add(r.media_id));

  // 2. Delete the outgoing rows (children before parents), then their media.
  for (const [table, col] of [['wedding_photos', 'wedding_id'], ['gallery_photos', 'id'], ['weddings', 'id']]) {
    const { error } = await db.from(table).delete().neq(col, '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`clearing ${table}: ${error.message}`);
  }
  for (const id of oldMedia) {
    const { error } = await db.from('media').delete().eq('id', id);
    if (error) throw new Error(`deleting old media ${id}: ${error.message}`);
  }

  const n = { media: 0, gallery_photos: 0, weddings: 0, wedding_photos: 0 };

  // 3. Gallery: pre-wedding first (they lead the Home grid), then wedding day.
  let sort = 0;
  for (const set of GALLERY_SETS) {
    for (let i = 1; i <= set.count; i++) {
      const mediaId = await insertMedia(`${set.dir}/${i}.jpg`, set.alt(i));
      n.media++;
      const { error } = await db.from('gallery_photos').insert({
        media_id: mediaId,
        title: set.title(i),
        category: set.category,
        couple: null,
        location: null,
        grid_span: null,
        status: 'published',
        sort_order: sort++,
      });
      if (error) throw new Error(`gallery_photos insert failed (${set.dir}/${i}.jpg): ${error.message}`);
      n.gallery_photos++;
    }
  }

  // 4. The wedding story, chapters in ceremony order.
  const coverId = await insertMedia(STORY.cover, `${STORY.title} — cover photograph`);
  n.media++;
  const { data: wed, error: wedErr } = await db
    .from('weddings')
    .insert({
      slug: STORY.slug,
      title: STORY.title,
      couple: STORY.couple,
      location: STORY.location,
      event_date: STORY.event_date,
      summary: STORY.summary,
      cover_media_id: coverId,
      video_url: null,
      tags: STORY.tags,
      status: 'published',
      sort_order: 0,
    })
    .select('id')
    .single();
  if (wedErr) throw new Error(`wedding insert failed: ${wedErr.message}`);
  n.weddings++;

  let photoSort = 0;
  for (const chapter of STORY.chapters) {
    for (let i = 1; i <= chapter.count; i++) {
      const mediaId = await insertMedia(`${chapter.dir}/${i}.jpg`, chapter.alt(i));
      n.media++;
      const { error } = await db
        .from('wedding_photos')
        .insert({ wedding_id: wed.id, media_id: mediaId, sort_order: photoSort++ });
      if (error) throw new Error(`wedding_photos insert failed (${chapter.dir}/${i}.jpg): ${error.message}`);
      n.wedding_photos++;
    }
  }

  console.log('loaded:', JSON.stringify(n));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
