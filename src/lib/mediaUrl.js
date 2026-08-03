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
