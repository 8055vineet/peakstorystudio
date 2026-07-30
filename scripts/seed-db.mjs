#!/usr/bin/env node
// Copies src/data/weddingData.js into Postgres. Idempotent: clears content
// tables first, so re-running produces the same result rather than duplicates.
// Run: npm run db:seed

import { createClient } from '@supabase/supabase-js';
import {
  INITIAL_STORIES,
  INITIAL_PHOTOS,
  INITIAL_FILMS,
  TESTIMONIALS,
} from '../src/data/weddingData.js';

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  console.error(`Try: eval "$(supabase status -o env | sed 's/^/export /')"`);
  process.exit(2);
}
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "November 2024" -> 2024-11-01. Unparseable -> null, never a guess.
function toDate(value) {
  if (!value) return null;
  const parsed = Date.parse(`1 ${value}`);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

// "4:32 mins" -> 272. Unparseable -> null.
function toSeconds(value) {
  if (!value) return null;
  const m = /(\d+):(\d+)/.exec(value);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

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
  // Order matters: children before parents, media last, because of foreign keys.
  for (const t of ['wedding_photos', 'gallery_photos', 'films', 'testimonials', 'weddings']) {
    const { error } = await db.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error && t !== 'wedding_photos') throw new Error(`clearing ${t}: ${error.message}`);
  }
  await db.from('wedding_photos').delete().neq('wedding_id', '00000000-0000-0000-0000-000000000000');
  await db.from('media').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  let n = { media: 0, weddings: 0, wedding_photos: 0, gallery_photos: 0, films: 0, testimonials: 0 };

  for (const [i, story] of INITIAL_STORIES.entries()) {
    const coverId = await insertMedia(story.coverImage, story.title);
    n.media++;
    const { data: wed, error } = await db
      .from('weddings')
      .insert({
        slug: slugify(story.title),
        title: story.title,
        couple: story.couple,
        location: story.location,
        event_date: toDate(story.date),
        summary: story.summary,
        cover_media_id: coverId,
        video_url: story.videoUrl ?? null,
        tags: story.tags ?? [],
        status: 'published',
        sort_order: i,
      })
      .select('id')
      .single();
    if (error) throw new Error(`wedding insert failed for ${story.title}: ${error.message}`);
    n.weddings++;

    for (const [j, img] of (story.fullGallery ?? []).entries()) {
      const mediaId = await insertMedia(img, `${story.title} photograph ${j + 1}`);
      n.media++;
      const { error: linkErr } = await db
        .from('wedding_photos')
        .insert({ wedding_id: wed.id, media_id: mediaId, sort_order: j });
      if (linkErr) throw new Error(`wedding_photos insert failed: ${linkErr.message}`);
      n.wedding_photos++;
    }
  }

  for (const [i, photo] of INITIAL_PHOTOS.entries()) {
    const mediaId = await insertMedia(photo.url, photo.title);
    n.media++;
    const { error } = await db.from('gallery_photos').insert({
      media_id: mediaId,
      title: photo.title,
      category: photo.category,
      couple: photo.couple ?? null,
      location: photo.location ?? null,
      grid_span: photo.span ?? null,
      status: 'published',
      sort_order: i,
    });
    if (error) throw new Error(`gallery_photos insert failed for ${photo.title}: ${error.message}`);
    n.gallery_photos++;
  }

  for (const [i, film] of INITIAL_FILMS.entries()) {
    const thumbId = await insertMedia(film.thumbnail, film.title);
    n.media++;
    const { error } = await db.from('films').insert({
      title: film.title,
      couple: film.couple ?? null,
      location: film.location ?? null,
      duration_seconds: toSeconds(film.duration),
      thumbnail_media_id: thumbId,
      video_embed_url: film.videoEmbedUrl,
      status: 'published',
      sort_order: i,
    });
    if (error) throw new Error(`films insert failed for ${film.title}: ${error.message}`);
    n.films++;
  }

  for (const [i, t] of TESTIMONIALS.entries()) {
    const { error } = await db.from('testimonials').insert({
      quote: t.quote,
      couple: t.couple,
      event: t.event ?? null,
      status: 'published',
      sort_order: i,
    });
    if (error) throw new Error(`testimonials insert failed: ${error.message}`);
    n.testimonials++;
  }

  console.log('seeded:', JSON.stringify(n));
  console.log('source counts:', JSON.stringify({
    stories: INITIAL_STORIES.length,
    photos: INITIAL_PHOTOS.length,
    films: INITIAL_FILMS.length,
    testimonials: TESTIMONIALS.length,
  }));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
