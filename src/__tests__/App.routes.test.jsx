import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Pages fetch through these hooks; route tests need no network and no Supabase.
vi.mock('../hooks/useContent', () => ({
  useWeddings: () => ({ data: [], loading: false, error: null }),
  useGalleryPhotos: () => ({ data: [], loading: false, error: null }),
  useFilms: () => ({ data: [], loading: false, error: null }),
  useTestimonials: () => ({ data: [], loading: false, error: null }),
}));

const renderAt = (path) =>
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

describe('routing', () => {
  it.each([
    ['/', 'home-page'],
    ['/gallery', 'gallery-page'],
    ['/films', 'films-page'],
    ['/stories', 'stories-page'],
    ['/about', 'about-page'],
    ['/contact', 'contact-page'],
  ])('%s renders its page', (path, testId) => {
    renderAt(path);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it('an unknown URL renders the not-found page with a way home', () => {
    renderAt('/no-such-page');
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /return home/i })).toHaveAttribute('href', '/');
  });

  it('every page shares the frame: header nav and footer are present', () => {
    renderAt('/gallery');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
