import { ImageOff } from 'lucide-react';
import { mediaUrl } from '../lib/mediaUrl.js';

// Presentational, same division of labour as LeadsTable: fetching lives one
// level up (a caller-owned useResource(listMedia) call, per CLAUDE.md's
// "components call hooks" rule — MediaPicker itself must stay embeddable in
// Task 7's ResourceForm and Task 8's WeddingPhotos without assuming how its
// items got fetched). `status`/`error` win over `items`, matching
// LeadsTable's own guard: a hook that keeps the last known-good list around
// through a failed reload must not read here as "we have data, render the
// grid".
export default function MediaPicker({
  items, status, error, onRetry, onSelect,
}) {
  if (status === 'error') {
    return (
      <div role="alert" className="p-8 text-center border border-pitch-900/15 rounded-2xl bg-offwhite-50">
        <p className="text-sm font-semibold text-pitch-900 mb-4">
          Could not load media{error?.message ? `: ${error.message}` : '.'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="px-6 py-2.5 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (status === 'loading' && items.length === 0) {
    return <p className="p-8 text-center text-sm text-charcoal-700">Loading media…</p>;
  }

  // Distinct from the error state above: "nothing has been uploaded yet"
  // and "could not load what has been uploaded" are different facts, and
  // must never share copy or a retry control.
  if (items.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-charcoal-700 border border-pitch-900/10 rounded-2xl">
        No media yet. Upload a photograph to get started.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {items.map((item) => {
        const url = mediaUrl(item.storagePath);
        const missingAlt = !item.altText;
        return (
          <li key={item.id} className="border border-pitch-900/10 rounded-xl overflow-hidden bg-offwhite-50">
            <div className="aspect-square bg-offwhite-200 flex items-center justify-center">
              {url ? (
                <img
                  src={url}
                  alt={item.altText || 'Untitled photograph'}
                  className="w-full h-full object-cover"
                />
              ) : (
                // mediaUrl() returned null (no VITE_MEDIA_BASE_URL) — never
                // render an <img> pointed at a path with no base, which is
                // what an actually broken image on a fresh clone would look
                // like. This box names itself AND says why, so the reason is
                // visible instead of silently absent.
                <div className="flex flex-col items-center justify-center gap-1 p-2 text-center">
                  <ImageOff className="w-6 h-6 text-charcoal-500" aria-hidden="true" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-charcoal-700">
                    No Preview
                  </span>
                  <span className="text-[9px] text-charcoal-500">
                    VITE_MEDIA_BASE_URL is not set
                  </span>
                </div>
              )}
            </div>
            <div className="p-2 space-y-1.5">
              {missingAlt && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full border-2 border-gold-500 text-pitch-900 text-[9px] uppercase tracking-widest font-bold">
                  Alt Text Missing
                </span>
              )}
              <button
                type="button"
                onClick={() => onSelect?.(item)}
                className="w-full px-2 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors"
              >
                Select
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
