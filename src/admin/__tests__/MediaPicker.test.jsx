import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { render, screen } from '@testing-library/react';

const ITEMS = [
  {
    id: 'media-1',
    storagePath: 'uploads/one.webp',
    width: 2000,
    height: 1500,
    altText: 'A couple at dusk under string lights.',
    blurhash: null,
    createdAt: '2026-08-01T10:00:00Z',
  },
  {
    id: 'media-2',
    storagePath: 'uploads/two.webp',
    width: 1800,
    height: 1200,
    altText: '',
    blurhash: null,
    createdAt: '2026-08-02T10:00:00Z',
  },
];

// mediaUrl.js reads import.meta.env.VITE_MEDIA_BASE_URL at module load, and
// MediaPicker imports mediaUrl.js — same pattern as
// src/components/__tests__/WhatsAppButton.test.jsx: reset the module
// registry and stub the env before each dynamic import so the value picked
// up is always the one this specific test just set, not whatever an earlier
// test (or the real .env) left behind.
describe('MediaPicker', () => {
  beforeEach(() => vi.resetModules());

  async function renderPicker(props, baseUrl = 'https://cdn.peakstorystudio.test') {
    vi.stubEnv('VITE_MEDIA_BASE_URL', baseUrl);
    const { default: MediaPicker } = await import('../MediaPicker.jsx');
    return render(<MediaPicker {...props} />);
  }

  it('renders one entry per media row', async () => {
    await renderPicker({
      items: ITEMS, status: 'ready', error: null, onRetry: vi.fn(), onSelect: vi.fn(),
    });

    expect(screen.getAllByRole('button', { name: /^select$/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /select photograph:/i })).toHaveLength(2);
  });

  it('renders each thumbnail from VITE_MEDIA_BASE_URL joined to storage_path when configured', async () => {
    await renderPicker(
      {
        items: ITEMS, status: 'ready', error: null, onRetry: vi.fn(), onSelect: vi.fn(),
      },
      'https://cdn.peakstorystudio.test',
    );

    const images = screen.getAllByRole('img');
    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      'https://cdn.peakstorystudio.test/uploads/one.webp',
      'https://cdn.peakstorystudio.test/uploads/two.webp',
    ]);
  });

  it('flags media with empty alt_text, and only that media', async () => {
    await renderPicker({
      items: ITEMS, status: 'ready', error: null, onRetry: vi.fn(), onSelect: vi.fn(),
    });

    const flags = screen.getAllByText(/alt text missing/i);
    expect(flags).toHaveLength(1);
  });

  it('calls onSelect with the full media row when its control is used', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onSelect = vi.fn();
    await renderPicker({
      items: ITEMS, status: 'ready', error: null, onRetry: vi.fn(), onSelect,
    });
    const user = userEvent.setup();

    await user.click(screen.getAllByRole('button', { name: /select/i })[0]);

    expect(onSelect).toHaveBeenCalledWith(ITEMS[0]);
  });

  it('renders a labelled placeholder and a one-line explanation instead of a broken image when VITE_MEDIA_BASE_URL is unset', async () => {
    await renderPicker(
      {
        items: ITEMS, status: 'ready', error: null, onRetry: vi.fn(), onSelect: vi.fn(),
      },
      '',
    );

    // No <img> at all — never a src computed from an empty base, which
    // would be a broken image nobody configured on purpose.
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(screen.getAllByText(/no preview/i)).toHaveLength(2);
    expect(screen.getAllByText(/VITE_MEDIA_BASE_URL/i).length).toBeGreaterThan(0);
  });

  it('shows a distinct empty state when there is no media — not the error state', async () => {
    await renderPicker({
      items: [], status: 'ready', error: null, onRetry: vi.fn(), onSelect: vi.fn(),
    });

    expect(screen.getByText(/no media yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/could not load/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('shows a distinct load-error state with a retry control — not the empty state', async () => {
    const onRetry = vi.fn();
    await renderPicker({
      items: [], status: 'error', error: new Error('permission denied'), onRetry, onSelect: vi.fn(),
    });

    expect(screen.getByText(/could not load/i)).toBeInTheDocument();
    expect(screen.queryByText(/no media yet/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls onRetry when the retry control is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onRetry = vi.fn();
    await renderPicker({
      items: [], status: 'error', error: new Error('boom'), onRetry, onSelect: vi.fn(),
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('still shows the error state even if items happen to be non-empty', async () => {
    // Same guard as LeadsTable: a hook that keeps the last known-good list
    // around through a failed reload must not be misread here as "we have
    // data, render the grid" — status wins.
    await renderPicker({
      items: ITEMS, status: 'error', error: new Error('boom'), onRetry: vi.fn(), onSelect: vi.fn(),
    });

    expect(screen.getByText(/could not load/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /select/i })).toHaveLength(0);
  });

  it('shows a loading state when status is loading and no items are held yet', async () => {
    await renderPicker({
      items: [], status: 'loading', error: null, onRetry: vi.fn(), onSelect: vi.fn(),
    });

    expect(screen.getByText(/loading media/i)).toBeInTheDocument();
  });
});

describe('MediaPicker selection affordances', () => {
  beforeEach(() => vi.resetModules());

  const ITEMS2 = [
    { id: 'm-1', storagePath: '/images/gallery/wedding/1.jpg', altText: 'One' },
    { id: 'm-2', storagePath: '/images/gallery/wedding/2.jpg', altText: 'Two' },
  ];

  async function renderPicker(props) {
    vi.stubEnv('VITE_MEDIA_BASE_URL', 'https://cdn.peakstorystudio.test');
    const { default: MediaPicker } = await import('../MediaPicker.jsx');
    return render(<MediaPicker {...props} />);
  }

  it('renders no Select buttons at all when no onSelect is provided (the standalone library)', async () => {
    await renderPicker({ items: ITEMS2, status: 'ready', error: null, onRetry: vi.fn() });
    expect(screen.queryByRole('button', { name: /select/i })).toBeNull();
  });

  it('marks the currently selected item so a click gives visible confirmation', async () => {
    await renderPicker({
      items: ITEMS2, status: 'ready', error: null, onRetry: vi.fn(), onSelect: vi.fn(), selectedId: 'm-2',
    });
    const selectedButton = screen.getByRole('button', { name: /✓ selected/i });
    expect(selectedButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: /^select$/i })).toHaveLength(1);
  });

  it('highlights every id in selectedIds, for multi-attach callers', async () => {
    await renderPicker({
      items: ITEMS2, status: 'ready', error: null, onRetry: vi.fn(), onSelect: vi.fn(), selectedIds: ['m-1', 'm-2'],
    });
    expect(screen.getAllByRole('button', { name: /✓ selected/i })).toHaveLength(2);
  });

  it('makes the photograph itself a select control when onSelect is provided', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onSelect = vi.fn();
    await renderPicker({
      items: ITEMS2, status: 'ready', error: null, onRetry: vi.fn(), onSelect,
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /select photograph: one/i }));
    expect(onSelect).toHaveBeenCalledWith(ITEMS2[0]);
  });

  it('renders no image button at all without onSelect', async () => {
    await renderPicker({ items: ITEMS2, status: 'ready', error: null, onRetry: vi.fn() });
    expect(screen.queryByRole('button', { name: /select photograph:/i })).toBeNull();
  });

  it('applies a caller-supplied gridClass to the grid', async () => {
    await renderPicker({
      items: ITEMS2, status: 'ready', error: null, onRetry: vi.fn(), onSelect: vi.fn(), gridClass: 'grid grid-cols-6 gap-4',
    });
    expect(screen.getByRole('list')).toHaveClass('grid-cols-6');
  });
});
