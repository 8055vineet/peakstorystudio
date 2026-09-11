import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../HomePage';
import { HOME_QUOTE, BRAND_STORY, HOME_IMAGES } from '../../data/homeContent';

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
  videoEmbedUrl: 'https://www.youtube.com/embed/4KEZRGlwJU4',
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
  // The one <h1> on Home names the studio, what it does, and where — the
  // page's single top-level heading for search engines and screen readers.
  it('has a level-1 heading naming the studio and Lucknow', () => {
    renderPage();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/Peak Story Studio/);
    expect(h1).toHaveTextContent(/Lucknow/);
    expect(h1).toHaveTextContent(/Wedding Photography/);
  });

  it('places the h1 at the bottom of the page, after every section, so it never competes with the hero', () => {
    renderPage();
    const page = screen.getByTestId('home-page');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(page.lastElementChild).toBe(h1);
  });

  // Cloudflare's field data scored Home's shifts at 0.5 per section: the
  // three full-width photographs had no reserved height, so each one grew
  // from zero as its bytes arrived and pushed everything below it down.
  it('reserves each full-width photograph\'s space from its stored dimensions, and fetches the hero first', () => {
    renderPage({
      images: {
        hero: { src: '/images/h.webp', alt: 'hero', width: 2000, height: 765 },
        brandStory: { src: '/images/b.webp', alt: 'portrait', width: 1500, height: 2000 },
        closing: { src: '/images/c.webp', alt: 'closing', width: 2000, height: 833 },
      },
    });
    const hero = screen.getByRole('img', { name: 'hero' });
    expect(hero).toHaveAttribute('width', '2000');
    expect(hero).toHaveAttribute('height', '765');
    expect(hero).toHaveAttribute('fetchpriority', 'high');
    expect(hero.className).toMatch(/\bh-auto\b/); // the attributes size it; CSS must not fight them
    expect(screen.getByRole('img', { name: 'portrait' })).toHaveAttribute('height', '2000');
    expect(screen.getByRole('img', { name: 'closing' })).toHaveAttribute('width', '2000');
  });

  it('reserves the shipped slots\' space too, so the fallback never shifts either', () => {
    renderPage();
    expect(screen.getByRole('img', { name: HOME_IMAGES.hero.alt })).toHaveAttribute('width', '1800');
  });

  it('renders the quote and credit verbatim', () => {
    renderPage();
    expect(screen.getByText(new RegExp(HOME_QUOTE.text.slice(0, 40)))).toBeInTheDocument();
    expect(screen.getByText(HOME_QUOTE.credit, { selector: 'cite' })).toBeInTheDocument();
  });

  it('renders both Brand Story paragraphs', () => {
    renderPage();
    for (const p of BRAND_STORY.paragraphs) {
      expect(screen.getByText(new RegExp(p.slice(0, 40)))).toBeInTheDocument();
    }
  });

  it('renders the quiet hero band even when no film is published', () => {
    renderPage();
    expect(screen.getByLabelText('Featured film')).toBeInTheDocument();
    expect(screen.queryByTitle(/./)).toBeNull(); // no iframe
  });

  it('renders the cinematic hero band as a clean video, no overlay', () => {
    renderPage({ films: [film] });
    expect(screen.getByLabelText('Featured film')).toBeInTheDocument();
    expect(screen.getByTitle(film.title).tagName).toBe('IFRAME');
    expect(screen.queryByText('Peak Story Studio')).toBeNull();
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

describe('HomePage while content is loading or unresolvable', () => {
  it('does not announce missing photographs while the gallery is still loading', () => {
    renderPage({ photos: [], photosLoading: true });
    expect(screen.queryByText('Photographs are on their way.')).not.toBeInTheDocument();
  });

  it('shows a quiet placeholder rather than a broken image for an unresolvable grid photo', () => {
    renderPage({ photos: [{ id: 'p-empty', title: 'Unresolvable', url: '', category: 'Wedding' }] });
    expect(screen.getByTestId('photo-placeholder')).toBeInTheDocument();
    expect(document.querySelector('img[src=""]')).toBeNull();
  });

  it('shows a quiet placeholder for an unresolvable hero image', () => {
    renderPage({
      images: {
        hero: { src: '', alt: '' },
        brandStory: { src: '/images/b.jpg', alt: '' },
        closing: { src: '/images/c.jpg', alt: '' },
      },
    });
    expect(screen.getAllByTestId('photo-placeholder').length).toBeGreaterThan(0);
    expect(document.querySelector('img[src=""]')).toBeNull();
  });
});
