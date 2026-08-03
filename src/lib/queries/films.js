import { supabase } from '../supabase';
import { publicMediaUrl } from '../mediaUrl';

// The database stores an integer; FilmsGallery renders film.duration directly,
// so the display string is rebuilt here rather than in the component.
function formatDuration(seconds) {
  if (seconds == null) return '';
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs} mins`;
}

export async function getFilms() {
  const { data, error } = await supabase
    .from('films')
    .select('id, title, couple, location, duration_seconds, video_embed_url, thumbnail:thumbnail_media_id (storage_path)')
    .eq('status', 'published')
    .order('sort_order');

  if (error) throw new Error(`getFilms: ${error.message}`);

  // publicMediaUrl() (src/lib/mediaUrl.js) resolves a real upload's
  // bucket-relative storage_path against VITE_MEDIA_BASE_URL, passes a
  // seeded row's already-absolute URL through unchanged, and returns ''
  // when neither applies; see the longer comment in weddings.js for why ''
  // — the same "no thumbnail" value FilmsGallery already has to tolerate —
  // is the deliberate public-path fallback rather than a broken src pointed
  // at a bare bucket key.
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    couple: row.couple,
    location: row.location,
    duration: formatDuration(row.duration_seconds),
    thumbnail: publicMediaUrl(row.thumbnail?.storage_path),
    videoEmbedUrl: row.video_embed_url,
  }));
}
