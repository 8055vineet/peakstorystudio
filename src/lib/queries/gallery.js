import { supabase } from '../supabase';

export async function getGalleryPhotos() {
  const { data, error } = await supabase
    .from('gallery_photos')
    .select('id, title, category, couple, location, grid_span, media:media_id (storage_path)')
    .eq('status', 'published')
    .order('sort_order');

  if (error) throw new Error(`getGalleryPhotos: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    url: row.media?.storage_path ?? '',
    category: row.category,
    couple: row.couple,
    location: row.location,
    span: row.grid_span,
  }));
}
