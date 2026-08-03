import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PhotoGallery from '../PhotoGallery';

const SAMPLE = [
  { id: 'p1', title: 'Pre-wedding 1', url: '/images/gallery/prewedding/1.jpg', category: 'Pre-Wedding', couple: null, location: null, span: null },
  { id: 'p2', title: 'Wedding day 1', url: '/images/gallery/wedding/1.jpg', category: 'Wedding', couple: null, location: null, span: null },
  { id: 'p3', title: 'Wedding day 2', url: '/images/gallery/wedding/2.jpg', category: 'Wedding', couple: null, location: null, span: null },
];

describe('PhotoGallery', () => {
  it('groups photographs into ceremony sections with a label each', () => {
    render(<PhotoGallery photos={SAMPLE} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText('Pre-Wedding')).toBeInTheDocument();
    expect(screen.getByText('Wedding')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('opens the lightbox with the photo url, its index in the full list, and the full list', () => {
    const onOpenLightbox = vi.fn();
    render(<PhotoGallery photos={SAMPLE} onOpenLightbox={onOpenLightbox} />);
    fireEvent.click(screen.getByRole('button', { name: 'Wedding day 2' }));
    expect(onOpenLightbox).toHaveBeenCalledWith('/images/gallery/wedding/2.jpg', 2, SAMPLE);
  });

  it('renders a quiet empty state rather than crashing when the list is empty', () => {
    render(<PhotoGallery photos={[]} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText('Photographs are on their way.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('appends a category the order list does not know rather than dropping it', () => {
    const withUnknown = [...SAMPLE, { id: 'p4', title: 'Reception 1', url: '/x.jpg', category: 'Reception', couple: null, location: null, span: null }];
    render(<PhotoGallery photos={withUnknown} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText('Reception')).toBeInTheDocument();
  });
});
