import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FilmStrip from '../FilmStrip';
import { FILM_STRIP_FRAMES } from '../../data/weddingData';

describe('FilmStrip', () => {
  it('renders every frame from the shared data module, duplicated for the marquee loop', () => {
    render(<FilmStrip />);
    const firstLocation = FILM_STRIP_FRAMES[0].location;
    // The marquee renders the list twice so the scroll can loop seamlessly.
    expect(screen.getAllByAltText(firstLocation)).toHaveLength(2);
  });

  it('exports FILM_STRIP_FRAMES as a non-empty array of frame objects with title, location, and img', () => {
    expect(Array.isArray(FILM_STRIP_FRAMES)).toBe(true);
    expect(FILM_STRIP_FRAMES.length).toBeGreaterThan(0);
    for (const frame of FILM_STRIP_FRAMES) {
      expect(frame).toHaveProperty('title');
      expect(frame).toHaveProperty('location');
      expect(frame).toHaveProperty('img');
    }
  });
});
