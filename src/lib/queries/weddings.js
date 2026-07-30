import { supabase } from '../supabase';

const WEDDING_SELECT = `
  id, slug, title, couple, location, event_date, summary, video_url, tags,
  cover:cover_media_id (storage_path),
  wedding_photos (sort_order, media:media_id (storage_path))
`;

function toWedding(row) {
  const gallery = (row.wedding_photos ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((wp) => wp.media?.storage_path)
    .filter(Boolean);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    couple: row.couple,
    location: row.location,
    eventDate: row.event_date,
    summary: row.summary,
    coverImage: row.cover?.storage_path ?? '',
    videoUrl: row.video_url,
    tags: row.tags ?? [],
    gallery,
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
