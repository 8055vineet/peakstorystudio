// One place both MediaPicker and UploadField (and, later, any Task 8/9
// content form that previews a photograph) ask "where does this file
// actually live". VITE_MEDIA_BASE_URL is the public base a photograph is
// served from — set for a deployed studio, deliberately blank on a fresh
// clone since nobody has configured storage yet. Reading it here once,
// rather than inline in each component, means a broken-image state can
// never leak in from one call site handling the unset case and another
// forgetting to.
const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL ?? '';

export const mediaBaseUrlConfigured = Boolean(MEDIA_BASE_URL);

// Returns null — never a URL pointing at nothing — when unconfigured or
// handed no path, so a caller can tell "cannot render a preview" apart from
// "here is a real src" with one falsy check instead of re-deriving
// mediaBaseUrlConfigured's condition itself.
export function mediaUrl(storagePath) {
  if (!MEDIA_BASE_URL || !storagePath) return null;
  return `${MEDIA_BASE_URL.replace(/\/+$/, '')}/${String(storagePath).replace(/^\/+/, '')}`;
}

// A `media.storage_path` value comes from one of two different writers, and
// they do not produce the same shape of value:
//
//   - A real upload (src/hooks/useMediaUpload.js, via sign-upload) always
//     writes a bucket-relative key with no leading slash and no scheme, e.g.
//     `uploads/<uuid>.webp` — meaningless on its own, and exactly what
//     mediaUrl() above resolves against VITE_MEDIA_BASE_URL.
//   - scripts/seed-db.mjs writes each seeded row's *original* URL straight
//     into the same column — an `images.unsplash.com` link, or a local
//     `/images/...` path already shipped with the site — because seeding
//     never re-uploads the file anywhere. There is no bucket key to resolve
//     for that row at all; the value already is a working <img src>.
//
// Feeding a seeded row's already-complete URL through mediaUrl() would
// either mangle it (join a real base in front of a path that was never
// relative to that base) or blank it out (an unconfigured base coalescing a
// perfectly good URL to null, purely because this function couldn't tell it
// apart from a bucket key). isAlreadyRenderable() is what tells them apart.
function isAlreadyRenderable(storagePath) {
  return /^https?:\/\//i.test(storagePath) || storagePath.startsWith('/');
}

// The public site's counterpart to mediaUrl(): every consumer here is a
// visitor, not the admin, and a visitor cannot act on "storage is not
// configured" the way MediaPicker's labelled placeholder lets an admin.
// A broken-image icon on a wedding photographer's own portfolio is worse
// than no <img> at all, so this coalesces "cannot resolve" to '' — the same
// empty value src/lib/queries/weddings.js, gallery.js and films.js already
// return for a cover/photo/thumbnail that does not exist, so a component
// never needs a second "nothing to show" case to guard against.
export function publicMediaUrl(storagePath) {
  if (!storagePath) return '';
  if (isAlreadyRenderable(storagePath)) return storagePath;
  return mediaUrl(storagePath) ?? '';
}
