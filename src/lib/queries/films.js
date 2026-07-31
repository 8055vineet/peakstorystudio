import { supabase } from '../supabase';

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

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    couple: row.couple,
    location: row.location,
    duration: formatDuration(row.duration_seconds),
    thumbnail: row.thumbnail?.storage_path ?? '',
    videoEmbedUrl: row.video_embed_url,
  }));
}
