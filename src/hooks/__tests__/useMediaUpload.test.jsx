import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const resizeImage = vi.fn();
const signUpload = vi.fn();
const uploadObject = vi.fn();
const createMedia = vi.fn();

vi.mock('../../lib/images', async () => {
  const actual = await vi.importActual('../../lib/images');
  return { ...actual, resizeImage: (...args) => resizeImage(...args) };
});

vi.mock('../../lib/queries/media', async () => {
  const actual = await vi.importActual('../../lib/queries/media');
  return {
    ...actual,
    signUpload: (...args) => signUpload(...args),
    uploadObject: (...args) => uploadObject(...args),
    createMedia: (...args) => createMedia(...args),
  };
});

const { useMediaUpload } = await import('../useMediaUpload.js');
const { ImageError } = await import('../../lib/images');
const { MediaError } = await import('../../lib/queries/media');

const FILE = new File(['stub-bytes'], 'photo.jpg', { type: 'image/jpeg' });
const RESIZED = { blob: new Blob(['stub']), width: 2000, height: 1500, type: 'image/webp' };
const SIGNED = { url: 'https://storage.test/uploads/abc.webp?sig=1', storagePath: 'uploads/abc.webp' };
const MEDIA_ROW = {
  id: 'media-1', storagePath: 'uploads/abc.webp', width: 2000, height: 1500,
  altText: 'A couple at dusk.', blurhash: null, createdAt: '2026-08-01T10:00:00Z',
};

beforeEach(() => {
  resizeImage.mockReset();
  signUpload.mockReset();
  uploadObject.mockReset();
  createMedia.mockReset();
});

describe('useMediaUpload', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useMediaUpload());
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBe(0);
  });

  it('advances through resizing, signing, uploading, recording, then done on a full success', async () => {
    const seen = [];
    let resolveResize;
    resizeImage.mockReturnValue(new Promise((r) => { resolveResize = r; }));
    signUpload.mockResolvedValue(SIGNED);
    uploadObject.mockResolvedValue(undefined);
    createMedia.mockResolvedValue(MEDIA_ROW);

    const { result } = renderHook(() => useMediaUpload());

    let outcome;
    act(() => {
      result.current.upload(FILE, { altText: 'A couple at dusk.' }).then((v) => { outcome = v; });
    });
    await waitFor(() => expect(result.current.status).toBe('resizing'));
    seen.push(result.current.status);

    await act(async () => { resolveResize(RESIZED); });
    await waitFor(() => expect(result.current.status).toBe('done'));

    expect(resizeImage).toHaveBeenCalledWith(FILE);
    expect(signUpload).toHaveBeenCalledWith({
      contentType: 'image/webp', byteSize: RESIZED.blob.size, fileName: 'photo.jpg',
    });
    expect(uploadObject).toHaveBeenCalledWith(SIGNED.url, RESIZED.blob, 'image/webp');
    expect(createMedia).toHaveBeenCalledWith({
      storagePath: 'uploads/abc.webp', width: 2000, height: 1500, altText: 'A couple at dusk.',
    });
    expect(result.current.progress).toBe(100);
    expect(result.current.error).toBeNull();
    expect(outcome).toEqual(MEDIA_ROW);
  });

  it('defaults altText to an empty string when none is given', async () => {
    resizeImage.mockResolvedValue(RESIZED);
    signUpload.mockResolvedValue(SIGNED);
    uploadObject.mockResolvedValue(undefined);
    createMedia.mockResolvedValue(MEDIA_ROW);

    const { result } = renderHook(() => useMediaUpload());
    await act(async () => { await result.current.upload(FILE); });

    expect(createMedia).toHaveBeenCalledWith(expect.objectContaining({ altText: '' }));
  });

  it('a resize failure leaves status at error with the resize-stage error, and calls nothing else', async () => {
    resizeImage.mockRejectedValue(new ImageError('NOT_AN_IMAGE'));

    const { result } = renderHook(() => useMediaUpload());
    const outcome = await act(async () => result.current.upload(FILE));

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeInstanceOf(ImageError);
    expect(result.current.error.code).toBe('NOT_AN_IMAGE');
    expect(result.current.error.stage).toBe('resizing');
    expect(signUpload).not.toHaveBeenCalled();
    expect(uploadObject).not.toHaveBeenCalled();
    expect(createMedia).not.toHaveBeenCalled();
    expect(outcome).toBeNull();
  });

  it('a signing failure leaves status at error with the signing-stage error, and never PUTs bytes', async () => {
    resizeImage.mockResolvedValue(RESIZED);
    signUpload.mockRejectedValue(new MediaError('FORBIDDEN'));

    const { result } = renderHook(() => useMediaUpload());
    await act(async () => { await result.current.upload(FILE); });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeInstanceOf(MediaError);
    expect(result.current.error.code).toBe('FORBIDDEN');
    expect(result.current.error.stage).toBe('signing');
    expect(uploadObject).not.toHaveBeenCalled();
    expect(createMedia).not.toHaveBeenCalled();
  });

  it('a PUT failure leaves status at error with the uploading-stage error, and never records a row', async () => {
    resizeImage.mockResolvedValue(RESIZED);
    signUpload.mockResolvedValue(SIGNED);
    uploadObject.mockRejectedValue(new MediaError('UPLOAD_FAILED'));

    const { result } = renderHook(() => useMediaUpload());
    await act(async () => { await result.current.upload(FILE); });

    expect(result.current.status).toBe('error');
    expect(result.current.error.code).toBe('UPLOAD_FAILED');
    expect(result.current.error.stage).toBe('uploading');
    expect(createMedia).not.toHaveBeenCalled();
  });

  // The distinguishing case: bytes are already in storage (uploadObject
  // resolved) when the media insert fails. That leaves an orphaned object —
  // storage holds it, but no `media` row will ever point at it. Orphan
  // reaping is deliberately not built (accepted debt; see the Task 5 brief
  // and the platform design doc), so this test only asserts the admin-facing
  // half of that trade-off: the hook must report the upload as incomplete
  // (status 'error', a distinct RECORD_FAILED code tagged with the
  // 'recording' stage) rather than a false 'done'.
  it('a failed media insert after a successful PUT reports incompletion, not a false success', async () => {
    resizeImage.mockResolvedValue(RESIZED);
    signUpload.mockResolvedValue(SIGNED);
    uploadObject.mockResolvedValue(undefined);
    createMedia.mockRejectedValue(new Error('createMedia: permission denied'));

    const { result } = renderHook(() => useMediaUpload());
    const outcome = await act(async () => result.current.upload(FILE));

    expect(uploadObject).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('error');
    expect(result.current.status).not.toBe('done');
    expect(result.current.error.code).toBe('RECORD_FAILED');
    expect(result.current.error.stage).toBe('recording');
    expect(outcome).toBeNull();
  });

  it('ignores a second upload call while the first is still in flight', async () => {
    let resolveResize;
    resizeImage.mockReturnValue(new Promise((r) => { resolveResize = r; }));
    signUpload.mockResolvedValue(SIGNED);
    uploadObject.mockResolvedValue(undefined);
    createMedia.mockResolvedValue(MEDIA_ROW);

    const { result } = renderHook(() => useMediaUpload());

    let firstOutcome;
    let secondOutcome;
    act(() => {
      result.current.upload(FILE).then((v) => { firstOutcome = v; });
    });
    await waitFor(() => expect(result.current.status).toBe('resizing'));

    await act(async () => { secondOutcome = await result.current.upload(FILE); });
    expect(resizeImage).toHaveBeenCalledTimes(1);
    expect(secondOutcome).toBeNull();

    await act(async () => { resolveResize(RESIZED); });
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(firstOutcome).toEqual(MEDIA_ROW);
  });

  it('reset returns to idle and clears the error and progress', async () => {
    resizeImage.mockRejectedValue(new ImageError('DECODE_FAILED'));

    const { result } = renderHook(() => useMediaUpload());
    await act(async () => { await result.current.upload(FILE); });
    expect(result.current.status).toBe('error');

    act(() => { result.current.reset(); });

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBe(0);
  });

  it('does not let a stale response overwrite state after reset', async () => {
    let resolveResize;
    resizeImage.mockReturnValue(new Promise((r) => { resolveResize = r; }));

    const { result } = renderHook(() => useMediaUpload());
    act(() => { result.current.upload(FILE); });
    await waitFor(() => expect(result.current.status).toBe('resizing'));

    act(() => { result.current.reset(); });
    expect(result.current.status).toBe('idle');

    await act(async () => { resolveResize(RESIZED); });

    // The stale resize resolution must not resurrect a status the admin has
    // already moved on from.
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
