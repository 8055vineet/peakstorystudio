import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useMediaUpload = vi.fn();

// Mocked exactly the way Task 3's component tests mock their data layer
// (see App.test.jsx's useSession mock): UploadField is a presentational
// owner of one upload, and this test exercises its wiring to the hook's
// contract, not the pipeline the hook itself already proves in
// src/hooks/__tests__/useMediaUpload.test.jsx.
vi.mock('../../hooks/useMediaUpload', () => ({
  useMediaUpload: (...args) => useMediaUpload(...args),
}));

const { default: UploadField } = await import('../UploadField.jsx');

const FILE = new File(['stub-bytes'], 'photo.jpg', { type: 'image/jpeg' });
const MEDIA_ROW = {
  id: 'media-1',
  storagePath: 'uploads/abc.webp',
  width: 2000,
  height: 1500,
  altText: 'A couple at dusk.',
  blurhash: null,
  createdAt: '2026-08-01T10:00:00Z',
};

const IDLE = {
  status: 'idle', progress: 0, error: null, reset: vi.fn(),
};

beforeEach(() => {
  useMediaUpload.mockReset();
  useMediaUpload.mockReturnValue({ ...IDLE, upload: vi.fn() });
});

describe('UploadField', () => {
  it('wires the alt-text and file labels to their inputs with htmlFor/id', () => {
    render(<UploadField onUploaded={vi.fn()} />);

    expect(screen.getByLabelText(/alt text/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/choose images/i)).toHaveAttribute('type', 'file');
  });

  it('calls upload with the chosen file and the currently typed alt text', async () => {
    const upload = vi.fn().mockResolvedValue(MEDIA_ROW);
    useMediaUpload.mockReturnValue({ ...IDLE, upload });
    const user = userEvent.setup();
    render(<UploadField onUploaded={vi.fn()} />);

    await user.type(screen.getByLabelText(/alt text/i), 'A couple at dusk.');
    await user.upload(screen.getByLabelText(/choose images/i), FILE);

    expect(upload).toHaveBeenCalledWith(FILE, { altText: 'A couple at dusk.' });
  });

  it('calls onUploaded with the returned media row once the upload resolves', async () => {
    const upload = vi.fn().mockResolvedValue(MEDIA_ROW);
    useMediaUpload.mockReturnValue({ ...IDLE, upload });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(<UploadField onUploaded={onUploaded} />);

    await user.upload(screen.getByLabelText(/choose images/i), FILE);

    expect(onUploaded).toHaveBeenCalledWith(MEDIA_ROW, expect.any(File));
  });

  it('does not call onUploaded when upload resolves null (a failed attempt)', async () => {
    const upload = vi.fn().mockResolvedValue(null);
    useMediaUpload.mockReturnValue({ ...IDLE, upload });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(<UploadField onUploaded={onUploaded} />);

    await user.upload(screen.getByLabelText(/choose images/i), FILE);

    expect(onUploaded).not.toHaveBeenCalled();
  });

  it('shows progress and disables both inputs while a stage is in flight', () => {
    useMediaUpload.mockReturnValue({
      status: 'uploading', progress: 65, error: null, reset: vi.fn(), upload: vi.fn(),
    });
    render(<UploadField onUploaded={vi.fn()} />);

    expect(screen.getByLabelText(/alt text/i)).toBeDisabled();
    expect(screen.getByLabelText(/choose images/i)).toBeDisabled();
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('value', '65');
  });

  it('a failure shows which stage failed and offers retry without re-choosing the file', async () => {
    const upload = vi.fn().mockResolvedValue(MEDIA_ROW);
    useMediaUpload.mockReturnValue({ ...IDLE, upload });
    const user = userEvent.setup();
    const { rerender } = render(<UploadField onUploaded={vi.fn()} />);

    // The admin picks a file — this is what puts the File reference into
    // UploadField's own state, per CLAUDE.md's "a component's own local
    // state should never need to escape that component".
    await user.upload(screen.getByLabelText(/choose images/i), FILE);

    // A real upload would now drive the hook's own status through to
    // 'error'; simulated here the same way SignInForm's test simulates a
    // rejected sign-in — by re-rendering with the hook's next return value,
    // since useMediaUpload is mocked and this is the same mounted
    // UploadField instance, so its internal `file` state survives the
    // re-render untouched.
    useMediaUpload.mockReturnValue({
      status: 'error',
      progress: 65,
      error: { code: 'UPLOAD_FAILED', stage: 'uploading' },
      reset: vi.fn(),
      upload,
    });
    rerender(<UploadField onUploaded={vi.fn()} />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/uploading/i);
    upload.mockClear();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    // Retried with the SAME File object — never asked to choose again.
    expect(upload).toHaveBeenCalledWith(FILE, { altText: '' });
  });

  it('presents RECORD_FAILED as an incomplete upload, not a generic failure', () => {
    useMediaUpload.mockReturnValue({
      status: 'error',
      progress: 90,
      error: { code: 'RECORD_FAILED', stage: 'recording' },
      reset: vi.fn(),
      upload: vi.fn(),
    });
    render(<UploadField onUploaded={vi.fn()} />);

    const alert = screen.getByRole('alert');
    // Names the stage that failed — 'recording' is the underlying
    // useMediaUpload status/error.stage value; "saving the record" is its
    // admin-facing label, same mapping the busy-state progress text uses.
    expect(alert.textContent).toMatch(/saving the record/i);
    // ...and says plainly this did NOT complete, rather than a generic
    // "something went wrong" — the whole reason the staged design in
    // useMediaUpload exists is to surface exactly this distinction.
    expect(alert.textContent).toMatch(/did not complete/i);
  });

  it('shows a distinct message for a non-RECORD_FAILED error — not the same wording', () => {
    useMediaUpload.mockReturnValue({
      status: 'error',
      progress: 35,
      error: { code: 'FORBIDDEN', stage: 'signing' },
      reset: vi.fn(),
      upload: vi.fn(),
    });
    render(<UploadField onUploaded={vi.fn()} />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).not.toMatch(/did not complete/i);
  });

  it('shows an uploaded confirmation once status is done', () => {
    useMediaUpload.mockReturnValue({
      status: 'done', progress: 100, error: null, reset: vi.fn(), upload: vi.fn(),
    });
    render(<UploadField onUploaded={vi.fn()} />);

    expect(screen.getByText(/^uploaded\.$/i)).toBeInTheDocument();
  });
});

describe('UploadField — bulk queue', () => {
  const img = (name) => new File(['bytes'], name, { type: 'image/jpeg' });
  const row = (id) => ({ id, storagePath: `uploads/${id}.webp`, altText: '' });

  it('renders a folder control by default and none when multiple is false', () => {
    const { rerender } = render(<UploadField onUploaded={vi.fn()} />);
    expect(screen.getByLabelText(/choose folder/i)).toBeInTheDocument();
    rerender(<UploadField onUploaded={vi.fn()} multiple={false} />);
    expect(screen.queryByLabelText(/choose folder/i)).toBeNull();
    expect(screen.getByLabelText(/choose images/i)).not.toHaveAttribute('multiple');
  });

  it('uploads several selected images sequentially, firing onUploaded(media, file) per success', async () => {
    const upload = vi.fn()
      .mockResolvedValueOnce(row('m-1'))
      .mockResolvedValueOnce(row('m-2'));
    useMediaUpload.mockReturnValue({ ...IDLE, upload });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(<UploadField onUploaded={onUploaded} />);

    const a = img('a.jpg'); const b = img('b.jpg');
    await user.upload(screen.getByLabelText(/choose images/i), [a, b]);

    expect(upload).toHaveBeenCalledTimes(2);
    expect(onUploaded).toHaveBeenNthCalledWith(1, row('m-1'), a);
    expect(onUploaded).toHaveBeenNthCalledWith(2, row('m-2'), b);
    await waitFor(() => expect(screen.getByText(/2 uploaded, 0 failed/i)).toBeInTheDocument());
  });

  it('a mid-queue failure does not stop the run and is summarized with retry', async () => {
    const upload = vi.fn()
      .mockResolvedValueOnce(row('m-1'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(row('m-3'));
    useMediaUpload.mockReturnValue({
      ...IDLE, upload, error: { code: 'UPLOAD_FAILED', stage: 'uploading' },
    });
    const user = userEvent.setup();
    render(<UploadField onUploaded={vi.fn()} />);

    await user.upload(screen.getByLabelText(/choose images/i), [img('a.jpg'), img('b.jpg'), img('c.jpg')]);

    await waitFor(() => expect(screen.getByText(/2 uploaded, 1 failed/i)).toBeInTheDocument());
    expect(screen.getByText(/b\.jpg/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry failed/i })).toBeInTheDocument();
  });

  it('skips non-image files in a folder selection and counts them', async () => {
    const upload = vi.fn().mockResolvedValue(row('m-1'));
    useMediaUpload.mockReturnValue({ ...IDLE, upload });
    render(<UploadField onUploaded={vi.fn()} />);

    // fireEvent.change with a hand-built file list, not user.upload: a folder
    // selection legitimately carries non-image files, and user-event strips
    // them by the input's accept before the component's own filter — which
    // is the exact filter this test exercises.
    const notes = new File(['x'], 'notes.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/choose folder/i);
    fireEvent.change(input, { target: { files: [img('a.jpg'), img('b.jpg'), notes] } });

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText(/skipped 1 non-image file/i)).toBeInTheDocument());
  });

  it('a single-image selection keeps the classic behavior (no bulk summary)', async () => {
    const upload = vi.fn().mockResolvedValue(row('m-1'));
    useMediaUpload.mockReturnValue({ ...IDLE, upload });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(<UploadField onUploaded={onUploaded} />);

    await user.upload(screen.getByLabelText(/choose images/i), img('only.jpg'));

    expect(onUploaded).toHaveBeenCalledWith(row('m-1'), expect.any(File));
    expect(screen.queryByText(/uploaded, .* failed/i)).toBeNull();
  });
});
