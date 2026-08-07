import { describe, it, expect } from 'vitest';
import { youtubeId, youtubeEmbedUrl } from '../youtube';

describe('youtubeId', () => {
  it('extracts the id from every YouTube URL form', () => {
    expect(youtubeId('https://www.youtube.com/embed/4KEZRGlwJU4')).toBe('4KEZRGlwJU4');
    expect(youtubeId('https://www.youtube.com/embed/4KEZRGlwJU4?autoplay=1')).toBe('4KEZRGlwJU4');
    expect(youtubeId('https://www.youtube.com/watch?v=4KEZRGlwJU4&t=30s')).toBe('4KEZRGlwJU4');
    expect(youtubeId('https://www.youtube.com/watch?list=PL1&v=4KEZRGlwJU4')).toBe('4KEZRGlwJU4');
    expect(youtubeId('https://youtu.be/4KEZRGlwJU4?si=abc')).toBe('4KEZRGlwJU4');
    expect(youtubeId('https://www.youtube.com/shorts/4KEZRGlwJU4')).toBe('4KEZRGlwJU4');
  });

  it('returns null for a non-YouTube or empty url', () => {
    expect(youtubeId('https://vimeo.com/123456')).toBeNull();
    expect(youtubeId('')).toBeNull();
    expect(youtubeId(null)).toBeNull();
  });
});

describe('youtubeEmbedUrl', () => {
  it('builds a canonical embed url, muted-autoplay when asked', () => {
    expect(youtubeEmbedUrl('https://youtu.be/4KEZRGlwJU4?si=x'))
      .toBe('https://www.youtube.com/embed/4KEZRGlwJU4?rel=0&playsinline=1');
    const auto = youtubeEmbedUrl('https://www.youtube.com/watch?v=4KEZRGlwJU4', { autoplay: true });
    expect(auto).toContain('/embed/4KEZRGlwJU4?');
    expect(auto).toContain('autoplay=1');
    expect(auto).toContain('mute=1');
  });

  it('passes a non-YouTube url through unchanged', () => {
    expect(youtubeEmbedUrl('https://player.vimeo.com/video/123')).toBe('https://player.vimeo.com/video/123');
  });
});
