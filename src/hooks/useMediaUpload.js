import { useCallback, useRef, useState } from 'react';
import { resizeImage } from '../lib/images';
import { signUpload, uploadObject, createMedia, MediaError } from '../lib/queries/media';

const IDLE = { status: 'idle', progress: 0, error: null };

// Progress is one checkpoint per pipeline stage, not real byte-level upload
// progress — Task 6's UploadField only needs to show which of the four
// stages is in flight, and a failure freezes progress at wherever it got to
// rather than snapping back to 0, so "how far did this get" stays visible
// alongside the error.
const PROGRESS = { resizing: 10, signing: 35, uploading: 65, recording: 90, done: 100 };

// Owns the three-network-call pipeline a browser upload actually is: resize
// in the browser, ask sign-upload for a presigned URL, PUT the bytes, then
// insert the `media` row. Each of those three network stages fails
// differently and must be told apart — an admin seeing "not allowed" versus
// "too large" versus "storage is misconfigured" is the difference between
// fixing it and giving up — so every error this hook surfaces is tagged with
// the stage it happened in (`error.stage`) on top of whatever typed `code`
// the failing call already carried (ImageError from resizeImage,
// MediaError from signUpload/uploadObject).
//
// The one stage that is not a simple pass-through: a failed `media` insert
// happens *after* uploadObject has already succeeded, so the object is
// already sitting in storage with no row pointing at it — an orphan. Orphan
// reaping is deliberately not built (accepted debt for this phase; see the
// Task 5 brief and the platform design doc). The only thing this hook can do
// about that is guarantee the admin is told the upload did NOT complete —
// status lands on 'error', never 'done' — rather than showing success for a
// photograph the site can never reference.
export function useMediaUpload() {
  const [state, setState] = useState(IDLE);
  const pendingRef = useRef(false);
  const generationRef = useRef(0);

  const upload = useCallback(async (file, { altText } = {}) => {
    if (pendingRef.current) return null;
    pendingRef.current = true;
    const generation = ++generationRef.current;
    const isCurrent = () => generation === generationRef.current;

    let progress = 0;
    const enter = (status) => {
      progress = PROGRESS[status];
      if (isCurrent()) setState({ status, progress, error: null });
    };
    const fail = (err, stage) => {
      err.stage = stage;
      if (isCurrent()) setState({ status: 'error', progress, error: err });
    };

    enter('resizing');
    let resized;
    try {
      resized = await resizeImage(file);
    } catch (err) {
      fail(err, 'resizing');
      pendingRef.current = false;
      return null;
    }

    enter('signing');
    let signed;
    try {
      signed = await signUpload({
        contentType: resized.type,
        byteSize: resized.blob.size,
        fileName: file.name,
      });
    } catch (err) {
      fail(err, 'signing');
      pendingRef.current = false;
      return null;
    }

    enter('uploading');
    try {
      await uploadObject(signed.url, resized.blob, resized.type);
    } catch (err) {
      fail(err, 'uploading');
      pendingRef.current = false;
      return null;
    }

    enter('recording');
    let record;
    try {
      record = await createMedia({
        storagePath: signed.storagePath,
        width: resized.width,
        height: resized.height,
        altText: altText ?? '',
      });
    } catch {
      // See the module comment: the PUT above already succeeded, so this
      // failure leaves an orphaned object in storage. A fresh MediaError is
      // thrown here rather than forwarding createMedia's own error, so the
      // admin always gets the same stable, typed signal regardless of what
      // Postgres said.
      fail(new MediaError('RECORD_FAILED'), 'recording');
      pendingRef.current = false;
      return null;
    }

    if (isCurrent()) setState({ status: 'done', progress: 100, error: null });
    pendingRef.current = false;
    return record;
  }, []);

  const reset = useCallback(() => {
    generationRef.current += 1;
    pendingRef.current = false;
    setState(IDLE);
  }, []);

  return { ...state, upload, reset };
}
