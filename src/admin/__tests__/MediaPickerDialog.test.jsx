import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The dialog embeds UploadField; its pipeline is already proven elsewhere
// (useMediaUpload.test.jsx, UploadField.test.jsx) — mocked here exactly as
// ResourceForm.test.jsx mocks it, for the same reason.
const useMediaUpload = vi.fn();
vi.mock('../../hooks/useMediaUpload', () => ({
  useMediaUpload: (...args) => useMediaUpload(...args),
}));

const { default: MediaPickerDialog } = await import('../MediaPickerDialog.jsx');

// `/images/...` paths pass straight through mediaUrl() regardless of
// VITE_MEDIA_BASE_URL, so these tests never depend on env stubbing.
const ITEMS = [
  {
    id: 'm-1', storagePath: '/images/test/sunset.jpg', altText: 'Sunset couple', createdAt: '2026-08-02T10:00:00Z',
  },
  {
    id: 'm-2', storagePath: '/images/test/haldi-turmeric.jpg', altText: '', createdAt: '2026-08-01T10:00:00Z',
  },
];

beforeEach(() => {
  useMediaUpload.mockReset();
  useMediaUpload.mockReturnValue({
    status: 'idle', progress: 0, error: null, upload: vi.fn(), reset: vi.fn(),
  });
  document.body.style.overflow = '';
});

function baseProps(overrides = {}) {
  return {
    open: true,
    title: 'Choose a photograph',
    items: ITEMS,
    status: 'ready',
    error: null,
    onRetry: vi.fn(),
    onUploaded: vi.fn(),
    onSelect: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('MediaPickerDialog', () => {
  it('renders nothing at all when closed', () => {
    render(<MediaPickerDialog {...baseProps({ open: false })} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders a labelled modal dialog with search, upload, and the grid, and focuses the search box', () => {
    render(<MediaPickerDialog {...baseProps()} />);
    const dialog = screen.getByRole('dialog', { name: 'Choose a photograph' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(screen.getByLabelText(/^photograph$/i)).toHaveAttribute('type', 'file');
    expect(screen.getAllByRole('button', { name: /select photograph:/i })).toHaveLength(2);
    expect(screen.getByText('2 of 2 photographs')).toBeInTheDocument();
  });

  it('locks body scroll while open and restores it on unmount', () => {
    const { unmount } = render(<MediaPickerDialog {...baseProps()} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('filters by alt text as you type, with a live count', async () => {
    const user = userEvent.setup();
    render(<MediaPickerDialog {...baseProps()} />);
    await user.type(screen.getByRole('searchbox'), 'sunset');
    expect(screen.getAllByRole('button', { name: /select photograph:/i })).toHaveLength(1);
    expect(screen.getByText('1 of 2 photographs')).toBeInTheDocument();
  });

  it('filters by file name too, for photographs with no alt text', async () => {
    const user = userEvent.setup();
    render(<MediaPickerDialog {...baseProps()} />);
    await user.type(screen.getByRole('searchbox'), 'haldi');
    expect(screen.getAllByRole('button', { name: /select photograph:/i })).toHaveLength(1);
  });

  it('shows a zero-match message distinct from the empty-library state', async () => {
    const user = userEvent.setup();
    render(<MediaPickerDialog {...baseProps()} />);
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText(/no photographs match/i)).toBeInTheDocument();
    expect(screen.queryByText(/no media yet/i)).toBeNull();
  });

  it('calls onSelect on a tile click and does NOT close itself', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<MediaPickerDialog {...props} />);
    await user.click(screen.getByRole('button', { name: /select photograph: sunset couple/i }));
    expect(props.onSelect).toHaveBeenCalledWith(ITEMS[0]);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape, on the ✕ control, and on the footer button — whose label the caller sets', async () => {
    const user = userEvent.setup();
    const props = baseProps({ closeLabel: 'Done' });
    render(<MediaPickerDialog {...props} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  it('passes the load-error state through with its retry control', () => {
    const props = baseProps({ items: [], status: 'error', error: new Error('permission denied') });
    render(<MediaPickerDialog {...props} />);
    expect(screen.getByText(/could not load media/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });
});
