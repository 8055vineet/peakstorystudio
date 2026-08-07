import { supabase } from '../supabase';

// The Gallery tab's "Manage categories" backing. gallery_photos.category
// stays plain text; gallery_categories is its managed vocabulary — which is
// why rename goes through the rename_gallery_category RPC (one transaction
// updating the category row AND every photo naming it) and why delete
// refuses while any photo still uses the name.

function toCategory(row) {
  return { id: row.id, name: row.name, sortOrder: row.sort_order };
}

export async function listGalleryCategories() {
  const { data, error } = await supabase
    .from('gallery_categories')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`gallery_categories: list failed: ${error.message}`);
  return (data ?? []).map(toCategory);
}

// Same two-step append-at-max as adminCollectionItems.js, same tolerated
// single-admin race — see addWeddingPhoto's original comment.
export async function addGalleryCategory(name) {
  const { data, error: readError } = await supabase
    .from('gallery_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  if (readError) throw new Error(`gallery_categories: add failed: ${readError.message}`);
  const sortOrder = data?.length ? data[0].sort_order + 1 : 0;

  const { error } = await supabase
    .from('gallery_categories')
    .insert({ name, sort_order: sortOrder });
  if (error) throw new Error(`gallery_categories: add failed: ${error.message}`);
  return { name, sortOrder };
}

export async function renameGalleryCategory(oldName, newName) {
  const { error } = await supabase.rpc('rename_gallery_category', { p_old: oldName, p_new: newName });
  if (error) throw new Error(`gallery_categories: rename failed: ${error.message}`);
  return { name: newName };
}

export async function reorderGalleryCategories(orderedIds) {
  const results = await Promise.all(orderedIds.map((id, index) => supabase
    .from('gallery_categories')
    .update({ sort_order: index })
    .eq('id', id)));
  const failed = results.find((result) => result.error);
  if (failed) throw new Error(`gallery_categories: reorder failed: ${failed.error.message}`);
  return { ok: true };
}

export async function removeGalleryCategory(id, name) {
  const { count, error: countError } = await supabase
    .from('gallery_photos')
    .select('id', { count: 'exact', head: true })
    .eq('category', name);
  if (countError) throw new Error(`gallery_categories: remove failed: ${countError.message}`);
  if ((count ?? 0) > 0) {
    throw new Error(`Cannot delete "${name}" — ${count} photograph(s) still use it.`);
  }
  const { error } = await supabase.from('gallery_categories').delete().eq('id', id);
  if (error) throw new Error(`gallery_categories: remove failed: ${error.message}`);
  return { id };
}
