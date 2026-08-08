import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useMediaUpload = vi.fn();
vi.mock('../../hooks/useMediaUpload', () => ({
  useMediaUpload: (...args) => useMediaUpload(...args),
}));

const { default: MediaSlot } = await import('../MediaSlot.jsx');

// `/images/...` paths pass through mediaUrl() untouched — no env stubbing.
const MEDIA = [
  { id: 'm-1', storagePath: '/images/test/one.jpg', altText: 'One' },
  { id: 'm-2', storagePath: '/images/test/two.jpg', altText: 'Two' },
];

beforeEach(() => {
  useMediaUpload.mockReset();
  useMediaUpload.mockReturnValue({
    status: 'idle', progress: 0, error: null, upload: vi.fn(), reset: vi.fn(),
  });
});

function baseProps(overrides = {}) {
  return {
    label: 'Cover Photo',
    help: null,
    required: false,
    error: null,
    value: null,
    media: MEDIA,
    mediaStatus: 'ready',
    mediaError: null,
    onRetryMedia: vi.fn(),
    onUploaded: vi.fn(),
    onChange: vi.fn(),
    ...overrides,
  };
}

describe('MediaSlot', () => {
  it('renders an empty slot with a Choose control and never an inline grid', () => {
    render(<MediaSlot {...baseProps()} />);
    expect(screen.getByRole('group', { name: /cover photo/i })).toBeInTheDocument();
    expect(screen.getByText(/no photograph yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose photograph/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: /select photograph:/i })).toBeNull();
  });

  it('shows the chosen photograph as a thumbnail with Change and Remove controls', () => {
    render(<MediaSlot {...baseProps({ value: 'm-1' })} />);
    expect(screen.getByAltText('One')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('offers no Remove on a required slot', () => {
    render(<MediaSlot {...baseProps({ value: 'm-1', required: true })} />);
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });

  it('falls back to the media id when the library cannot resolve it yet', () => {
    render(<MediaSlot {...baseProps({ value: 'm-unknown', media: [] })} />);
    expect(screen.getByText(/selected media id: m-unknown/i)).toBeInTheDocument();
  });

  it('opens the dialog, selects a photograph, closes, and reports the id', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<MediaSlot {...props} />);
    await user.click(screen.getByRole('button', { name: /choose photograph/i }));
    expect(screen.getByRole('dialog', { name: 'Choose a photograph' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /select photograph: two/i }));
    expect(props.onChange).toHaveBeenCalledWith('m-2');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clears to null on Remove', async () => {
    const user = userEvent.setup();
    const props = baseProps({ value: 'm-1' });
    render(<MediaSlot {...props} />);
    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(props.onChange).toHaveBeenCalledWith(null);
  });

  it('auto-selects a fresh upload and closes the dialog', async () => {
    const upload = vi.fn().mockResolvedValue({ id: 'media-new', storagePath: 'uploads/new.webp' });
    useMediaUpload.mockReturnValue({
      status: 'idle', progress: 0, error: null, upload, reset: vi.fn(),
    });
    const user = userEvent.setup();
    const props = baseProps();
    render(<MediaSlot {...props} />);
    await user.click(screen.getByRole('button', { name: /choose photograph/i }));
    const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/choose images/i), file);
    expect(props.onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'media-new' }));
    expect(props.onChange).toHaveBeenCalledWith('media-new');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('its picker dialog uploads one photograph at a time — no folder control', async () => {
    const user = userEvent.setup();
    render(<MediaSlot {...baseProps()} />);
    await user.click(screen.getByRole('button', { name: /choose photograph/i }));
    expect(screen.queryByLabelText(/choose folder/i)).toBeNull();
  });

  it('renders a circular preview when previewShape is circle', () => {
    render(<MediaSlot {...baseProps({ value: 'm-1', previewShape: 'circle' })} />);
    expect(screen.getByTestId('media-slot-preview').className).toMatch(/rounded-full/);
  });

  it('renders a square preview by default', () => {
    render(<MediaSlot {...baseProps({ value: 'm-1' })} />);
    const box = screen.getByTestId('media-slot-preview');
    expect(box.className).toMatch(/rounded-lg/);
    expect(box.className).not.toMatch(/rounded-full/);
  });

  it('renders a field error inline as an alert', () => {
    render(<MediaSlot {...baseProps({ error: 'Photograph is required.' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/photograph is required/i);
  });
});
