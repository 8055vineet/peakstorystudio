import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const submit = vi.fn();
const reset = vi.fn();
let hookState = { status: 'idle', errorCode: null, fieldErrors: {} };

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('../../hooks/useInquirySubmission', () => ({
  useInquirySubmission: () => ({ ...hookState, submit, reset }),
}));

vi.mock('../../hooks/useTurnstile', () => ({
  useTurnstile: () => ({
    containerRef: { current: null },
    token: 'test-token',
    ready: true,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../../lib/queries/inquiries', () => ({
  isInquiryBackendConfigured: true,
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
}));

const { default: BookingForm } = await import('../BookingForm.jsx');

async function fillValidForm(user) {
  await user.type(screen.getByLabelText(/couple \/ contact name/i), 'Ananya & Rohan');
  await user.type(screen.getByLabelText(/email address/i), 'couple@example.com');
  await user.type(screen.getByLabelText(/phone number/i), '+91 98200 00000');
  // jsdom sanitises a date input's value on every keystroke, so typing an ISO
  // date one character at a time leaves it empty. Set it in one go.
  fireEvent.change(screen.getByLabelText(/wedding date/i), { target: { value: '2027-02-14' } });
  await user.type(screen.getByLabelText(/event location/i), 'Umaid Bhawan Palace');
}

describe('BookingForm', () => {
  beforeEach(async () => {
    submit.mockReset().mockResolvedValue(true);
    reset.mockReset();
    hookState = { status: 'idle', errorCode: null, fieldErrors: {} };
    // Shared across tests because the module is mocked once. Without this, a
    // later test asserting confetti has NOT fired sees an earlier test's call.
    const confetti = (await import('canvas-confetti')).default;
    confetti.mockClear();
  });

  it('shows inline validation and does not submit when fields are invalid', async () => {
    const user = userEvent.setup();
    render(<BookingForm />);

    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));

    expect(await screen.findByText(/we need an email address/i)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits a valid inquiry with the honeypot empty and the captcha token', async () => {
    const user = userEvent.setup();
    render(<BookingForm />);
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({
      name: 'Ananya & Rohan',
      email: 'couple@example.com',
      venue: 'Umaid Bhawan Palace',
      weddingDate: '2027-02-14',
      website: '',
      turnstileToken: 'test-token',
    });
  });

  it('disables the button and shows sending while in flight', () => {
    hookState = { status: 'pending', errorCode: null, fieldErrors: {} };
    render(<BookingForm />);

    const button = screen.getByRole('button', { name: /sending/i });
    expect(button).toBeDisabled();
  });

  it('fires confetti only after a confirmed submission', async () => {
    const confetti = (await import('canvas-confetti')).default;
    const user = userEvent.setup();
    render(<BookingForm />);
    await fillValidForm(user);

    expect(confetti).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));

    await waitFor(() => expect(confetti).toHaveBeenCalled());
  });

  it('does not fire confetti or show success when submission fails', async () => {
    const confetti = (await import('canvas-confetti')).default;
    submit.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<BookingForm />);
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(confetti).not.toHaveBeenCalled();
    expect(screen.queryByText(/inquiry received/i)).not.toBeInTheDocument();
  });

  it.each([
    ['RATE_LIMITED', /too many/i],
    ['CAPTCHA_FAILED', /did not pass/i],
    ['CAPTCHA_UNAVAILABLE', /this is on us, not you/i],
    ['PAYLOAD_TOO_LARGE', /longer than the form can send/i],
    ['NETWORK_ERROR', /could not reach/i],
    ['BACKEND_UNCONFIGURED', /not accepting/i],
  ])('explains %s and always offers a way through', async (code, pattern) => {
    hookState = { status: 'error', errorCode: code, fieldErrors: {} };
    render(<BookingForm />);

    expect(screen.getByText(pattern)).toBeInTheDocument();
    // A mailto link, not just the address as text — the left-hand contact
    // column already renders it as plain text, so asserting on the text alone
    // would pass even with the error panel's fallback missing entirely.
    const mailto = screen.getByRole('link', { name: /inquiries@peakstorystudio\.com/i });
    expect(mailto).toHaveAttribute('href', 'mailto:inquiries@peakstorystudio.com');
  });

  it('renders server field errors returned by the function', () => {
    hookState = {
      status: 'error',
      errorCode: 'VALIDATION_FAILED',
      fieldErrors: { email: 'That email address does not look right.' },
    };
    render(<BookingForm />);

    expect(screen.getByText(/that email address does not look right/i)).toBeInTheDocument();
  });

  it('shows the success panel when the submission succeeded', () => {
    hookState = { status: 'success', errorCode: null, fieldErrors: {} };
    render(<BookingForm />);

    expect(screen.getByText(/inquiry received/i)).toBeInTheDocument();
  });

  it('keeps a hidden honeypot out of the tab order', () => {
    const { container } = render(<BookingForm />);
    const honeypot = container.querySelector('input[name="website"]');

    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot).toHaveAttribute('autocomplete', 'off');
  });
});
