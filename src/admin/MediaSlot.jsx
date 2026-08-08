import { useId, useState } from 'react';
import { mediaUrl } from '../lib/mediaUrl.js';
import MediaPickerDialog from './MediaPickerDialog.jsx';

// The compact control every form renders where it used to embed the whole
// media grid: a thumbnail of the chosen photograph plus Choose/Change (and,
// on optional slots, Remove). The library itself only ever appears inside
// the MediaPickerDialog this opens, so a form's own fields never sit below
// 65 tiles again. Presentational: the media list and its lifecycle arrive
// as props; the ONE piece of state this owns is whether its dialog is open.
const BUTTON_CLASS = 'px-4 py-2 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors';

export default function MediaSlot({
  label, help = null, required = false, error = null, value,
  media, mediaStatus, mediaError, onRetryMedia, onUploaded, onChange,
  previewShape = 'square',
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const errorId = useId();
  const selected = media.find((item) => item.id === value);
  const url = selected ? mediaUrl(selected.storagePath) : null;

  // A circle preview shows the thumbnail exactly as a circular badge renders
  // it on the public site (same crop, same object-cover) and larger, so the
  // owner can judge a logo before saving. Square is the default everywhere else.
  const isCircle = previewShape === 'circle';
  const boxClass = isCircle
    ? 'w-28 h-28 shrink-0 rounded-full overflow-hidden bg-offwhite-100 border border-pitch-900/15 flex items-center justify-center'
    : 'w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-offwhite-200 border border-pitch-900/10 flex items-center justify-center';

  return (
    <fieldset
      className="border border-pitch-900/10 rounded-xl p-4 space-y-3"
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-semibold">
        {label}{required && ' *'}
      </legend>
      {help && <p className="text-xs text-charcoal-500">{help}</p>}
      <div className="flex items-center gap-4">
        <div className={boxClass} data-testid="media-slot-preview">
          {value ? (
            url ? (
              <img
                src={url}
                alt={selected?.altText || 'Selected photograph'}
                className="w-full h-full object-cover"
              />
            ) : (
              // The library has not resolved this id (still loading, or the
              // row is gone) — name the id rather than showing nothing.
              <span className="p-2 text-[9px] text-charcoal-700 text-center break-all">
                Selected media id: {value}
              </span>
            )
          ) : (
            <span className="p-2 text-[9px] font-bold uppercase tracking-widest text-charcoal-700 text-center">
              No photograph yet
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setDialogOpen(true)} className={BUTTON_CLASS}>
            {value ? 'Change' : 'Choose photograph'}
          </button>
          {value && !required && (
            <button type="button" onClick={() => onChange(null)} className={BUTTON_CLASS}>
              Remove
            </button>
          )}
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs font-semibold text-pitch-900">{error}</p>
      )}
      <MediaPickerDialog
        open={dialogOpen}
        title="Choose a photograph"
        uploadMultiple={false}
        items={media}
        status={mediaStatus}
        error={mediaError}
        onRetry={onRetryMedia}
        selectedId={value}
        onSelect={(item) => { onChange(item.id); setDialogOpen(false); }}
        onUploaded={(uploaded) => {
          onUploaded?.(uploaded);
          onChange(uploaded.id);
          setDialogOpen(false);
        }}
        onClose={() => setDialogOpen(false)}
      />
    </fieldset>
  );
}
