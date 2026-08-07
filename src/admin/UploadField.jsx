import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useMediaUpload } from '../hooks/useMediaUpload';

const BUSY_STATUSES = ['resizing', 'signing', 'uploading', 'recording'];

// Shown while a stage is in flight — a short present-tense sentence.
const PROGRESS_LABELS = {
  resizing: 'Resizing the image…',
  signing: 'Requesting upload permission…',
  uploading: 'Uploading to storage…',
  recording: 'Saving the record…',
};

// Shown after a failure, embedded in "Upload failed while {…}." — a noun
// phrase, not a sentence, so it reads correctly mid-sentence.
const STAGE_NAMES = {
  resizing: 'resizing the image',
  signing: 'requesting upload permission',
  uploading: 'uploading to storage',
  recording: 'saving the record',
};

// Keyed by the ImageError/MediaError codes src/hooks/useMediaUpload.js
// surfaces via error.code. RECORD_FAILED is deliberately the most explicit
// of these: the file already reached storage but nothing in Postgres points
// at it, so this must read as "did not complete", never as an equally-weighted
// peer of "that file is too large" — see the hook's own module comment for
// why that distinction is the entire point of the staged design.
const ERROR_COPY = {
  NOT_AN_IMAGE: 'That file is not an image.',
  DECODE_FAILED: 'That image could not be opened — it may be corrupted. Try a different file.',
  ENCODE_FAILED: 'That image could not be processed. Try a different file.',
  MALFORMED_REQUEST: 'The upload request was invalid.',
  UNAUTHENTICATED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'This account is not allowed to upload media.',
  FILE_TOO_LARGE: 'That file is too large to upload.',
  UNSUPPORTED_TYPE: 'That file type is not supported.',
  STORAGE_NOT_CONFIGURED: "Storage is not configured. Contact the studio's developer.",
  NETWORK_ERROR: "Could not reach the studio's servers. Check your connection and try again.",
  SERVER_ERROR: 'Something went wrong on our side.',
  UPLOAD_FAILED: 'The upload itself failed partway through.',
  RECORD_FAILED: 'The photograph reached storage, but its record could not be saved, so this upload did NOT complete. Retry to record it properly.',
};

function errorMessage(error) {
  if (!error) return null;
  let message = ERROR_COPY[error.code] ?? 'Something went wrong. Please try again.';
  if (error.code === 'FILE_TOO_LARGE' && error.maxBytes) {
    message += ` Maximum size is ${Math.round(error.maxBytes / (1024 * 1024))} MB.`;
  }
  if (error.code === 'UNSUPPORTED_TYPE' && error.allowed?.length) {
    message += ` Allowed types: ${error.allowed.join(', ')}.`;
  }
  return message;
}

// Presentational owner of one upload. The chosen File never needs to escape
// this component except via onUploaded's finished media row, so — per
// CLAUDE.md — it stays in local state here, same reasoning as SignInForm
// keeping its own field values. Drives src/hooks/useMediaUpload.js directly,
// the way BookingForm drives useInquirySubmission directly: this is a
// self-contained control, not shared session state that belongs in
// src/admin/App.jsx.
//
// Keeping `file` in state (rather than only ever reading it off the input
// element) is what makes retry after a failure cheap: the admin who already
// picked a photograph should never have to find it again just because a
// transient network blip hit the `recording` stage. Retry is always a
// deliberate click, never automatic — a retry after RECORD_FAILED re-runs
// all four stages and leaves the earlier storage object orphaned, which is
// accepted for this phase but must never happen without the admin asking
// for it.
export default function UploadField({ onUploaded, multiple = true }) {
  const [file, setFile] = useState(null);
  const [altText, setAltText] = useState('');
  // null = no bulk run has started; otherwise the current/last run's state.
  const [run, setRun] = useState(null);
  const {
    status, progress, error, upload,
  } = useMediaUpload();

  const altId = useId();
  const imagesId = useId();
  const folderId = useId();
  const errorId = useId();

  // The hook sets `error` via setState inside its own failure path; this ref
  // mirrors it so the queue can read the just-failed file's reason after a
  // flush, without depending on a stale render-time closure.
  const errorRef = useRef(error);
  useEffect(() => { errorRef.current = error; }, [error]);
  const stopRef = useRef(false);

  const busy = BUSY_STATUSES.includes(status) || Boolean(run?.running);
  const bulkActive = Boolean(run) && run.total > 1;
  const skippedNote = run?.skipped
    ? `Skipped ${run.skipped} non-image file(s).` : null;

  // The classic single-file path, unchanged in effect: applies alt text and
  // drives the per-stage progress + Retry Upload UI below.
  const runSingle = async (candidate) => {
    setRun(null);
    setFile(candidate);
    const result = await upload(candidate, { altText });
    if (result) onUploaded?.(result, candidate);
  };

  const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

  const runQueue = async (images, skipped) => {
    stopRef.current = false;
    const failures = [];
    setRun({
      total: images.length, index: 0, ok: 0, failures, running: true, stopped: false, skipped,
    });
    for (let i = 0; i < images.length; i += 1) {
      if (stopRef.current) break;
      setRun((r) => ({ ...r, index: i }));
      const result = await upload(images[i]);
      if (result) {
        onUploaded?.(result, images[i]);
        setRun((r) => ({ ...r, ok: r.ok + 1 }));
      } else {
        await flush();
        failures.push({ file: images[i], name: images[i].name, message: errorMessage(errorRef.current) });
        setRun((r) => ({ ...r, failures: [...failures] }));
      }
    }
    setRun((r) => ({ ...r, running: false, stopped: stopRef.current }));
  };

  const handleChosen = (fileList) => {
    const all = Array.from(fileList);
    const images = all.filter((f) => f.type.startsWith('image/'));
    const skipped = all.length - images.length;
    if (images.length === 0) {
      setRun({
        total: 0, index: 0, ok: 0, failures: [], running: false, stopped: false, skipped,
      });
      return;
    }
    if (images.length === 1) {
      setRun(skipped ? {
        total: 1, index: 0, ok: 0, failures: [], running: false, stopped: false, skipped,
      } : null);
      runSingle(images[0]);
      return;
    }
    runQueue(images, skipped);
  };

  const onInputChange = (e) => {
    if (e.target.files?.length) handleChosen(e.target.files);
    // Clear so choosing the same files again re-fires change.
    e.target.value = '';
  };

  const handleRetrySingle = () => { if (file && !busy) runSingle(file); };
  const handleRetryFailed = () => {
    const files = (run?.failures ?? []).map((f) => f.file);
    if (files.length) runQueue(files, 0);
  };
  const handleStop = () => { stopRef.current = true; };

  const controlClass = `px-4 py-2.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-xs uppercase tracking-widest font-semibold cursor-pointer hover:bg-offwhite-200 transition-colors ${busy ? 'opacity-60 pointer-events-none' : ''}`;

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={altId}
          className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-semibold"
        >
          Alt Text
        </label>
        <input
          id={altId}
          type="text"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          disabled={busy || bulkActive}
          placeholder="Describe the photograph for screen readers"
          className="w-full px-4 py-3 rounded-lg bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900 disabled:opacity-60"
        />
        {/* Not enforced as required — see the module comment on
            src/lib/queries/media.js's createMedia. For a bulk selection there
            is no single subject to describe, so alt text is a single-upload
            affordance; bulk-uploaded media is flagged in the list to fix
            after the fact, the same way a blank single upload is. */}
        <p className="mt-1 text-xs text-charcoal-500">
          Alt text applies to single uploads — bulk-uploaded photographs are flagged in the media list until one is added.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label htmlFor={imagesId} className={controlClass}>Choose images</label>
        <input
          id={imagesId}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={onInputChange}
          disabled={busy}
          aria-describedby={status === 'error' ? errorId : undefined}
          className="sr-only"
        />
        {multiple && (
          <>
            <label htmlFor={folderId} className={controlClass}>Choose folder</label>
            <input
              id={folderId}
              type="file"
              accept="image/*"
              multiple
              webkitdirectory=""
              onChange={onInputChange}
              disabled={busy}
              className="sr-only"
            />
          </>
        )}
      </div>

      {skippedNote && <p className="text-xs text-charcoal-500">{skippedNote}</p>}

      {bulkActive && run.running && (
        <div aria-live="polite" className="space-y-1">
          <p className="text-xs font-semibold text-pitch-900">
            Uploading {Math.min(run.index + 1, run.total)} of {run.total}…
          </p>
          <progress value={progress} max={100} aria-label="Upload progress" className="w-full h-2" />
          <button
            type="button"
            onClick={handleStop}
            className="mt-1 px-4 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors"
          >
            Stop
          </button>
        </div>
      )}

      {bulkActive && !run.running && (
        <div role="status" className="p-4 rounded-lg border border-pitch-900/20 bg-offwhite-50 space-y-2">
          <p className="text-xs font-bold text-pitch-900">
            {run.ok} uploaded, {run.failures.length} failed:{run.stopped ? ' (stopped)' : ''}
          </p>
          {run.failures.length > 0 && (
            <ul className="text-xs text-charcoal-700 space-y-0.5">
              {run.failures.map((f) => <li key={f.name}>{f.name} — {f.message}</li>)}
            </ul>
          )}
          {run.failures.length > 0 && (
            <button
              type="button"
              onClick={handleRetryFailed}
              className="px-4 py-2 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors"
            >
              Retry failed
            </button>
          )}
        </div>
      )}

      {!bulkActive && busy && (
        <div aria-live="polite" className="space-y-1">
          <p className="text-xs font-semibold text-pitch-900">{PROGRESS_LABELS[status]}</p>
          <progress
            value={progress}
            max={100}
            aria-label="Upload progress"
            className="w-full h-2"
          />
        </div>
      )}

      {!bulkActive && status === 'done' && !busy && (
        <p className="flex items-center gap-2 text-xs font-semibold text-pitch-900">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          Uploaded.
        </p>
      )}

      {!bulkActive && status === 'error' && error && (
        <div
          id={errorId}
          role="alert"
          className="p-4 rounded-lg border border-pitch-900/20 bg-offwhite-50 space-y-2"
        >
          <p className="flex items-center gap-2 text-xs font-bold text-pitch-900">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            Upload failed while {STAGE_NAMES[error.stage] ?? 'processing'}.
          </p>
          <p className="text-xs text-charcoal-700">{errorMessage(error)}</p>
          <button
            type="button"
            onClick={handleRetrySingle}
            disabled={!file}
            className="px-4 py-2 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Retry Upload
          </button>
        </div>
      )}
    </div>
  );
}
