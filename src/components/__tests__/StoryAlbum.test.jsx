import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StoryAlbum from '../StoryAlbum';

const story = {
  slug: 'a-harbour-wedding',
  title: 'A Harbour Wedding',
  couple: 'Test Couple',
  location: 'Test Harbour',
  date: 'March 2026',
  summary: 'A fictional story used only in tests.',
  coverImage: '/images/cover.jpg',
  fullGallery: ['/images/cover.jpg', '/images/second.jpg'],
  tags: ['Test'],
};

const renderAlbum = (props = {}) =>
  render(<StoryAlbum story={story} onSelectImage={vi.fn()} onOpenVideo={vi.fn()} {...props} />);

describe('StoryAlbum', () => {
  it('renders the summary, the details card, and the tag chips', () => {
    renderAlbum();
    expect(screen.getByText(/A fictional story used only in tests\./)).toBeInTheDocument();
    expect(screen.getByText('Test Couple')).toBeInTheDocument();
    expect(screen.getByText('Test Harbour')).toBeInTheDocument();
    expect(screen.getByText('March 2026')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('reports the gallery size', () => {
    renderAlbum();
    expect(screen.getByText(/Full Album Gallery \(2 Photographs\)/)).toBeInTheDocument();
  });

  it('falls back to the cover image when the story has no full gallery', () => {
    renderAlbum({ story: { ...story, fullGallery: undefined } });
    expect(screen.getByText(/Full Album Gallery \(1 Photographs\)/)).toBeInTheDocument();
  });

  it('offers Play Film only when the story has a film, and opens it', () => {
    const onOpenVideo = vi.fn();
    const { rerender } = render(<StoryAlbum story={story} onSelectImage={vi.fn()} onOpenVideo={onOpenVideo} />);
    expect(screen.queryByRole('button', { name: /play film/i })).toBeNull();

    rerender(<StoryAlbum story={{ ...story, videoUrl: 'https://youtu.be/abc' }} onSelectImage={vi.fn()} onOpenVideo={onOpenVideo} />);
    fireEvent.click(screen.getByRole('button', { name: /play film/i }));
    expect(onOpenVideo).toHaveBeenCalledWith('https://youtu.be/abc');
  });

  it('pages the large image with next/previous, wrapping at both ends', () => {
    renderAlbum();
    const preview = () => screen.getByAltText('A Harbour Wedding preview');
    expect(preview()).toHaveAttribute('src', '/images/cover.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Next photograph' }));
    expect(preview()).toHaveAttribute('src', '/images/second.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Next photograph' }));
    expect(preview()).toHaveAttribute('src', '/images/cover.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Previous photograph' }));
    expect(preview()).toHaveAttribute('src', '/images/second.jpg');
  });
});

describe('StoryAlbum thumbnails', () => {
  it('hands the lightbox the clicked image, its index, and the whole album so it opens on that photograph', () => {
    const onSelectImage = vi.fn();
    renderAlbum({ onSelectImage });
    fireEvent.click(screen.getAllByAltText('Thumbnail')[1]);
    expect(onSelectImage).toHaveBeenCalledWith(
      '/images/second.jpg',
      1,
      [{ url: '/images/cover.jpg' }, { url: '/images/second.jpg' }],
    );
  });

  it('exposes each thumbnail as a named button that opens on Enter', () => {
    const onSelectImage = vi.fn();
    renderAlbum({ onSelectImage });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Photograph 2 of 2' }), { key: 'Enter' });
    expect(onSelectImage).toHaveBeenCalledWith('/images/second.jpg', 1, expect.any(Array));
  });

  it('opens a thumbnail on Space as well', () => {
    const onSelectImage = vi.fn();
    renderAlbum({ onSelectImage });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Photograph 1 of 2' }), { key: ' ' });
    expect(onSelectImage).toHaveBeenCalledWith('/images/cover.jpg', 0, expect.any(Array));
  });
});
