import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import HomeVideo from '../HomeVideo';

const film = { id: 'f1', title: 'Palace Symphony', videoEmbedUrl: 'https://youtu.be/4KEZRGlwJU4?si=x' };

describe('HomeVideo', () => {
  it('plays the film as a chromeless looping background with the peaks + name overlay', () => {
    render(<HomeVideo film={film} />);
    const frame = screen.getByTitle('Palace Symphony');
    expect(frame.tagName).toBe('IFRAME');
    const src = frame.getAttribute('src');
    expect(src).toContain('/embed/4KEZRGlwJU4');
    expect(src).toContain('loop=1');
    expect(src).toContain('controls=0');
    const band = screen.getByLabelText('Peak Story Studio');
    expect(within(band).getByText('Peak Story Studio')).toBeInTheDocument();
    expect(within(band).getByText('by abhinav')).toBeInTheDocument();
  });

  it('shows the branded band with no iframe when there is no film', () => {
    render(<HomeVideo film={null} />);
    expect(screen.queryByTitle('Palace Symphony')).toBeNull();
    const band = screen.getByLabelText('Peak Story Studio');
    expect(within(band).getByText('Peak Story Studio')).toBeInTheDocument();
    expect(within(band).getByText('by abhinav')).toBeInTheDocument();
  });
});
