import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClientGalleryModal from '../ClientGalleryModal';

const USER = { name: 'Sam & Alex', location: 'Jaipur' };

const SAMPLE = [
  { id: 'photo-1', title: 'Royal Courtyard Portrait', url: '/images/hero_royal.jpg' },
];

describe('ClientGalleryModal', () => {
  it('renders a tile per photo when the list has content', () => {
    render(<ClientGalleryModal isOpen user={USER} photos={SAMPLE} onClose={vi.fn()} />);
    expect(screen.getByText('Royal Courtyard Portrait')).toBeInTheDocument();
  });

  it('renders its empty state rather than crashing when the list is empty', () => {
    // Reachable once content is database-driven: a couple whose gallery has
    // nothing published yet. `favorites` is seeded from `photos.slice(0, 3)`
    // and the grid already branches on `displayedPhotos.length === 0`, so
    // this already tolerated an empty array before Phase 3 — this test locks
    // that guarantee in.
    render(<ClientGalleryModal isOpen user={USER} photos={[]} onClose={vi.fn()} />);
    expect(screen.getByText('All Photos (0)')).toBeInTheDocument();
    expect(screen.queryByText('Royal Courtyard Portrait')).not.toBeInTheDocument();
  });
});
