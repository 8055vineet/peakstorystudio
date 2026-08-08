import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import {
  render, screen, waitFor, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const listCollectionItems = vi.fn();
const addCollectionPhoto = vi.fn();
const addCollectionVideo = vi.fn();
const removeCollectionItem = vi.fn();
const reorderCollectionItems = vi.fn();
vi.mock('../../lib/queries/adminCollectionItems', () => ({
  listCollectionItems: (...args) => listCollectionItems(...args),
  addCollectionPhoto: (...args) => addCollectionPhoto(...args),
  addCollectionVideo: (...args) => addCollectionVideo(...args),
  removeCollectionItem: (...args) => removeCollectionItem(...args),
  reorderCollectionItems: (...args) => reorderCollectionItems(...args),
}));

const listMedia = vi.fn();
vi.mock('../../lib/queries/media', () => ({
  listMedia: (...args) => listMedia(...args),
}));

const useMediaUpload = vi.fn();
vi.mock('../../hooks/useMediaUpload', () => ({
  useMediaUpload: (...args) => useMediaUpload(...args),
}));

const PHOTO_ITEM = {
  id: 'item-a', mediaId: 'media-a', videoEmbedUrl: null, caption: null, sortOrder: 0, storagePath: 'uploads/a.webp', altText: 'Photo A',
};
const VIDEO_ITEM = {
  id: 'item-b', mediaId: null, videoEmbedUrl: 'https://www.youtube.com/embed/x', caption: 'Teaser', sortOrder: 1, storagePath: null, altText: '',
};

const LIBRARY_ITEM = {
  id: 'media-c', storagePath: 'uploads/c.webp', width: 800, height: 600, altText: 'Photo C', blurhash: null, createdAt: '2026-08-01T10:00:00Z',
};

beforeEach(() => {
  vi.resetModules();
  listCollectionItems.mockReset();
  addCollectionPhoto.mockReset();
  addCollectionVideo.mockReset();
  removeCollectionItem.mockReset();
  reorderCollectionItems.mockReset();
  listMedia.mockReset();
  useMediaUpload.mockReset();

  listCollectionItems.mockResolvedValue([]);
  listMedia.mockResolvedValue([]);
  useMediaUpload.mockReturnValue({
    status: 'idle', progress: 0, error: null, upload: vi.fn(), reset: vi.fn(),
  });
});

async function renderItems(props = {}, baseUrl = 'https://cdn.peakstorystudio.test') {
  vi.stubEnv('VITE_MEDIA_BASE_URL', baseUrl);
  const { default: CollectionItems } = await import('../CollectionItems.jsx');
  return render(<CollectionItems collectionId="c-1" {...props} />);
}

function attachedItemsList() {
  return within(screen.getByRole('list', { name: /this page's items/i }));
}

describe('CollectionItems', () => {
  it('lists items in order — photos as images, videos with a badge and caption', async () => {
    listCollectionItems.mockResolvedValue([PHOTO_ITEM, VIDEO_ITEM]);

    await renderItems();

    await waitFor(() => expect(attachedItemsList().getAllByRole('listitem')).toHaveLength(2));
    expect(attachedItemsList().getByAltText('Photo A')).toBeInTheDocument();
    expect(attachedItemsList().getByText('Video')).toBeInTheDocument();
    expect(attachedItemsList().getByText('Teaser')).toBeInTheDocument();
    expect(listCollectionItems).toHaveBeenCalledWith('c-1');
  });

  it('attaches photographs through the dialog, which stays open for more', async () => {
    const user = userEvent.setup();
    listMedia.mockResolvedValue([LIBRARY_ITEM]);
    listCollectionItems.mockResolvedValueOnce([]);
    addCollectionPhoto.mockResolvedValue({ ...PHOTO_ITEM, id: 'item-new', mediaId: 'media-c' });

    await renderItems();
    await waitFor(() => expect(screen.getByText(/no items on this page yet/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add photographs/i }));
    const dialog = await screen.findByRole('dialog', { name: /add photographs to this page/i });

    listCollectionItems.mockResolvedValueOnce([{ ...PHOTO_ITEM, id: 'item-new', mediaId: 'media-c', altText: 'Photo C' }]);
    await user.click(await within(dialog).findByRole('button', { name: /^select$/i }));

    expect(addCollectionPhoto).toHaveBeenCalledWith('c-1', 'media-c');
    expect(screen.getByRole('dialog', { name: /add photographs to this page/i })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('marks an already-attached photograph as selected and never adds it twice', async () => {
    const user = userEvent.setup();
    listMedia.mockResolvedValue([{ ...LIBRARY_ITEM, id: 'media-a', altText: 'Photo A' }]);
    listCollectionItems.mockResolvedValue([PHOTO_ITEM]);

    await renderItems();
    await waitFor(() => expect(attachedItemsList().getAllByRole('listitem')).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: /add photographs/i }));
    const dialog = await screen.findByRole('dialog', { name: /add photographs to this page/i });

    await user.click(await within(dialog).findByRole('button', { name: /✓ selected/i }));
    expect(addCollectionPhoto).not.toHaveBeenCalled();
  });

  it('refuses a link that is neither a YouTube link nor an http(s) URL', async () => {
    const user = userEvent.setup();
    await renderItems();
    await waitFor(() => expect(screen.getByText(/no items on this page yet/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add video/i }));
    await user.type(screen.getByLabelText(/video link/i), 'not-a-url');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/paste a youtube link/i);
    expect(addCollectionVideo).not.toHaveBeenCalled();
  });

  it('adds a valid video with its caption', async () => {
    const user = userEvent.setup();
    addCollectionVideo.mockResolvedValue(VIDEO_ITEM);
    await renderItems();
    await waitFor(() => expect(screen.getByText(/no items on this page yet/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add video/i }));
    await user.type(screen.getByLabelText(/video link/i), 'https://www.youtube.com/embed/x');
    await user.type(screen.getByLabelText(/caption/i), 'Teaser');
    listCollectionItems.mockResolvedValueOnce([VIDEO_ITEM]);
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => expect(addCollectionVideo).toHaveBeenCalledWith('c-1', {
      videoEmbedUrl: 'https://www.youtube.com/embed/x', posterMediaId: null, caption: 'Teaser',
    }));
  });

  it('normalizes a pasted YouTube share link to an embed URL', async () => {
    const user = userEvent.setup();
    addCollectionVideo.mockResolvedValue(VIDEO_ITEM);
    await renderItems();
    await waitFor(() => expect(screen.getByText(/no items on this page yet/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add video/i }));
    await user.type(screen.getByLabelText(/video link/i), 'https://youtu.be/4KEZRGlwJU4');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => expect(addCollectionVideo).toHaveBeenCalledWith('c-1', expect.objectContaining({
      videoEmbedUrl: expect.stringContaining('/embed/4KEZRGlwJU4'),
    })));
  });

  it('removes an item after confirm — the photograph itself is kept', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    listCollectionItems.mockResolvedValueOnce([PHOTO_ITEM]);
    removeCollectionItem.mockResolvedValue({ id: 'item-a' });

    await renderItems();
    await waitFor(() => expect(attachedItemsList().getAllByRole('listitem')).toHaveLength(1));

    listCollectionItems.mockResolvedValueOnce([]);
    await user.click(screen.getByRole('button', { name: /remove/i }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/stay in the media library/i));
    expect(removeCollectionItem).toHaveBeenCalledWith('item-a');
    confirmSpy.mockRestore();
  });

  it('reorders with the arrows', async () => {
    const user = userEvent.setup();
    listCollectionItems.mockResolvedValue([PHOTO_ITEM, VIDEO_ITEM]);
    reorderCollectionItems.mockResolvedValue({ ok: true });

    await renderItems();
    await waitFor(() => expect(attachedItemsList().getAllByRole('listitem')).toHaveLength(2));

    await user.click(screen.getByRole('button', { name: /move down: photo a/i }));

    expect(reorderCollectionItems).toHaveBeenCalledWith(['item-b', 'item-a']);
  });
});
