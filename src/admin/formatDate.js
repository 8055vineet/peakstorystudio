// Two date shapes, two safe ways to format them — used by both LeadsTable
// (Wedding Date + Submitted columns) and LeadDetail (Wedding Date), so a
// single inquiry never shows two different date conventions in one place.

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// For a bare `date` column with no time or zone — inquiries.wedding_date
// ('YYYY-MM-DD'). Never goes through `new Date(...)`: parsing a date-only
// string that way reads it as UTC midnight, and formatting it back with the
// viewer's local getters (or toLocaleDateString, which also reads local
// time) can print the previous day in any timezone west of Greenwich. This
// project has already lost a day to exactly that — see
// src/lib/queries/weddings.js's formatEventDate, the precedent for this
// same fix on the public site. Splitting the string by hand is what keeps
// the result independent of the viewer's timezone.
export function formatDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-');
  const name = MONTHS[Number(month) - 1];
  return name ? `${name} ${Number(day)}, ${year}` : null;
}

// For a real instant with its own offset — inquiries.created_at
// (timestamptz). Safe to hand to Date/toLocaleDateString because, unlike a
// bare date, it unambiguously names one moment; rendering it in the
// viewer's local time is the expected behaviour here, not a bug.
export function formatTimestamp(value) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
