import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import StoryPage from '../StoryPage';

const STORIES = [{
  id: 'w-1',
  slug: 'a-royal-affair',
  title: 'A Royal Affair',
  couple: 'Sam & Alex',
  location: 'Jaipur',
  date: 'November 2024',
  summary: 'Three days under the desert sky.',
  coverImage: '/images/w/cover.jpg',
  fullGallery: ['/images/w/one.jpg', '/images/w/two.jpg'],
  videoUrl: null,
  tags: ['Palace'],
}];

const renderAt = (slug, { stories = STORIES, loading = false, onOpenLightbox = vi.fn(), onOpenVideo = vi.fn() } = {}) =>
  render(
    <MemoryRouter initialEntries={[`/stories/${slug}`]}>
      <Routes>
        <Route
          path="stories/:slug"
          element={<StoryPage stories={stories} loading={loading} onOpenLightbox={onOpenLightbox} onOpenVideo={onOpenVideo} />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('StoryPage', () => {
  it('renders the wedding named by the slug: title, summary, and details', () => {
    renderAt('a-royal-affair');
    expect(screen.getByTestId('story-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'A Royal Affair' })).toBeInTheDocument();
    expect(screen.getByText(/Three days under the desert sky\./)).toBeInTheDocument();
    expect(screen.getByText('Sam & Alex')).toBeInTheDocument();
    expect(screen.getByText('Jaipur')).toBeInTheDocument();
    expect(screen.getByText('November 2024')).toBeInTheDocument();
    expect(screen.getByText('Palace')).toBeInTheDocument();
  });

  it('links back to the stories index', () => {
    renderAt('a-royal-affair');
    expect(screen.getByRole('link', { name: /back to stories/i })).toHaveAttribute('href', '/stories');
  });

  it('opens the lightbox on the clicked thumbnail with its index and the whole album', () => {
    const onOpenLightbox = vi.fn();
    renderAt('a-royal-affair', { onOpenLightbox });
    fireEvent.click(screen.getByRole('button', { name: 'Photograph 2 of 2' }));
    expect(onOpenLightbox).toHaveBeenCalledWith(
      '/images/w/two.jpg',
      1,
      [{ url: '/images/w/one.jpg' }, { url: '/images/w/two.jpg' }],
    );
  });

  it('forwards Play Film to the video modal when the wedding has a film', () => {
    const onOpenVideo = vi.fn();
    renderAt('a-royal-affair', { stories: [{ ...STORIES[0], videoUrl: 'https://youtu.be/abc' }], onOpenVideo });
    fireEvent.click(screen.getByRole('button', { name: /play film/i }));
    expect(onOpenVideo).toHaveBeenCalledWith('https://youtu.be/abc');
  });

  it('shows the not-found content for an unknown slug once the list has loaded', () => {
    renderAt('no-such-wedding');
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    expect(screen.queryByTestId('story-page')).toBeNull();
  });

  it('renders nothing while the list is still loading, so a direct link never flashes not-found', () => {
    const { container } = renderAt('a-royal-affair', { stories: [], loading: true });
    expect(container).toBeEmptyDOMElement();
  });
});
