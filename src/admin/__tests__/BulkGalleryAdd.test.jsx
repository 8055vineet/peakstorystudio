import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useMediaUpload = vi.fn();
vi.mock('../../hooks/useMediaUpload', () => ({
  useMediaUpload: (...args) => useMediaUpload(...args),
}));

const { default: BulkGalleryAdd } = await import('../BulkGalleryAdd.jsx');

const CATEGORIES = [
  { id: 'c1', name: 'Wedding', sortOrder: 0 },
  { id: 'c2', name: 'Pre-Wedding', sortOrder: 1 },
];

beforeEach(() => {
  useMediaUpload.mockReset();
  useMediaUpload.mockReturnValue({
    status: 'idle', progress: 0, error: null, upload: vi.fn().mockResolvedValue({ id: 'm-1', storagePath: 'uploads/x.webp' }), reset: vi.fn(),
  });
});

function baseProps(overrides = {}) {
  return {
    categories: CATEGORIES,
    onUpload: vi.fn(),
    pending: false,
    summary: null,
    onPublishAll: vi.fn(),
    onDismiss: vi.fn(),
    ...overrides,
  };
}

describe('BulkGalleryAdd', () => {
  it('keeps the upload controls disabled until a category is chosen', async () => {
    const user = userEvent.setup();
    render(<BulkGalleryAdd {...baseProps()} />);
    expect(screen.getByLabelText(/choose images/i)).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/category/i), 'Wedding');
    expect(screen.getByLabelText(/choose images/i)).not.toBeDisabled();
  });

  it('calls onUpload with (media, file, category) for each upload', async () => {
    const onUpload = vi.fn();
    const upload = vi.fn().mockResolvedValue({ id: 'm-9', storagePath: 'uploads/9.webp' });
    useMediaUpload.mockReturnValue({
      status: 'idle', progress: 0, error: null, upload, reset: vi.fn(),
    });
    const user = userEvent.setup();
    render(<BulkGalleryAdd {...baseProps({ onUpload })} />);
    await user.selectOptions(screen.getByLabelText(/category/i), 'Wedding');
    await user.upload(screen.getByLabelText(/choose images/i), new File(['b'], 'shot.jpg', { type: 'image/jpeg' }));
    expect(onUpload).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-9' }), expect.any(File), 'Wedding');
  });

  it('shows the created-count banner with Publish all, and the not-added split', async () => {
    const user = userEvent.setup();
    const props = baseProps({ summary: { category: 'Wedding', created: 24, notAdded: 2 } });
    render(<BulkGalleryAdd {...props} />);
    expect(screen.getByText(/24 draft photos created in Wedding/i)).toBeInTheDocument();
    expect(screen.getByText(/2 uploaded but not added/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /publish all 24/i }));
    expect(props.onPublishAll).toHaveBeenCalledTimes(1);
  });
});
