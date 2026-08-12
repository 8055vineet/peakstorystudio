import { supabase } from '../supabase';

// The three network stages the upload pipeline in src/hooks/useMediaUpload.js
// drives, in order: signUpload asks the Edge Function for a presigned PUT,
// uploadObject performs that PUT against storage directly (never through
// Supabase), and createMedia (below, with listMedia/updateMediaAltText)
// records the row Postgres and RLS actually govern.

export class MediaError extends Error {
  constructor(code, details) {
    super(code);
    this.name = 'MediaError';
    this.code = code;
    // Only the 413 FILE_TOO_LARGE body carries maxBytes and only the 415
    // UNSUPPORTED_TYPE body carries allowed; every other code leaves both
    // undefined. See supabase/functions/sign-upload/index.js for the full
    // response table this mirrors.
    this.maxBytes = details?.maxBytes;
    this.allowed = details?.allowed;
  }
}

async function readErrorBody(error) {
  // Mirrors src/lib/queries/inquiries.js's readErrorBody: supabase-js wraps
  // a non-2xx as FunctionsHttpError and hangs the original Response off
  // .context; a network failure (DNS, offline) carries no context at all.
  try {
    return await error?.context?.json?.();
  } catch {
    return null;
  }
}

// Asks sign-upload for a one-time, presigned PUT URL. Never touches the
// file's bytes itself — see supabase/functions/sign-upload/index.js's module
// comment for why the function is designed that way. Every typed response it
// can send (400/401/403/413/415/500) is surfaced here as a distinct
// MediaError code rather than collapsed into a generic failure, so the admin
// sees "not allowed" versus "too large" versus "storage is misconfigured".
export async function signUpload({ contentType, byteSize, fileName }) {
  const { data, error } = await supabase.functions.invoke('sign-upload', {
    body: { contentType, byteSize, fileName },
  });

  if (error) {
    const body = await readErrorBody(error);
    throw new MediaError(body?.error ?? 'NETWORK_ERROR', body);
  }

  if (!data?.ok) {
    throw new MediaError(data?.error ?? 'SERVER_ERROR', data);
  }

  return { url: data.url, storagePath: data.storagePath };
}

// The PUT itself. This goes straight from the browser to storage — the
// presigned URL already names a browser-reachable host (verified in Task
// 4's testing) — never back through Supabase or this app's own server, so a
// plain fetch is the whole implementation.
//
// Sends the exact Content-Type the URL was signed for. Only `host` is
// signed against local storage, so a mismatch happens not to break the
// signature there — but that is untested against R2, and other S3
// implementations do sign Content-Type. Match them regardless of what this
// backend happens to tolerate today.
export async function uploadObject(url, blob, contentType) {
  let response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
  } catch {
    throw new MediaError('UPLOAD_FAILED');
  }

  if (!response.ok) {
    throw new MediaError('UPLOAD_FAILED');
  }
}

const MEDIA_SELECT = 'id, storage_path, width, height, alt_text, blurhash, created_at';

function toMedia(row) {
  return {
    id: row.id,
    storagePath: row.storage_path,
    width: row.width,
    height: row.height,
    altText: row.alt_text,
    blurhash: row.blurhash,
    createdAt: row.created_at,
  };
}

// Records a `media` row for an object that must already be sitting in
// storage — call this only after uploadObject has already succeeded. A
// failure here (unlike a failure in signUpload or uploadObject) leaves an
// orphaned object with nothing in Postgres pointing at it; this function
// throws a plain Error, same convention as every other write in
// src/lib/queries/ (see adminInquiries.js's updateInquiryStatus). It is
// src/hooks/useMediaUpload.js's job to turn that into a distinct, typed
// signal that the admin's upload did not complete.
export async function createMedia({ storagePath, width, height, altText }) {
  const { data, error } = await supabase
    .from('media')
    .insert({ storage_path: storagePath, width, height, alt_text: altText ?? '' })
    .select(MEDIA_SELECT)
    .single();

  if (error) throw new Error(`createMedia: ${error.message}`);
  return toMedia(data);
}

// Newest first, same rationale as adminInquiries.js's listInquiries: an
// admin picking a photo to attach should see what was just uploaded, not
// have it buried under the seed data.
export async function listMedia() {
  const { data, error } = await supabase
    .from('media')
    .select(MEDIA_SELECT)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`listMedia: ${error.message}`);
  return (data ?? []).map(toMedia);
}

// Permanent deletion, through the delete-media Edge Function — the browser
// never holds a storage credential, and Postgres's own foreign keys are what
// refuse deleting a photograph something still uses (surfaced as the IN_USE
// code). Response mapping mirrors signUpload: every typed response
// (400/401/403/404/409/500) becomes a distinct MediaError code.
export async function deleteMedia(id) {
  const { data, error } = await supabase.functions.invoke('delete-media', {
    body: { mediaId: id },
  });

  if (error) {
    const body = await readErrorBody(error);
    throw new MediaError(body?.error ?? 'NETWORK_ERROR', body);
  }

  if (!data?.ok) {
    throw new MediaError(data?.error ?? 'SERVER_ERROR', data);
  }

  return { id, objectDeleted: data.objectDeleted ?? null };
}

export async function updateMediaAltText(id, altText) {
  const { data, error } = await supabase
    .from('media')
    .update({ alt_text: altText })
    .eq('id', id)
    .select(MEDIA_SELECT)
    .single();

  if (error) throw new Error(`updateMediaAltText(${id}): ${error.message}`);
  return toMedia(data);
}
