import { supabase } from '../supabase';

// Hand-written, not makeResourceQueries(table, columns) — src/lib/queries/adminContent.js's
// generic factory cannot serve `wedding_photos`, for three reasons verified against
// supabase/migrations/20260730203451_initial_schema.sql before writing any of this:
//
//   1. `wedding_photos` has a composite primary key (wedding_id, media_id) and no
//      `id` column at all — every one of the factory's functions keys off `id`.
//   2. `wedding_photos` has no `status` column, so there is nothing for a publish
//      toggle (ResourceList's StatusToggle) to act on.
//   3. The factory's `list()` has no per-wedding filter — pointed at this table it
//      would return every wedding's photos globally interleaved under one
//      `sort_order`, not one wedding's own ordered set.
//
// One rule every function here is built around: removing a wedding_photos row must
// NEVER delete the underlying `media` row — the same photograph can be attached to
// another wedding, the gallery, or nothing at all, and is deleted (if ever) only
// from the Media Library itself. Nothing in this file calls
// supabase.from('media').delete(...); see removeWeddingPhoto below and its test.

function toWeddingPhoto(row) {
  return {
    mediaId: row.media_id,
    sortOrder: row.sort_order,
    storagePath: row.media?.storage_path ?? null,
    altText: row.media?.alt_text ?? '',
    width: row.media?.width ?? null,
    height: row.media?.height ?? null,
  };
}

const WEDDING_PHOTO_SELECT = 'media_id, sort_order, media:media_id (storage_path, alt_text, width, height)';

// Scoped to one wedding, ordered the way the public site and WeddingPhotos'
// reorder controls both read it — see wedding_photos_wedding_idx in the
// schema, which exists for exactly this query shape.
export async function listWeddingPhotos(weddingId) {
  const { data, error } = await supabase
    .from('wedding_photos')
    .select(WEDDING_PHOTO_SELECT)
    .eq('wedding_id', weddingId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`listWeddingPhotos(${weddingId}): ${error.message}`);
  return (data ?? []).map(toWeddingPhoto);
}

// Appends after whatever the wedding's current highest sort_order is — a
// second lookup rather than trusting a caller-supplied index, so
// WeddingPhotos.jsx never has to compute "how many photos does this wedding
// already have" itself just to attach one more.
//
// KNOWN RACE, DELIBERATELY TOLERATED: the read (max sort_order) and the
// write (insert at that max + 1) below are two separate round-trips with no
// locking between them. Two concurrent addWeddingPhoto calls for the same
// wedding can both read the same max and both insert at the same
// sort_order — there is no unique constraint on (wedding_id, sort_order) to
// even reject the second one. Nothing is destroyed when this happens; the
// only consequence is that the photo grid's ordering among the colliding
// rows becomes arbitrary until an admin reorders manually. A single admin
// adding photos one at a time (the only UI this ships with) cannot trigger
// it. Do not assume this function is transactional if it is ever called
// from more than one place at once.
export async function addWeddingPhoto(weddingId, mediaId) {
  const { data: existing, error: readError } = await supabase
    .from('wedding_photos')
    .select('sort_order')
    .eq('wedding_id', weddingId)
    .order('sort_order', { ascending: false })
    .limit(1);

  if (readError) throw new Error(`addWeddingPhoto(${weddingId}, ${mediaId}): ${readError.message}`);
  const nextSortOrder = existing?.length ? existing[0].sort_order + 1 : 0;

  const { error } = await supabase
    .from('wedding_photos')
    .insert({ wedding_id: weddingId, media_id: mediaId, sort_order: nextSortOrder });

  if (error) throw new Error(`addWeddingPhoto(${weddingId}, ${mediaId}): ${error.message}`);
  return { weddingId, mediaId, sortOrder: nextSortOrder };
}

// Deletes exactly the join row, filtered by both halves of the composite
// key. This is the one function in this file the "removing a photo must not
// destroy it" rule is entirely about: it touches only `wedding_photos`, and
// `media` is never named anywhere in this module.
export async function removeWeddingPhoto(weddingId, mediaId) {
  const { error } = await supabase
    .from('wedding_photos')
    .delete()
    .eq('wedding_id', weddingId)
    .eq('media_id', mediaId);

  if (error) throw new Error(`removeWeddingPhoto(${weddingId}, ${mediaId}): ${error.message}`);
  return { weddingId, mediaId };
}

// orderedMediaIds is every media id already attached to this wedding, in the
// order it should now read (WeddingPhotos.jsx computes that array the same
// way ResourceList.jsx computes it for the other five content types — see
// that file's own module comment). Writes run in parallel, keyed by both
// wedding_id and media_id since there is no single id column to key by.
export async function reorderWeddingPhotos(weddingId, orderedMediaIds) {
  const results = await Promise.all(orderedMediaIds.map((mediaId, index) => supabase
    .from('wedding_photos')
    .update({ sort_order: index })
    .eq('wedding_id', weddingId)
    .eq('media_id', mediaId)));

  const failed = results.find((result) => result.error);
  if (failed) throw new Error(`reorderWeddingPhotos(${weddingId}): ${failed.error.message}`);
  return { ok: true };
}
