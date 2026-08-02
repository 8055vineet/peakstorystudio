import { supabase } from '../supabase';

// Mirrors the CHECK constraint on inquiries.status
// (supabase/migrations/20260730203451_initial_schema.sql). Exported so
// LeadDetail can render exactly these four transitions from one source
// instead of a second, driftable copy of the same list, and so
// updateInquiryStatus can refuse an unknown value locally before it ever
// reaches Postgres.
export const INQUIRY_STATUSES = ['new', 'contacted', 'booked', 'archived'];

// Deliberately excludes `source` — not part of the shape this screen's
// interface documents, and every row today is 'website' regardless.
const INQUIRY_SELECT = 'id, name, email, phone, wedding_date, venue, services, message, status, notification_status, created_at';

function toInquiry(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    weddingDate: row.wedding_date,
    venue: row.venue,
    services: row.services ?? [],
    message: row.message,
    status: row.status,
    notificationStatus: row.notification_status,
    createdAt: row.created_at,
  };
}

// Newest first: a lead the studio was never emailed about (see
// notification_status — the reason this whole screen exists) needs to
// surface before nine older, already-handled ones, not get buried under them.
export async function listInquiries({ status } = {}) {
  let query = supabase.from('inquiries').select(INQUIRY_SELECT);
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });

  // A Postgres error must throw, never resolve to []. An admin dashboard
  // that shows "no inquiries" on a broken query reads as a quiet week
  // instead of the outage it actually is — the exact confusion
  // notification_status exists to prevent one layer up.
  if (error) throw new Error(`listInquiries: ${error.message}`);
  return (data ?? []).map(toInquiry);
}

export async function updateInquiryStatus(id, status) {
  // Reject locally before ever calling Supabase: an unknown value would
  // fail the CHECK constraint anyway, but checking here turns that into an
  // immediate, offline-testable rejection instead of a round trip that only
  // fails once the request lands on Postgres.
  if (!INQUIRY_STATUSES.includes(status)) {
    throw new Error(`updateInquiryStatus: "${status}" is not a valid inquiry status`);
  }

  const { data, error } = await supabase
    .from('inquiries')
    .update({ status })
    .eq('id', id)
    .select(INQUIRY_SELECT)
    .single();

  if (error) throw new Error(`updateInquiryStatus(${id}): ${error.message}`);
  return toInquiry(data);
}
