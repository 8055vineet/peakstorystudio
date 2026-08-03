import { useMemo, useState } from 'react';
import { useResource } from '../hooks/useResource';
import {
  listWeddingPhotos, addWeddingPhoto, removeWeddingPhoto, reorderWeddingPhotos,
} from '../lib/queries/adminWeddingPhotos';
import { listMedia } from '../lib/queries/media';
import { mediaUrl } from '../lib/mediaUrl.js';
import MediaPicker from './MediaPicker.jsx';
import UploadField from './UploadField.jsx';

const ACTION_BUTTON_CLASS = 'px-2 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-xs hover:bg-offwhite-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed';
const REMOVE_BUTTON_CLASS = 'px-3 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed';

// The one association screen in this admin that is not a
// ResourceList/ResourceForm pair, because `wedding_photos` fits neither
// contract:
//
//   1. It has a composite primary key (wedding_id, media_id) and no `id`
//      column at all — ResourceList keys every row off `item.id`.
//   2. It has no `status` column, so there is nothing for a publish toggle
//      to act on.
//
// So this component drives src/lib/queries/adminWeddingPhotos.js's
// hand-written queries directly (see that file's own module comment for the
// full reasoning) rather than makeResourceQueries.
//
// Owns its own useResource instance, scoped to `weddingId` — per that
// hook's own "one instance per resource, always" rule (see its module
// comment): a single mounted useResource() reused across two different
// weddingId values would leave the second wedding's photos never fetched.
// A caller switching which wedding this renders for must remount this
// component (e.g. `key={weddingId}`), the same "belt and braces" guidance
// ResourceForm's own module comment gives for `initial.id`.
//
// No optimistic UI: `items` only ever changes to what useResource's own
// reload most recently confirmed from the database. `actionPending` and
// `actionError` below track only whether an add/remove/reorder is in
// flight and whether it failed — neither ever fabricates a value for
// `items` itself.
export default function WeddingPhotos({ weddingId }) {
  const photoQueries = useMemo(() => ({
    list: () => listWeddingPhotos(weddingId),
    add: (mediaId) => addWeddingPhoto(weddingId, mediaId),
    remove: (mediaId) => removeWeddingPhoto(weddingId, mediaId),
    reorder: (orderedMediaIds) => reorderWeddingPhotos(weddingId, orderedMediaIds),
  }), [weddingId]);
  const {
    items, status, error, reload, mutate,
  } = useResource(photoQueries);

  // A second, independent useResource instance for "every photograph this
  // studio has ever uploaded" — same shape as src/admin/App.jsx's
  // MediaLibraryDashboard and ResourceForm's own MediaField, so an admin
  // can attach an existing photo without leaving this screen. Memoized so
  // the mount effect fetches exactly once.
  const mediaQueries = useMemo(() => ({ list: listMedia }), []);
  const mediaResource = useResource(mediaQueries);

  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Sorted defensively, the same reasoning as ResourceList.jsx's own
  // module comment: listWeddingPhotos already orders server-side by
  // sort_order, but a caller supplying items from anywhere else should not
  // also have to get the ordering right for the up/down controls to land
  // on the correct neighbour.
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [items],
  );

  async function runAction(name, ...args) {
    setActionPending(true);
    setActionError(null);
    try {
      await mutate(name, ...args);
    } catch (err) {
      setActionError(err);
    } finally {
      setActionPending(false);
    }
  }

  function handleAdd(mediaId) {
    runAction('add', mediaId);
  }

  function handleRemove(mediaId) {
    // Not reversible from this screen, so it gets the same confirm-first
    // treatment ResourceList's own delete does — and says explicitly that
    // the photograph itself survives, since that is the one thing Task 8's
    // brief calls out as destructive to get wrong.
    if (!window.confirm('Remove this photograph from the wedding? The photograph itself is kept in the media library.')) return;
    runAction('remove', mediaId);
  }

  function handleMove(index, direction) {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    runAction('reorder', reordered.map((item) => item.mediaId));
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs uppercase tracking-widest text-charcoal-500 font-bold mb-4">Photographs</h3>

        {status === 'error' && (
          <div role="alert" className="p-8 text-center border border-pitch-900/15 rounded-2xl bg-offwhite-50">
            <p className="text-sm font-semibold text-pitch-900 mb-4">
              Could not load this wedding&apos;s photographs{error?.message ? `: ${error.message}` : '.'}
            </p>
            <button
              type="button"
              onClick={() => reload()}
              className="px-6 py-2.5 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {status !== 'error' && status === 'loading' && sorted.length === 0 && (
          <p className="p-8 text-center text-sm text-charcoal-700">Loading photographs…</p>
        )}

        {status !== 'error' && !(status === 'loading' && sorted.length === 0) && sorted.length === 0 && (
          <p className="p-8 text-center text-sm text-charcoal-700 border border-pitch-900/10 rounded-2xl">
            No photographs attached to this wedding yet.
          </p>
        )}

        {status !== 'error' && sorted.length > 0 && (
          <ul aria-label="This wedding's photographs" className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {sorted.map((item, index) => {
              const url = mediaUrl(item.storagePath);
              const name = item.altText || item.mediaId;
              return (
                <li key={item.mediaId} className="border border-pitch-900/10 rounded-xl overflow-hidden bg-offwhite-50">
                  <div className="aspect-square bg-offwhite-200 flex items-center justify-center">
                    {url ? (
                      <img src={url} alt={item.altText || 'Untitled photograph'} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-charcoal-700">No Preview</span>
                    )}
                  </div>
                  <div className="p-2 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0 || actionPending}
                        aria-label={`Move up: ${name}`}
                        className={ACTION_BUTTON_CLASS}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === sorted.length - 1 || actionPending}
                        aria-label={`Move down: ${name}`}
                        className={ACTION_BUTTON_CLASS}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.mediaId)}
                        disabled={actionPending}
                        className={REMOVE_BUTTON_CLASS}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {actionError && (
          <div role="alert" className="mt-4 p-4 rounded-lg border border-pitch-900/20 bg-offwhite-50">
            <p className="text-xs font-semibold text-pitch-900">
              {/* useResource.mutate distinguishes a genuine write failure
                  (actionError.written is undefined) from a write that
                  succeeded but whose confirming reload failed
                  (actionError.written === true) — see that hook's own
                  module comment. Collapsing the two into one message would
                  tell an admin whose remove actually worked that it failed. */}
              {actionError.written
                ? `Saved, but the list could not be refreshed: ${actionError.cause?.message ?? actionError.message}. Reload to see the latest.`
                : (actionError.message ?? 'Something went wrong. Please try again.')}
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-widest text-charcoal-500 font-bold mb-4">Add a Photograph</h3>
        <div className="space-y-4">
          <UploadField onUploaded={(media) => { handleAdd(media.id); mediaResource.reload(); }} />
          <MediaPicker
            items={mediaResource.items}
            status={mediaResource.status}
            error={mediaResource.error}
            onRetry={mediaResource.reload}
            onSelect={(media) => handleAdd(media.id)}
          />
        </div>
      </div>
    </div>
  );
}
