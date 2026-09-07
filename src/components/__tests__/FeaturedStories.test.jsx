import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import FeaturedStories from '../FeaturedStories';

const SAMPLE = [
  {
    id: 'story-1',
    slug: 'a-royal-affair',
    title: 'A Royal Affair',
    couple: 'Sam & Alex',
    location: 'Jaipur',
    date: 'November 2024',
    coverImage: '/images/hero_royal.jpg',
  },
];

const renderStories = (stories) =>
  render(
    <MemoryRouter>
      <FeaturedStories stories={stories} onOpenLightbox={vi.fn()} onOpenVideo={vi.fn()} />
    </MemoryRouter>,
  );

describe('FeaturedStories', () => {
  it('renders a card per story when the list has content', () => {
    renderStories(SAMPLE);
    expect(screen.getByText('A Royal Affair')).toBeInTheDocument();
    expect(screen.getByText('Sam & Alex')).toBeInTheDocument();
    expect(screen.getByText('View Album')).toBeInTheDocument();
  });

  it('renders the section header but no cards, rather than crashing, when the list is empty', () => {
    // Reachable once content is database-driven: a studio with every story
    // unpublished, or a status filter that legitimately matches none. Only
    // `.map` is used here (no indexing), so this already tolerated an empty
    // array before Phase 3 — this test locks that guarantee in.
    renderStories([]);
    expect(screen.getByText(/FEATURED/)).toBeInTheDocument();
    expect(screen.queryByText('A Royal Affair')).not.toBeInTheDocument();
  });
});

describe('FeaturedStories cards are links', () => {
  it("each card is a link to that wedding's own page", () => {
    renderStories(SAMPLE);
    expect(screen.getByRole('link', { name: /A Royal Affair/ })).toHaveAttribute('href', '/stories/a-royal-affair');
  });

  it('no longer opens an in-page album: the card is a plain link, not a synthetic button', () => {
    renderStories(SAMPLE);
    expect(screen.queryByRole('button', { name: /A Royal Affair/ })).toBeNull();
    expect(screen.queryByText(/Full Album Gallery/)).toBeNull();
  });
});
