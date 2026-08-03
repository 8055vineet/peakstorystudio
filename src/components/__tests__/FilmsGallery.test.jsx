import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FilmsGallery from '../FilmsGallery';

const SAMPLE = [
  {
    id: 'film-1',
    title: 'A Cinematic Showreel',
    couple: 'Sam & Alex',
    location: 'Udaipur',
    duration: '4:32 mins',
    thumbnail: '/images/hero_royal.jpg',
    videoEmbedUrl: 'https://www.youtube.com/embed/example',
  },
];

describe('FilmsGallery', () => {
  it('renders a card per film when the list has content', () => {
    render(<FilmsGallery films={SAMPLE} onOpenVideoModal={vi.fn()} />);
    expect(screen.getByText('A Cinematic Showreel')).toBeInTheDocument();
  });

  it('renders the section header but no cards, rather than crashing, when the list is empty', () => {
    // Reachable once content is database-driven: a studio with every film
    // unpublished, or a status filter that legitimately matches none. Only
    // `.map` is used here (no indexing), so this already tolerated an empty
    // array before Phase 3 — this test locks that guarantee in.
    render(<FilmsGallery films={[]} onOpenVideoModal={vi.fn()} />);
    expect(screen.getByText(/CINEMATIC/)).toBeInTheDocument();
    expect(screen.queryByText('A Cinematic Showreel')).not.toBeInTheDocument();
  });
});
