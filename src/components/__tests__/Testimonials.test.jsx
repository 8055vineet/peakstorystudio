import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Testimonials from '../Testimonials';

const SAMPLE = [
  { id: 1, quote: 'Wonderful day.', couple: 'Sam & Alex', event: 'Beach Wedding' },
];

describe('Testimonials', () => {
  it('renders the active testimonial when the list has content', () => {
    render(<Testimonials testimonials={SAMPLE} />);
    expect(screen.getByText(/Wonderful day\./)).toBeInTheDocument();
    expect(screen.getByText('Sam & Alex')).toBeInTheDocument();
  });

  it('renders nothing rather than crashing when the list is empty', () => {
    // Reachable once content is dynamic: every testimonial unpublished, or a
    // status filter that legitimately matches none. Indexing into [0] used
    // to throw and take the whole page down via the root ErrorBoundary.
    const { container } = render(<Testimonials testimonials={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
