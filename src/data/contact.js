// One home for the studio's contact details.
//
// None of these have been confirmed by the studio yet — they arrived with the
// seeded template. Centralising them means Phase 7's truthful-content pass has
// a single file to correct instead of a hunt through components. Tracked as
// PS-028 in docs/KNOWN-ISSUES.md.
export const STUDIO_PHONE = '+91 98200 37027';
export const STUDIO_EMAIL = 'inquiries@peakstorystudio.com';
export const STUDIO_ADDRESS = '241 Laxmi Plaza, Andheri (W), Mumbai, India';

// Digits only, country code first, e.g. 919820037027. Unset means the
// WhatsApp button does not render at all, so no unconfirmed number ships.
export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER ?? '';
