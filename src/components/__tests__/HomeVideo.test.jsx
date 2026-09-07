import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('HomeVideo sound', () => {
  it('starts muted — the only autoplay a browser honours — and offers an unmute control', () => {
    render(<HomeVideo film={film} />);
    const toggle = screen.getByRole('button', { name: 'Unmute film' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTitle('Palace Symphony').getAttribute('src')).toContain('mute=1');
  });

  it('unmutes by telling the YouTube player in place, then offers to mute again', () => {
    render(<HomeVideo film={film} />);
    const frame = screen.getByTitle('Palace Symphony');
    const post = vi.spyOn(frame.contentWindow, 'postMessage');

    fireEvent.click(screen.getByRole('button', { name: 'Unmute film' }));
    expect(post).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
      'https://www.youtube.com',
    );
    // The iframe src is untouched: unmuting must not reload and restart the film.
    expect(frame.getAttribute('src')).toContain('mute=1');

    const toggle = screen.getByRole('button', { name: 'Mute film' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(post).toHaveBeenLastCalledWith(
      JSON.stringify({ event: 'command', func: 'mute', args: [] }),
      'https://www.youtube.com',
    );
    expect(screen.getByRole('button', { name: 'Unmute film' })).toBeInTheDocument();
  });

  it('offers no sound control when there is no film to hear', () => {
    render(<HomeVideo film={null} />);
    expect(screen.queryByRole('button', { name: /mute film/i })).toBeNull();
  });
});
