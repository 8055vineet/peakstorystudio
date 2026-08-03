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

  it('survives the list shrinking underneath an advanced index', async () => {
    // useContent seeds with the static module and swaps in the database
    // array when the query resolves. If the database publishes fewer
    // testimonials than the fallback and the visitor has already advanced —
    // the carousel auto-advances every five seconds, and a nav dot is
    // clickable while the query is still in flight — the old index points
    // past the end of the new array. Reading .quote off undefined throws,
    // and the root ErrorBoundary then replaces the entire homepage.
    const { default: userEvent } = await import('@testing-library/user-event');
    const THREE = [
      { id: 1, quote: 'First.', couple: 'A & B', event: 'One' },
      { id: 2, quote: 'Second.', couple: 'C & D', event: 'Two' },
      { id: 3, quote: 'Third.', couple: 'E & F', event: 'Three' },
    ];

    const { rerender } = render(<Testimonials testimonials={THREE} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Go to testimonial 3' }));
    expect(screen.getByText(/Third\./)).toBeInTheDocument();

    // The database answers with one published testimonial.
    expect(() => rerender(<Testimonials testimonials={SAMPLE} />)).not.toThrow();
    expect(screen.getByText(/Wonderful day\./)).toBeInTheDocument();
  });
});
