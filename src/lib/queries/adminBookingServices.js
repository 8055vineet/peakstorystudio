import { supabase } from '../supabase';

// The Settings tab's "Booking services" backing. Unlike gallery categories
// there is no propagation concern: stored inquiries are historical records
// and keep whatever service names they were submitted with, so rename is a
// plain update and remove needs no usage guard — both only change what the
// contact form offers from now on.

function toService(row) {
  return { id: row.id, name: row.name, sortOrder: row.sort_order };
}

export async function listBookingServices() {
  const { data, error } = await supabase
    .from('booking_services')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`booking_services: list failed: ${error.message}`);
  return (data ?? []).map(toService);
}

// Same two-step append-at-max as adminGalleryCategories.js, same tolerated
// single-admin race.
export async function addBookingService(name) {
  const { data, error: readError } = await supabase
    .from('booking_services')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  if (readError) throw new Error(`booking_services: add failed: ${readError.message}`);
  const sortOrder = data?.length ? data[0].sort_order + 1 : 0;

  const { error } = await supabase
    .from('booking_services')
    .insert({ name, sort_order: sortOrder });
  if (error) throw new Error(`booking_services: add failed: ${error.message}`);
  return { name, sortOrder };
}

export async function renameBookingService(id, name) {
  const { error } = await supabase
    .from('booking_services')
    .update({ name })
    .eq('id', id);
  if (error) throw new Error(`booking_services: rename failed: ${error.message}`);
  return { id, name };
}

export async function reorderBookingServices(orderedIds) {
  const results = await Promise.all(orderedIds.map((id, index) => supabase
    .from('booking_services')
    .update({ sort_order: index })
    .eq('id', id)));
  const failed = results.find((result) => result.error);
  if (failed) throw new Error(`booking_services: reorder failed: ${failed.error.message}`);
  return { ok: true };
}

export async function removeBookingService(id) {
  const { error } = await supabase.from('booking_services').delete().eq('id', id);
  if (error) throw new Error(`booking_services: remove failed: ${error.message}`);
  return { id };
}
