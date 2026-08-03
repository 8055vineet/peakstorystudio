import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../HomePage';
import { HOME_QUOTE, BRAND_STORY } from '../../data/homeContent';

// Field names match the fixtures in src/components/__tests__/FilmsGallery.test.jsx
// and PhotoGallery.test.jsx — the page consumes the same shapes the section
// components already consume.
const film = {
  id: 'film-1',
  title: 'A Cinematic Showreel',
  couple: 'Sam & Alex',
  location: 'Udaipur',
  duration: '4:32 mins',
  thumbnail: '/images/hero_royal.jpg',
  videoEmbedUrl: 'https://www.youtube.com/embed/example',
};

const photos = [
  { id: 'photo-1', title: 'Royal Courtyard Portrait', url: '/images/a.jpg', category: 'Royal', couple: 'Sam & Alex', location: 'Jaipur' },
  { id: 'photo-2', title: 'Dune Walk', url: '/images/b.jpg', category: 'Candid', couple: 'Sam & Alex', location: 'Jaisalmer' },
];

const renderPage = (props = {}) =>
  render(
    <MemoryRouter>
      <HomePage films={[]} photos={[]} onOpenLightbox={() => {}} onOpenVideo={() => {}} {...props} />
    </MemoryRouter>,
  );

describe('HomePage', () => {
  it('renders the quote and credit verbatim', () => {
    renderPage();
    expect(screen.getByText(new RegExp(HOME_QUOTE.text.slice(0, 40)))).toBeInTheDocument();
    expect(screen.getByText(HOME_QUOTE.credit)).toBeInTheDocument();
  });

  it('renders both Brand Story paragraphs', () => {
    renderPage();
    for (const p of BRAND_STORY.paragraphs) {
      expect(screen.getByText(new RegExp(p.slice(0, 40)))).toBeInTheDocument();
    }
  });

  it('shows "Video to be added" when no film is published', () => {
    renderPage();
    expect(screen.getByText('Video to be added')).toBeInTheDocument();
  });

  it('shows the first film, playable, when one is published', () => {
    const onOpenVideo = vi.fn();
    renderPage({ films: [film], onOpenVideo });
    expect(screen.queryByText('Video to be added')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /play film/i }));
    expect(onOpenVideo).toHaveBeenCalledWith(film.videoEmbedUrl);
  });

  it('survives an empty photo list', () => {
    renderPage();
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Photographs are on their way.')).toBeInTheDocument();
  });

  it('caps the grid at 18 photos and opens the lightbox on click', () => {
    const many = Array.from({ length: 24 }, (_, i) => ({ ...photos[0], id: `photo-${i}`, url: `/images/${i}.jpg` }));
    const onOpenLightbox = vi.fn();
    renderPage({ photos: many, onOpenLightbox });
    const grid = screen.getByTestId('home-images-grid');
    const tiles = within(grid).getAllByRole('button');
    expect(tiles).toHaveLength(18);
    fireEvent.click(tiles[2]);
    expect(onOpenLightbox).toHaveBeenCalledWith('/images/2.jpg', 2, many);
  });
});
