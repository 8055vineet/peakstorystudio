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

// A `media.storage_path` value comes from two different writers, and they
// do not produce the same shape of value:
//
//   - A real upload (src/hooks/useMediaUpload.js, via sign-upload) always
//     writes a bucket-relative key with no leading slash and no scheme, e.g.
//     `uploads/<uuid>.webp` — meaningless on its own, and exactly what
//     mediaUrl() below resolves against VITE_MEDIA_BASE_URL.
//   - scripts/load-real-content.mjs (and before it seed-db.mjs) writes a
//     row's *original* URL straight into the same column — an
//     `images.unsplash.com` link, or a site-served `/images/...` path —
//     because loading never re-uploads the file anywhere. That value
//     already is a working <img src>; there is no bucket key to resolve.
//
// Feeding an already-complete URL through the base join would mangle it
// (a real base glued in front of a path that was never relative to that
// base — exactly the bug that blanked every static photograph's thumbnail
// in the admin media library). isAlreadyRenderable() tells them apart, and
// BOTH url helpers below apply it.
function isAlreadyRenderable(storagePath) {
  return /^https?:\/\//i.test(storagePath) || storagePath.startsWith('/');
}

// Returns null — never a URL pointing at nothing — when handed no path, or
// a bucket key while unconfigured, so a caller can tell "cannot render a
// preview" apart from "here is a real src" with one falsy check. An
// already-renderable value passes through regardless of configuration — a
// site-served path needs no storage base, even on a fresh clone.
export function mediaUrl(storagePath) {
  if (!storagePath) return null;
  const path = String(storagePath);
  if (isAlreadyRenderable(path)) return path;
  if (!MEDIA_BASE_URL) return null;
  return `${MEDIA_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

// The public site's counterpart to mediaUrl(): every consumer here is a
// visitor, not the admin, and a visitor cannot act on "storage is not
// configured" the way MediaPicker's labelled placeholder lets an admin.
// This coalesces "cannot resolve" to '' — the same empty value
// src/lib/queries/weddings.js, gallery.js and films.js already return for a
// cover/photo/thumbnail that does not exist — so every consumer has exactly
// one "nothing to show" value to guard against, never a second. It does NOT
// mean no <img> is shown: FeaturedStories and PhotoGallery both render an
// <img src={...}> unconditionally, with no guard on an empty coverImage/url,
// so '' still reaches the DOM as `<img src="">` — which a browser renders as
// its broken-image / alt-text state, not as nothing. '' was chosen because
// it is the value those components already tolerate without throwing, not
// because it renders invisibly.
export function publicMediaUrl(storagePath) {
  if (!storagePath) return '';
  if (isAlreadyRenderable(storagePath)) return storagePath;
  return mediaUrl(storagePath) ?? '';
}
