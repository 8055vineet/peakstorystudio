import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomeVideo from '../HomeVideo';

const film = { id: 'f1', title: 'Palace Symphony', videoEmbedUrl: 'https://youtu.be/4KEZRGlwJU4?si=x' };

describe('HomeVideo', () => {
  it('embeds an autoplaying muted YouTube player using the video id', () => {
    render(<HomeVideo film={film} />);
    const frame = screen.getByTitle('Palace Symphony');
    expect(frame.tagName).toBe('IFRAME');
    const src = frame.getAttribute('src');
    expect(src).toContain('/embed/4KEZRGlwJU4');
    expect(src).toContain('autoplay=1');
    expect(src).toContain('mute=1');
  });

  it('shows the placeholder when there is no film', () => {
    render(<HomeVideo film={null} />);
    expect(screen.getByText('Video to be added')).toBeInTheDocument();
    expect(screen.queryByTitle('Palace Symphony')).toBeNull();
  });
});
