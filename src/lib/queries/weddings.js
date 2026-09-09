import { supabase } from '../supabase';
import { publicMediaUrl } from '../mediaUrl';

// Phase 5 (SEO) added updated_at and the cover row's width/height/alt_text,
// additively: updated_at is the sitemap's lastmod and what the admin compares
// against the live build-info.json; the cover's dimensions and alt text feed
// og:image:width/height/alt in the prerendered head.
const WEDDING_SELECT = `
  id, slug, title, couple, location, event_date, summary, video_url, tags, updated_at,
  cover:cover_media_id (storage_path, width, height, alt_text),
  wedding_photos (sort_order, media:media_id (storage_path))
`;

// '2024-11-01' -> 'November 2024', the display string the components render.
// Split rather than constructing a Date: parsing a date-only string yields UTC
// midnight, and reading it back with local getters shifts the month boundary in
// any timezone west of Greenwich.
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// A timestamptz as Postgres serialises it ('2026-09-01T10:20:30.123456+00:00')
// -> a normalised ISO string, or null when the row has none / it is
// unparseable. The prerender writes this into sitemap.xml and
// build-info.json, so it must never be a Date object or 'Invalid Date'.
function toIsoString(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function formatEventDate(value) {
  if (!value) return '';
  const [year, month] = String(value).split('-');
  const name = MONTHS[Number(month) - 1];
  return name ? `${name} ${year}` : '';
}

// publicMediaUrl() (src/lib/mediaUrl.js) resolves a real upload's
// bucket-relative storage_path against VITE_MEDIA_BASE_URL, passes a seeded
// row's already-absolute URL through unchanged, and returns '' — never a
// path pointing nowhere — when neither applies. '' is also what this
// function already returns for a wedding/photo with no cover at all, and
// every consumer already has to tolerate that (FeaturedStories,
// PhotoGallery, StoryAlbum, FilmsGallery all render straight from
// this data with no guard), so it stays the one "nothing to show" value
// here — and in gallery.js and films.js — instead of adding a second,
// broken-request one.
function toWedding(row) {
  const fullGallery = (row.wedding_photos ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((wp) => publicMediaUrl(wp.media?.storage_path))
    .filter(Boolean);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    couple: row.couple,
    location: row.location,
    date: formatEventDate(row.event_date),
    eventDate: row.event_date,
    summary: row.summary,
    coverImage: publicMediaUrl(row.cover?.storage_path),
    videoUrl: row.video_url,
    tags: row.tags ?? [],
    fullGallery,
    updatedAt: toIsoString(row.updated_at),
    coverMeta: {
      width: row.cover?.width ?? null,
      height: row.cover?.height ?? null,
      alt: row.cover?.alt_text ?? null,
    },
  };
}

export async function getPublishedWeddings() {
  const { data, error } = await supabase
    .from('weddings')
    .select(WEDDING_SELECT)
    .eq('status', 'published')
    .order('sort_order');

  if (error) throw new Error(`getPublishedWeddings: ${error.message}`);
  return (data ?? []).map(toWedding);
}

export async function getWeddingBySlug(slug) {
  const { data, error } = await supabase
    .from('weddings')
    .select(WEDDING_SELECT)
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(`getWeddingBySlug(${slug}): ${error.message}`);
  return data ? toWedding(data) : null;
}
