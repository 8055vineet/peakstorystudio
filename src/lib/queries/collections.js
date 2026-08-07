import { supabase } from '../supabase';
import { publicMediaUrl } from '../mediaUrl';

// The admin-created "More" pages, published only, both levels ordered.
// Postgres cascades the delete (collection_items references collections on
// delete cascade), so an item can never outlive its page. Resilience lives
// in useCollections (src/hooks/useContent.js), which falls back to an empty
// list — during an outage the More menu simply hides.
export async function getCollections() {
  const { data, error } = await supabase
    .from('collections')
    .select('id, slug, title, description, items:collection_items (id, video_embed_url, caption, media:media_id (storage_path))')
    .eq('status', 'published')
    .order('sort_order')
    .order('sort_order', { foreignTable: 'collection_items' });

  if (error) throw new Error(`getCollections: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    items: (row.items ?? []).map((item) => ({
      id: item.id,
      url: publicMediaUrl(item.media?.storage_path),
      videoEmbedUrl: item.video_embed_url,
      caption: item.caption,
    })),
  }));
}
