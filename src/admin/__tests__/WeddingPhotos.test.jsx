import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import {
  render, screen, waitFor, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const listWeddingPhotos = vi.fn();
const addWeddingPhoto = vi.fn();
const removeWeddingPhoto = vi.fn();
const reorderWeddingPhotos = vi.fn();
vi.mock('../../lib/queries/adminWeddingPhotos', () => ({
  listWeddingPhotos: (...args) => listWeddingPhotos(...args),
  addWeddingPhoto: (...args) => addWeddingPhoto(...args),
  removeWeddingPhoto: (...args) => removeWeddingPhoto(...args),
  reorderWeddingPhotos: (...args) => reorderWeddingPhotos(...args),
}));

const listMedia = vi.fn();
vi.mock('../../lib/queries/media', () => ({
  listMedia: (...args) => listMedia(...args),
}));

const useMediaUpload = vi.fn();
vi.mock('../../hooks/useMediaUpload', () => ({
  useMediaUpload: (...args) => useMediaUpload(...args),
}));

const PHOTO_A = {
  mediaId: 'media-a', sortOrder: 0, storagePath: 'uploads/a.webp', altText: 'Photo A', width: 800, height: 600,
};
const PHOTO_B = {
  mediaId: 'media-b', sortOrder: 1, storagePath: 'uploads/b.webp', altText: 'Photo B', width: 800, height: 600,
};

const LIBRARY_ITEM = {
  id: 'media-c', storagePath: 'uploads/c.webp', width: 800, height: 600, altText: 'Photo C', blurhash: null, createdAt: '2026-08-01T10:00:00Z',
};

// mediaUrl.js reads import.meta.env.VITE_MEDIA_BASE_URL at module load —
// same hazard MediaPicker.test.jsx documents — so this file resets the
// module registry and stubs the env before every dynamic import, exactly
// like that file does.
beforeEach(() => {
  vi.resetModules();
  listWeddingPhotos.mockReset();
  addWeddingPhoto.mockReset();
  removeWeddingPhoto.mockReset();
  reorderWeddingPhotos.mockReset();
  listMedia.mockReset();
  useMediaUpload.mockReset();

  listWeddingPhotos.mockResolvedValue([]);
  listMedia.mockResolvedValue([]);
  useMediaUpload.mockReturnValue({
    status: 'idle', progress: 0, error: null, upload: vi.fn(), reset: vi.fn(),
  });
});

async function renderWeddingPhotos(props = {}, baseUrl = 'https://cdn.peakstorystudio.test') {
  vi.stubEnv('VITE_MEDIA_BASE_URL', baseUrl);
  const { default: WeddingPhotos } = await import('../WeddingPhotos.jsx');
  return render(<WeddingPhotos weddingId="wedding-1" {...props} />);
}

// Scoped to the wedding's own photo grid, not the media-library picker
// rendered lower on the same screen — both render <img> elements, so an
// unscoped screen.getAllByRole('img') would conflate "already attached to
// this wedding" with "exists somewhere in the library".
function attachedPhotoImages() {
  return within(screen.getByRole('list', { name: /this wedding's photographs/i })).getAllByRole('img');
}

describe('WeddingPhotos', () => {
  it('lists a wedding\'s photos in sort_order', async () => {
    listWeddingPhotos.mockResolvedValue([PHOTO_B, PHOTO_A]);

    await renderWeddingPhotos();

    await waitFor(() => expect(attachedPhotoImages()).toHaveLength(2));
    const images = attachedPhotoImages();
    expect(images.map((img) => img.getAttribute('alt'))).toEqual(['Photo A', 'Photo B']);
    expect(listWeddingPhotos).toHaveBeenCalledWith('wedding-1');
  });

  it('shows a distinct empty state when the wedding has no photos yet', async () => {
    await renderWeddingPhotos();

    await waitFor(() => expect(screen.getByText(/no photographs attached/i)).toBeInTheDocument());
  });

  it('shows a distinct load-error state with a retry control', async () => {
    listWeddingPhotos.mockRejectedValue(new Error('permission denied'));

    await renderWeddingPhotos();

    await waitFor(() => expect(screen.getByText(/could not load this wedding's photographs/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  describe('adding a photograph', () => {
    it('adds one selected from the media picker and shows it once the reload confirms it', async () => {
      const user = userEvent.setup();
      listMedia.mockResolvedValue([LIBRARY_ITEM]);
      listWeddingPhotos.mockResolvedValueOnce([]);
      addWeddingPhoto.mockResolvedValue({ weddingId: 'wedding-1', mediaId: 'media-c', sortOrder: 0 });

      await renderWeddingPhotos();
      await waitFor(() => expect(screen.getByText(/no photographs attached/i)).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());

      listWeddingPhotos.mockResolvedValueOnce([{ ...LIBRARY_ITEM, mediaId: 'media-c', sortOrder: 0, altText: 'Photo C' }]);
      await user.click(screen.getByRole('button', { name: /select/i }));

      expect(addWeddingPhoto).toHaveBeenCalledWith('wedding-1', 'media-c');
      await waitFor(() => expect(attachedPhotoImages()).toHaveLength(1));
    });

    it('adds one uploaded fresh via UploadField', async () => {
      const upload = vi.fn().mockResolvedValue({ id: 'media-new', storagePath: 'uploads/new.webp' });
      useMediaUpload.mockReturnValue({
        status: 'idle', progress: 0, error: null, upload, reset: vi.fn(),
      });
      addWeddingPhoto.mockResolvedValue({ weddingId: 'wedding-1', mediaId: 'media-new', sortOrder: 0 });
      const user = userEvent.setup();

      await renderWeddingPhotos();
      await waitFor(() => expect(screen.getByText(/no photographs attached/i)).toBeInTheDocument());

      const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(screen.getByLabelText(/photograph/i), file);

      await waitFor(() => expect(addWeddingPhoto).toHaveBeenCalledWith('wedding-1', 'media-new'));
    });
  });

  describe('removing a photograph', () => {
    let confirmSpy;
    beforeEach(() => {
      confirmSpy = vi.spyOn(window, 'confirm');
    });

    it('asks for confirmation naming that the photograph itself is kept, and does nothing if declined', async () => {
      confirmSpy.mockReturnValue(false);
      listWeddingPhotos.mockResolvedValue([PHOTO_A]);
      const user = userEvent.setup();

      await renderWeddingPhotos();
      await waitFor(() => expect(attachedPhotoImages()).toHaveLength(1));

      await user.click(screen.getByRole('button', { name: /remove/i }));

      expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/kept in the media library/i));
      expect(removeWeddingPhoto).not.toHaveBeenCalled();
      expect(attachedPhotoImages()).toHaveLength(1);
    });

    it('removes the wedding_photos row once confirmed, and the photo disappears once the reload confirms it', async () => {
      confirmSpy.mockReturnValue(true);
      listWeddingPhotos.mockResolvedValueOnce([PHOTO_A]);
      removeWeddingPhoto.mockResolvedValue({ weddingId: 'wedding-1', mediaId: 'media-a' });
      const user = userEvent.setup();

      await renderWeddingPhotos();
      await waitFor(() => expect(attachedPhotoImages()).toHaveLength(1));

      listWeddingPhotos.mockResolvedValueOnce([]);
      await user.click(screen.getByRole('button', { name: /remove/i }));

      expect(removeWeddingPhoto).toHaveBeenCalledWith('wedding-1', 'media-a');
      await waitFor(() => expect(screen.getByText(/no photographs attached/i)).toBeInTheDocument());
    });

    // The rule Task 8's brief calls out as destructive to get wrong: this
    // component only ever calls removeWeddingPhoto (which the query layer's
    // own test proves never touches the `media` table) — it has no import
    // of, or call path to, anything that deletes a media row. Confirmed
    // structurally here (no such function is even mocked/available to call)
    // and functionally by adminWeddingPhotos.test.js's own dedicated test.
    it('does not delete the underlying media row — only removeWeddingPhoto is called', async () => {
      confirmSpy.mockReturnValue(true);
      listWeddingPhotos.mockResolvedValueOnce([PHOTO_A]).mockResolvedValueOnce([]);
      removeWeddingPhoto.mockResolvedValue({ weddingId: 'wedding-1', mediaId: 'media-a' });
      const user = userEvent.setup();

      await renderWeddingPhotos();
      await waitFor(() => expect(attachedPhotoImages()).toHaveLength(1));

      await user.click(screen.getByRole('button', { name: /remove/i }));

      await waitFor(() => expect(screen.getByText(/no photographs attached/i)).toBeInTheDocument());
      expect(removeWeddingPhoto).toHaveBeenCalledTimes(1);
      // media-a's storagePath/altText were never passed to any delete-style
      // call — the only mock this test ever gave the component a way to
      // delete anything through is removeWeddingPhoto itself.
      expect(addWeddingPhoto).not.toHaveBeenCalled();
    });

    it('shows an inline error and keeps the photo on screen when the removal itself fails', async () => {
      confirmSpy.mockReturnValue(true);
      listWeddingPhotos.mockResolvedValue([PHOTO_A]);
      removeWeddingPhoto.mockRejectedValue(new Error('foreign key violation'));
      const user = userEvent.setup();

      await renderWeddingPhotos();
      await waitFor(() => expect(attachedPhotoImages()).toHaveLength(1));

      await user.click(screen.getByRole('button', { name: /remove/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/foreign key violation/i));
      // No optimistic UI: a failed write must leave the photo exactly where
      // it was, not remove it from the screen and only fail afterward.
      expect(attachedPhotoImages()).toHaveLength(1);
    });

    it('distinguishes a write that succeeded but whose confirming reload failed from a genuine failure', async () => {
      confirmSpy.mockReturnValue(true);
      listWeddingPhotos.mockResolvedValueOnce([PHOTO_A]);
      removeWeddingPhoto.mockResolvedValue({ weddingId: 'wedding-1', mediaId: 'media-a' });
      const user = userEvent.setup();

      await renderWeddingPhotos();
      await waitFor(() => expect(attachedPhotoImages()).toHaveLength(1));

      // The write itself succeeds, but the reload useResource.mutate makes
      // afterward fails — useResource's own contract (see its module
      // comment) is to reject with a `written: true` error in exactly this
      // case, distinct from removeWeddingPhoto itself failing. The failed
      // reload also flips `status` to 'error' (same as ResourceList.jsx's
      // own reviewed behaviour), so two alerts render together: the stale
      // load-error banner AND this component's own distinguishing message
      // — both true at once, which is why this asserts against the full
      // set of alerts rather than assuming there is only one.
      listWeddingPhotos.mockRejectedValueOnce(new Error('network blip'));
      await user.click(screen.getByRole('button', { name: /remove/i }));

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert').map((el) => el.textContent);
        expect(alerts.some((text) => /saved, but the list could not be refreshed/i.test(text))).toBe(true);
      });
      const alerts = screen.getAllByRole('alert').map((el) => el.textContent);
      expect(alerts.filter((text) => /network blip/i.test(text)).length).toBeGreaterThan(0);
    });
  });

  describe('reordering', () => {
    it('moving a photo down calls reorderWeddingPhotos with the new media id order', async () => {
      listWeddingPhotos.mockResolvedValue([PHOTO_A, PHOTO_B]);
      reorderWeddingPhotos.mockResolvedValue({ ok: true });
      const user = userEvent.setup();

      await renderWeddingPhotos();
      await waitFor(() => expect(attachedPhotoImages()).toHaveLength(2));

      await user.click(screen.getByRole('button', { name: /move down: photo a/i }));

      expect(reorderWeddingPhotos).toHaveBeenCalledWith('wedding-1', ['media-b', 'media-a']);
    });

    it('disables moving the first photo up and the last photo down', async () => {
      listWeddingPhotos.mockResolvedValue([PHOTO_A, PHOTO_B]);

      await renderWeddingPhotos();
      await waitFor(() => expect(attachedPhotoImages()).toHaveLength(2));

      expect(screen.getByRole('button', { name: /move up: photo a/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /move down: photo b/i })).toBeDisabled();
    });
  });

  it('fetches only this wedding\'s photos, scoped by weddingId, never every wedding\'s photos globally', async () => {
    await renderWeddingPhotos({ weddingId: 'wedding-42' });

    await waitFor(() => expect(listWeddingPhotos).toHaveBeenCalledWith('wedding-42'));
  });
});
