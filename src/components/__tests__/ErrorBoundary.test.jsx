import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

function Boom() {
  throw new Error('render exploded');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught render errors to console.error; silence it so the
    // expected failure does not look like a broken test run.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>Gallery content</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('Gallery content')).toBeInTheDocument();
  });

  it('renders the fallback instead of unmounting when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload the page/i })).toBeInTheDocument();
  });
});
