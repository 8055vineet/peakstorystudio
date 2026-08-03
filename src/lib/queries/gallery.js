import { supabase } from '../supabase';
import { publicMediaUrl } from '../mediaUrl';

export async function getGalleryPhotos() {
  const { data, error } = await supabase
    .from('gallery_photos')
    .select('id, title, category, couple, location, grid_span, media:media_id (storage_path)')
    .eq('status', 'published')
    .order('sort_order');

  if (error) throw new Error(`getGalleryPhotos: ${error.message}`);

  // publicMediaUrl() (src/lib/mediaUrl.js) resolves a real upload's
  // bucket-relative storage_path against VITE_MEDIA_BASE_URL, passes a
  // seeded row's already-absolute URL through unchanged, and returns ''
  // when neither applies; see the longer comment in weddings.js for why ''
  // — the same "no photo" value PhotoGallery already has to tolerate — is
  // the deliberate public-path fallback rather than a broken src pointed at
  // a bare bucket key.
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    url: publicMediaUrl(row.media?.storage_path),
    category: row.category,
    couple: row.couple,
    location: row.location,
    span: row.grid_span,
  }));
}
