// The one definition of which status values a booking inquiry can hold.
//
// Mirrors the CHECK constraint on inquiries.status
// (supabase/migrations/20260730203451_initial_schema.sql). Split out from
// its sibling inquiry-validation.js (SERVICES/FIELD_LIMITS — the shape of a
// valid *submission*) because this is about admin status transitions, a
// different concern, but the same reason to share one definition: two
// copies would drift the day a fifth status is added.
//
// The reason this lives here rather than next to the admin code that uses
// it: src/lib/queries/adminInquiries.js validates against this list before
// ever calling Supabase, and src/admin/LeadDetail.jsx renders its four
// status-transition buttons from it — and LeadDetail must not transitively
// import @supabase/supabase-js just to get a list of four strings. Free of
// Deno and browser globals, like inquiry-validation.js, so both the
// submit-inquiry Edge Function and the browser (via the @shared Vite alias)
// can load it.
export const INQUIRY_STATUSES = ['new', 'contacted', 'booked', 'archived'];
