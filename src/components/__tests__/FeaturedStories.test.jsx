import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FeaturedStories from '../FeaturedStories';

const SAMPLE = [
  {
    id: 'story-1',
    title: 'A Royal Affair',
    couple: 'Sam & Alex',
    location: 'Jaipur',
    date: 'November 2024',
    coverImage: '/images/hero_royal.jpg',
  },
];

describe('FeaturedStories', () => {
  it('renders a card per story when the list has content', () => {
    render(<FeaturedStories stories={SAMPLE} onOpenLightbox={vi.fn()} onOpenVideo={vi.fn()} />);
    expect(screen.getByText('A Royal Affair')).toBeInTheDocument();
    expect(screen.getByText('Sam & Alex')).toBeInTheDocument();
  });

  it('renders the section header but no cards, rather than crashing, when the list is empty', () => {
    // Reachable once content is database-driven: a studio with every story
    // unpublished, or a status filter that legitimately matches none. Only
    // `.map` is used here (no indexing), so this already tolerated an empty
    // array before Phase 3 — this test locks that guarantee in.
    render(<FeaturedStories stories={[]} onOpenLightbox={vi.fn()} onOpenVideo={vi.fn()} />);
    expect(screen.getByText(/FEATURED/)).toBeInTheDocument();
    expect(screen.queryByText('A Royal Affair')).not.toBeInTheDocument();
  });
});
