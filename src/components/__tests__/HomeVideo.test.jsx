import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomeVideo from '../HomeVideo';

const film = { id: 'f1', title: 'Palace Symphony', videoEmbedUrl: 'https://youtu.be/4KEZRGlwJU4?si=x' };

describe('HomeVideo', () => {
  it('plays the film as a chromeless looping background, with no text overlay', () => {
    render(<HomeVideo film={film} />);
    const frame = screen.getByTitle('Palace Symphony');
    expect(frame.tagName).toBe('IFRAME');
    const src = frame.getAttribute('src');
    expect(src).toContain('/embed/4KEZRGlwJU4');
    expect(src).toContain('loop=1');
    expect(src).toContain('controls=0');
    // Overlay removed (Phase 3j): no wordmark or tagline over the video.
    expect(screen.queryByText('Peak Story Studio')).toBeNull();
    expect(screen.queryByText('by abhinav')).toBeNull();
  });

  it('shows a quiet band with no iframe when there is no film', () => {
    render(<HomeVideo film={null} />);
    expect(screen.queryByTitle('Palace Symphony')).toBeNull();
    expect(screen.getByLabelText('Featured film')).toBeInTheDocument();
  });
});
