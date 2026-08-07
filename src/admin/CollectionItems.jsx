import { useMemo, useState } from 'react';
import { useResource } from '../hooks/useResource';
import {
  listCollectionItems, addCollectionPhoto, addCollectionVideo, removeCollectionItem, reorderCollectionItems,
} from '../lib/queries/adminCollectionItems';
import { listMedia } from '../lib/queries/media';
import { mediaUrl } from '../lib/mediaUrl.js';
import MediaPickerDialog from './MediaPickerDialog.jsx';
import MediaSlot from './MediaSlot.jsx';

const ACTION_BUTTON_CLASS = 'px-2 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-xs hover:bg-offwhite-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed';
const REMOVE_BUTTON_CLASS = 'px-3 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed';
const PRIMARY_BUTTON_CLASS = 'px-6 py-3 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors';
const INPUT_CLASS = 'w-full px-4 py-3 rounded-lg bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900';

// The Pages tab's content manager — WeddingPhotos' shape (own useResource
// scoped by collectionId; a second instance for the media library; no
// optimistic UI) with two differences: an item can be a photograph OR a
// video (embed URL + optional poster + optional caption), and items key by
// their own uuid `id`. A caller switching collections must remount this
// (key={collectionId}) — same guidance as WeddingPhotos.
export default function CollectionItems({ collectionId }) {
  const itemQueries = useMemo(() => ({
    list: () => listCollectionItems(collectionId),
    addPhoto: (mediaId) => addCollectionPhoto(collectionId, mediaId),
    addVideo: (video) => addCollectionVideo(collectionId, video),
    remove: (id) => removeCollectionItem(id),
    reorder: (orderedIds) => reorderCollectionItems(orderedIds),
  }), [collectionId]);
  const {
    items, status, error, reload, mutate,
  } = useResource(itemQueries);

  const mediaQueries = useMemo(() => ({ list: listMedia }), []);
  const mediaResource = useResource(mediaQueries);

  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [videoFormOpen, setVideoFormOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoCaption, setVideoCaption] = useState('');
  const [videoPosterId, setVideoPosterId] = useState(null);
  const [videoUrlError, setVideoUrlError] = useState(null);

  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [items],
  );
  const attachedPhotoMediaIds = sorted.filter((item) => !item.videoEmbedUrl).map((item) => item.mediaId);

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

  function handleRemove(id) {
    if (!window.confirm('Remove this item from the page? Photographs stay in the media library.')) return;
    runAction('remove', id);
  }

  function handleMove(index, direction) {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    runAction('reorder', reordered.map((item) => item.id));
  }

  function handleAddVideo() {
    const url = videoUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setVideoUrlError('Must start with http:// or https://.');
      return;
    }
    setVideoUrlError(null);
    runAction('addVideo', {
      videoEmbedUrl: url,
      posterMediaId: videoPosterId,
      caption: videoCaption.trim() || null,
    });
    setVideoUrl('');
    setVideoCaption('');
    setVideoPosterId(null);
    setVideoFormOpen(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs uppercase tracking-widest text-charcoal-500 font-bold mb-4">Page Items</h3>

        {status === 'error' && (
          <div role="alert" className="p-8 text-center border border-pitch-900/15 rounded-2xl bg-offwhite-50">
            <p className="text-sm font-semibold text-pitch-900 mb-4">
              Could not load this page&apos;s items{error?.message ? `: ${error.message}` : '.'}
            </p>
            <button type="button" onClick={() => reload()} className={PRIMARY_BUTTON_CLASS}>Retry</button>
          </div>
        )}

        {status !== 'error' && status === 'loading' && sorted.length === 0 && (
          <p className="p-8 text-center text-sm text-charcoal-700">Loading items…</p>
        )}

        {status !== 'error' && !(status === 'loading' && sorted.length === 0) && sorted.length === 0 && (
          <p className="p-8 text-center text-sm text-charcoal-700 border border-pitch-900/10 rounded-2xl">
            No items on this page yet.
          </p>
        )}

        {status !== 'error' && sorted.length > 0 && (
          <ul aria-label="This page's items" className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {sorted.map((item, index) => {
              const url = mediaUrl(item.storagePath);
              const name = item.caption || item.altText || (item.videoEmbedUrl ? 'video' : item.mediaId);
              return (
                <li key={item.id} className="border border-pitch-900/10 rounded-xl overflow-hidden bg-offwhite-50">
                  <div className={`aspect-square flex items-center justify-center relative ${item.videoEmbedUrl ? 'bg-pitch-900' : 'bg-offwhite-200'}`}>
                    {url ? (
                      <img src={url} alt={item.altText || 'Item'} className={`w-full h-full object-cover ${item.videoEmbedUrl ? 'opacity-80' : ''}`} />
                    ) : !item.videoEmbedUrl && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-charcoal-700">No Preview</span>
                    )}
                    {item.videoEmbedUrl && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-offwhite-50/90 text-pitch-900 text-[9px] uppercase tracking-widest font-bold">
                        Video
                      </span>
                    )}
                  </div>
                  <div className="p-2 space-y-1.5">
                    {item.caption && (
                      <p className="text-[10px] text-charcoal-700 truncate">{item.caption}</p>
                    )}
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
                        onClick={() => handleRemove(item.id)}
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
              {actionError.written
                ? `Saved, but the list could not be refreshed: ${actionError.cause?.message ?? actionError.message}. Reload to see the latest.`
                : (actionError.message ?? 'Something went wrong. Please try again.')}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setPickerOpen(true)} className={PRIMARY_BUTTON_CLASS}>
          Add photographs
        </button>
        <button
          type="button"
          onClick={() => setVideoFormOpen((open) => !open)}
          className="px-6 py-3 rounded-lg border border-pitch-900/20 text-pitch-900 text-xs uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors"
        >
          Add video
        </button>
      </div>

      {videoFormOpen && (
        <div className="border border-pitch-900/10 rounded-xl p-4 space-y-4 max-w-xl">
          <div>
            <label htmlFor="collection-video-url" className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-semibold">
              Video Embed URL
            </label>
            <input
              id="collection-video-url"
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-charcoal-500">
              An embed URL, e.g. https://www.youtube.com/embed/VIDEO_ID — not a normal watch-page link.
            </p>
            {videoUrlError && (
              <p role="alert" className="mt-2 text-xs font-semibold text-pitch-900">{videoUrlError}</p>
            )}
          </div>
          <div>
            <label htmlFor="collection-video-caption" className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-semibold">
              Caption (optional)
            </label>
            <input
              id="collection-video-caption"
              type="text"
              value={videoCaption}
              onChange={(e) => setVideoCaption(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <MediaSlot
            label="Poster (optional)"
            help="Shown as the video tile's image on the public page."
            required={false}
            value={videoPosterId}
            media={mediaResource.items}
            mediaStatus={mediaResource.status}
            mediaError={mediaResource.error}
            onRetryMedia={mediaResource.reload}
            onUploaded={() => mediaResource.reload()}
            onChange={setVideoPosterId}
          />
          <button type="button" onClick={handleAddVideo} disabled={actionPending} className={PRIMARY_BUTTON_CLASS}>
            Add
          </button>
        </div>
      )}

      {/* Stays open across selections on purpose: filling a page is a
          batch, and already-attached photographs read "✓ Selected" via
          selectedIds so a second click is a visible no-op. */}
      <MediaPickerDialog
        open={pickerOpen}
        title="Add photographs to this page"
        items={mediaResource.items}
        status={mediaResource.status}
        error={mediaResource.error}
        onRetry={mediaResource.reload}
        selectedIds={attachedPhotoMediaIds}
        onSelect={(media) => {
          if (!attachedPhotoMediaIds.includes(media.id)) runAction('addPhoto', media.id);
        }}
        onUploaded={(media) => { runAction('addPhoto', media.id); mediaResource.reload(); }}
        onClose={() => setPickerOpen(false)}
        closeLabel="Done"
      />
    </div>
  );
}
