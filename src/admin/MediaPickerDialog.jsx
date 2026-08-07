import {
  useEffect, useId, useRef, useState,
} from 'react';
import { X } from 'lucide-react';
import MediaPicker from './MediaPicker.jsx';
import UploadField from './UploadField.jsx';

// The full-screen "choose a photograph" overlay every media-picking flow in
// this admin opens instead of embedding the library grid inline — the fix
// for the owner's "the form is at the bottom of 65 tiles" complaint.
// Presentational like MediaPicker itself: items and their load lifecycle
// arrive as props, and this file never fetches.
//
// Split into a mount-fresh inner component so open/close needs no effects
// that write state: the outer function renders null when closed, so every
// open mounts DialogInner from scratch — search resets, and focus plus the
// body scroll-lock run as plain mount/unmount effects with nothing to
// synchronise. onSelect deliberately does NOT close the dialog — a
// single-pick caller (MediaSlot) closes in its own handler, and
// WeddingPhotos keeps it open on purpose to attach several photographs in
// one visit.

const DIALOG_GRID = 'grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4';

function fileName(storagePath) {
  return String(storagePath ?? '').split('/').pop() ?? '';
}

function matches(item, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (item.altText ?? '').toLowerCase().includes(q)
    || fileName(item.storagePath).toLowerCase().includes(q);
}

function DialogInner({
  title, items, status, error, onRetry, onUploaded, onSelect, onClose,
  selectedId, selectedIds, closeLabel, uploadMultiple,
}) {
  const [query, setQuery] = useState('');
  const headingId = useId();
  const searchRef = useRef(null);
  // Kept current via effect (never written during render, per the purity
  // rules) so the mount-only listener effect below never has to re-run —
  // re-running it would re-capture "previously focused" as the search box.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    searchRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event) {
      if (event.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  const filtered = items.filter((item) => matches(item, query));
  const activeQuery = query.trim();
  const zeroMatches = Boolean(activeQuery) && filtered.length === 0
    && items.length > 0 && status !== 'error';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      className="fixed inset-0 z-50 bg-offwhite-100 text-pitch-900 flex flex-col"
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-pitch-900/10">
        <h2 id={headingId} className="font-cinzel text-lg font-bold text-pitch-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-2 rounded-lg border border-pitch-900/20 text-pitch-900 hover:bg-offwhite-200 transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>
      <div className="px-6 py-4 border-b border-pitch-900/10 space-y-3">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by alt text or file name…"
          aria-label="Search photographs"
          className="w-full max-w-md px-4 py-2.5 rounded-lg bg-offwhite-50 border border-pitch-900/15 text-sm text-pitch-900 focus:outline-none focus:border-pitch-900"
        />
        {items.length > 0 && status !== 'error' && (
          <p className="text-xs text-charcoal-500">
            {filtered.length} of {items.length} photographs
          </p>
        )}
        <UploadField onUploaded={onUploaded} multiple={uploadMultiple} />
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {zeroMatches ? (
          // Distinct from MediaPicker's own "No media yet": the library has
          // photographs — this particular search just matched none of them.
          <p className="p-8 text-center text-sm text-charcoal-700">
            No photographs match &ldquo;{activeQuery}&rdquo;.
          </p>
        ) : (
          <MediaPicker
            items={filtered}
            status={status}
            error={error}
            onRetry={onRetry}
            onSelect={onSelect}
            selectedId={selectedId}
            selectedIds={selectedIds}
            gridClass={DIALOG_GRID}
          />
        )}
      </div>
      <footer className="px-6 py-4 border-t border-pitch-900/10">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-3 rounded-lg border border-pitch-900/20 text-pitch-900 text-xs uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors"
        >
          {closeLabel}
        </button>
      </footer>
    </div>
  );
}

export default function MediaPickerDialog({
  open, closeLabel = 'Cancel', uploadMultiple = true, ...props
}) {
  if (!open) return null;
  return <DialogInner closeLabel={closeLabel} uploadMultiple={uploadMultiple} {...props} />;
}
