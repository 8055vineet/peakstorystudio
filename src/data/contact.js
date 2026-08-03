// FALLBACK ONLY since Phase 3c: the live contact details live in the
// site_settings table (admin Settings tab). These owner-confirmed values
// (2026-08-03, PS-028) render when the database is unreachable and serve as
// prop defaults; keep them in step with the migration's seed. Do not edit
// this file to change the live site — use the admin.
export const STUDIO_PHONE = '+91 8881621021';
export const STUDIO_EMAIL = 'peakstorystudio@gmail.com';
export const STUDIO_ADDRESS = '2/231 Vastu Khand, Gomtinagar, Lucknow, UP';

// Digits only, country code first — the form wa.me links require.
export const WHATSAPP_NUMBER = '918881621021';

// Owner has not supplied these yet. Empty string means the footer renders the
// icon without a link (a plain span, not a dead anchor). Fill in when known.
export const STUDIO_INSTAGRAM_URL = '';
export const STUDIO_YOUTUBE_URL = '';
