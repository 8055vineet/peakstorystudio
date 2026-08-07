import { supabase } from '../supabase';

// Hand-written like adminWeddingPhotos.js and for the same reasons: no
// status column for a publish toggle, an append-at-max add, and the same
// standing rule — removing an item must NEVER delete the underlying media
// row (the photograph may be attached to a wedding, the gallery, another
// page, or nothing at all). `media` is never named in a delete anywhere in
// this module. Unlike wedding_photos, collection_items has its own uuid
// `id`, so remove and reorder key by it directly.

const ITEM_SELECT = 'id, media_id, video_embed_url, caption, sort_order, media:media_id (storage_path, alt_text)';

function toItem(row) {
  return {
    id: row.id,
    mediaId: row.media_id,
    videoEmbedUrl: row.video_embed_url,
    caption: row.caption,
    sortOrder: row.sort_order,
    storagePath: row.media?.storage_path ?? null,
    altText: row.media?.alt_text ?? '',
  };
}

export async function listCollectionItems(collectionId) {
  const { data, error } = await supabase
    .from('collection_items')
    .select(ITEM_SELECT)
    .eq('collection_id', collectionId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`listCollectionItems(${collectionId}): ${error.message}`);
  return (data ?? []).map(toItem);
}

// Same two-step append (read max, insert max+1) and the same deliberately
// tolerated race as addWeddingPhoto — see that function's comment in
// adminWeddingPhotos.js; a single admin adding items one at a time cannot
// trigger it, and a collision only scrambles ordering, never data.
async function nextSortOrder(collectionId, label) {
  const { data, error } = await supabase
    .from('collection_items')
    .select('sort_order')
    .eq('collection_id', collectionId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (error) throw new Error(`${label}: ${error.message}`);
  return data?.length ? data[0].sort_order + 1 : 0;
}

export async function addCollectionPhoto(collectionId, mediaId) {
  const label = `addCollectionPhoto(${collectionId}, ${mediaId})`;
  const sortOrder = await nextSortOrder(collectionId, label);
  const { data, error } = await supabase
    .from('collection_items')
    .insert({ collection_id: collectionId, media_id: mediaId, sort_order: sortOrder })
    .select(ITEM_SELECT)
    .single();
  if (error) throw new Error(`${label}: ${error.message}`);
  return toItem(data);
}

export async function addCollectionVideo(collectionId, { videoEmbedUrl, posterMediaId = null, caption = null }) {
  const label = `addCollectionVideo(${collectionId})`;
  const sortOrder = await nextSortOrder(collectionId, label);
  const { data, error } = await supabase
    .from('collection_items')
    .insert({
      collection_id: collectionId,
      video_embed_url: videoEmbedUrl,
      media_id: posterMediaId,
      caption,
      sort_order: sortOrder,
    })
    .select(ITEM_SELECT)
    .single();
  if (error) throw new Error(`${label}: ${error.message}`);
  return toItem(data);
}

export async function removeCollectionItem(id) {
  const { error } = await supabase.from('collection_items').delete().eq('id', id);
  if (error) throw new Error(`removeCollectionItem(${id}): ${error.message}`);
  return { id };
}

export async function reorderCollectionItems(orderedIds) {
  const results = await Promise.all(orderedIds.map((id, index) => supabase
    .from('collection_items')
    .update({ sort_order: index })
    .eq('id', id)));
  const failed = results.find((result) => result.error);
  if (failed) throw new Error(`reorderCollectionItems: ${failed.error.message}`);
  return { ok: true };
}
