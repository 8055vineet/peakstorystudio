import { supabase } from '../supabase';
import { publicMediaUrl } from '../mediaUrl';

const WEDDING_SELECT = `
  id, slug, title, couple, location, event_date, summary, video_url, tags,
  cover:cover_media_id (storage_path),
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
// PhotoGallery, StoryDetailModal, FilmsGallery all render straight from
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
