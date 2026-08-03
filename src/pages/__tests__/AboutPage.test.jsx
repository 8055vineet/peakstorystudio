import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AboutPage from '../AboutPage';
import { BRAND_STORY } from '../../data/homeContent';

describe('AboutPage', () => {
  it('opens with the page title', () => {
    render(<AboutPage testimonials={[]} />);
    expect(screen.getByRole('heading', { name: /about/i })).toBeInTheDocument();
  });

  it('renders the Brand Story from the shared module, not a copy', () => {
    render(<AboutPage testimonials={[]} />);
    for (const p of BRAND_STORY.paragraphs) {
      expect(screen.getByText(new RegExp(p.slice(0, 40)))).toBeInTheDocument();
    }
  });

  it('survives an empty testimonial list', () => {
    render(<AboutPage testimonials={[]} />);
    expect(screen.getByTestId('about-page')).toBeInTheDocument();
  });
});
