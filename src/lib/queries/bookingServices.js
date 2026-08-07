import { supabase } from '../supabase';

// The admin-managed list the contact form's service buttons render from.
// Names only, in the admin's chosen order; the shared inquiry validator no
// longer enforces an allowlist (see its own MAX_SERVICES comment), so this
// list is presentation, not authorization.
export async function getBookingServices() {
  const { data, error } = await supabase
    .from('booking_services')
    .select('name')
    .order('sort_order');
  if (error) throw new Error(`getBookingServices: ${error.message}`);
  return (data ?? []).map((row) => row.name);
}
