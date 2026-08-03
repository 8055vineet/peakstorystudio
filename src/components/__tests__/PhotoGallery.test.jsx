import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PhotoGallery from '../PhotoGallery';

const SAMPLE = [
  {
    id: 'photo-1',
    title: 'Royal Courtyard Portrait',
    url: '/images/hero_royal.jpg',
    category: 'Royal',
    couple: 'Sam & Alex',
    location: 'Jaipur',
    span: 'col-span-1 row-span-1',
  },
];

describe('PhotoGallery', () => {
  it('renders a tile per photo when the list has content', () => {
    render(<PhotoGallery photos={SAMPLE} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText('Royal Courtyard Portrait')).toBeInTheDocument();
    // The "All" and "Royal" category badges both read the same count (1).
    expect(screen.getAllByText('1').length).toBe(2);
  });

  it('renders the section header, filters, and an empty grid, rather than crashing, when the list is empty', () => {
    // Reachable once content is database-driven: a studio with every photo
    // unpublished, or a category filter that legitimately matches none.
    // Both the filtered `.map` and the per-category `.filter().length` counts
    // already tolerated an empty array before Phase 3 — this test locks that
    // guarantee in.
    render(<PhotoGallery photos={[]} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText(/FINE ART/)).toBeInTheDocument();
    expect(screen.queryByText('Royal Courtyard Portrait')).not.toBeInTheDocument();
    // Every category count (including "All") reads 0 rather than throwing.
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });
});
