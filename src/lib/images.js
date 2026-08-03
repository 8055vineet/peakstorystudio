// Pure browser image utility: resize, re-encode, and report the resulting
// dimensions. Deliberately free of React and of the Supabase client — the
// hook that drives the upload pipeline (src/hooks/useMediaUpload.js) is the
// only consumer today, but Task 11's end-to-end gate reuses fitWithin's
// dimension logic directly, so this module must stay importable on its own.

export class ImageError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ImageError';
    this.code = code;
  }
}

// Scales the longest edge down to maxEdge, preserving aspect ratio, and
// NEVER scales up: enlarging a small photograph adds bytes and invents
// detail that was never there. An image already within the cap is still
// re-encoded, so the output format is predictable for every upload.
export function fitWithin(width, height, maxEdge) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function resizeImage(file, { maxEdge = 2000, type = 'image/webp', quality = 0.82 } = {}) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new ImageError('NOT_AN_IMAGE');
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // A file can claim image/png in its type and still be undecodable.
    throw new ImageError('DECODE_FAILED');
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new ImageError('ENCODE_FAILED');

  // Dimensions come from the canvas we actually drew, not from the source,
  // so what is recorded in `media` always matches the bytes uploaded.
  return { blob, width, height, type };
}
