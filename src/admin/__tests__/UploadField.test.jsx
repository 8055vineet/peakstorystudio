import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { render, screen } from '@testing-library/react';
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
    expect(screen.getByLabelText(/photograph/i)).toHaveAttribute('type', 'file');
  });

  it('calls upload with the chosen file and the currently typed alt text', async () => {
    const upload = vi.fn().mockResolvedValue(MEDIA_ROW);
    useMediaUpload.mockReturnValue({ ...IDLE, upload });
    const user = userEvent.setup();
    render(<UploadField onUploaded={vi.fn()} />);

    await user.type(screen.getByLabelText(/alt text/i), 'A couple at dusk.');
    await user.upload(screen.getByLabelText(/photograph/i), FILE);

    expect(upload).toHaveBeenCalledWith(FILE, { altText: 'A couple at dusk.' });
  });

  it('calls onUploaded with the returned media row once the upload resolves', async () => {
    const upload = vi.fn().mockResolvedValue(MEDIA_ROW);
    useMediaUpload.mockReturnValue({ ...IDLE, upload });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(<UploadField onUploaded={onUploaded} />);

    await user.upload(screen.getByLabelText(/photograph/i), FILE);

    expect(onUploaded).toHaveBeenCalledWith(MEDIA_ROW);
  });

  it('does not call onUploaded when upload resolves null (a failed attempt)', async () => {
    const upload = vi.fn().mockResolvedValue(null);
    useMediaUpload.mockReturnValue({ ...IDLE, upload });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(<UploadField onUploaded={onUploaded} />);

    await user.upload(screen.getByLabelText(/photograph/i), FILE);

    expect(onUploaded).not.toHaveBeenCalled();
  });

  it('shows progress and disables both inputs while a stage is in flight', () => {
    useMediaUpload.mockReturnValue({
      status: 'uploading', progress: 65, error: null, reset: vi.fn(), upload: vi.fn(),
    });
    render(<UploadField onUploaded={vi.fn()} />);

    expect(screen.getByLabelText(/alt text/i)).toBeDisabled();
    expect(screen.getByLabelText(/photograph/i)).toBeDisabled();
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
    await user.upload(screen.getByLabelText(/photograph/i), FILE);

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

    expect(screen.getByText(/uploaded/i)).toBeInTheDocument();
  });
});
