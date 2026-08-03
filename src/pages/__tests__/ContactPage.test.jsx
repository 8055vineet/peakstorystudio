import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// BookingForm mounts for real; its hooks are mocked exactly the way its own
// test file mocks them, so no network, Turnstile, or Supabase is touched.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('../../hooks/useInquirySubmission', () => ({
  useInquirySubmission: () => ({
    status: 'idle', errorCode: null, fieldErrors: {},
    retryAfterSeconds: null, submit: vi.fn(), reset: vi.fn(),
  }),
}));

vi.mock('../../hooks/useTurnstile', () => ({
  useTurnstile: () => ({
    containerRef: { current: null }, token: 'test-token',
    ready: true, error: null, reset: vi.fn(),
  }),
}));

vi.mock('../../lib/queries/inquiries', () => ({
  isInquiryBackendConfigured: true,
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
}));

const { default: ContactPage } = await import('../ContactPage.jsx');

describe('ContactPage', () => {
  it('opens with the page title and mounts the booking form', () => {
    render(<ContactPage />);
    expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send booking inquiry/i })).toBeInTheDocument();
  });

  it('shows the real studio details with tap-to-use links', () => {
    render(<ContactPage />);
    expect(screen.getByText(/2\/231 Vastu Khand, Gomtinagar, Lucknow, UP/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /peakstorystudio@gmail\.com/i }))
      .toHaveAttribute('href', 'mailto:peakstorystudio@gmail.com');
    expect(screen.getByRole('link', { name: /\+91 8881621021/ }))
      .toHaveAttribute('href', 'tel:+918881621021');
  });
});
