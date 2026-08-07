// FALLBACK ONLY since Phase 3e — the live list is the gallery_categories
// table, managed in the admin's Gallery tab ("Manage categories"). This is
// what PhotoGallery orders sections by when the database is unreachable.
// Keep in step with the migration seed
// (supabase/migrations/20260807100000_admin_extensibility.sql).
export const GALLERY_CATEGORY_FALLBACK = ['Pre-Wedding', 'Wedding', 'Engagement', 'Haldi & Mehendi'];
