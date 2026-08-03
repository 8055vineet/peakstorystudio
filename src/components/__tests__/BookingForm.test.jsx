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

// Mutable so a test can put the widget in the state it occupies on first
// load and after every reset: mounted, but no token issued yet.
let turnstileToken = 'test-token';

vi.mock('../../hooks/useTurnstile', () => ({
  useTurnstile: () => ({
    containerRef: { current: null },
    token: turnstileToken,
    ready: true,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../../lib/queries/inquiries', () => ({
  isInquiryBackendConfigured: true,
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
}));

// A real number, so WhatsAppButton actually renders (it renders nothing when
// unset) and the failure-panel prefill test below has a link to inspect.
// This also makes the left contact column's WhatsAppButton render on every
// test in this file, which is why the prefill test below scopes its query to
// the error panel rather than asking for "the" WhatsApp link.
// Only WHATSAPP_NUMBER is overridden, and it is sourced from an environment
// variable so a fresh clone renders no WhatsApp button at all. The rest come
// from the real module on purpose: src/data/contact.js exists to be the one
// file Phase 7 corrects when the studio confirms its details, and a second
// copy here would quietly defeat that. The stand-in number is deliberately
// not a plausible one — nothing in this repo should read as a real contact
// number that nobody has verified.
vi.mock('../../data/contact', async (importOriginal) => ({
  ...await importOriginal(),
  WHATSAPP_NUMBER: '10000000000',
}));

const { HONEYPOT_FIELD } = await import('@shared/inquiry-validation.js');
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
    turnstileToken = 'test-token';
    // Shared across tests because the module is mocked once. Without this, a
    // later test asserting confetti has NOT fired sees an earlier test's call.
    const confetti = (await import('canvas-confetti')).default;
    confetti.mockClear();
  });

  it('will not let a couple submit before the widget has issued a token', () => {
    // Submitting without one earns a 403 whose copy says the verification
    // check did not pass — blaming the couple for a widget that had simply
    // not finished. Reachable on first load and after every failed attempt,
    // since each one resets the widget.
    turnstileToken = '';
    render(<BookingForm />);

    const button = screen.getByRole('button', { name: /just a moment/i });
    expect(button).toBeDisabled();
    expect(screen.queryByRole('button', { name: /send booking inquiry/i })).not.toBeInTheDocument();
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
      [HONEYPOT_FIELD]: '',
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
    const mailto = screen.getByRole('link', { name: /peakstorystudio@gmail\.com/i });
    expect(mailto).toHaveAttribute('href', 'mailto:peakstorystudio@gmail.com');
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
    const honeypot = container.querySelector(`input[name="${HONEYPOT_FIELD}"]`);

    expect(honeypot).not.toBeNull();
    // The name must not be something a browser or password manager
    // recognises. It was `website`, autofill filled it for a real visitor,
    // and their booking inquiry was discarded as bot traffic.
    expect(HONEYPOT_FIELD).not.toMatch(/website|url|company|address|email|phone/i);
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot).not.toHaveAttribute('autocomplete', 'off');
    expect(honeypot).toHaveAttribute('aria-hidden', 'true');
    // display:none / visibility:hidden would let a spam bot's own client-side
    // rendering skip the field entirely, defeating the trap — the input must
    // stay "visible" to a non-CSS-aware bot while being unreachable to a
    // person (off-screen position + zero opacity, asserted below via class).
    expect(honeypot.className).not.toMatch(/(?:^|\s)hidden(?:\s|$)/);
    expect(honeypot.className).not.toMatch(/(?:^|\s)invisible(?:\s|$)/);
    expect(honeypot.className).toMatch(/opacity-0/);
  });

  it('disables native browser form validation so validateInquiry is the only source of truth', () => {
    // Without noValidate, type="email" triggers the browser's own constraint
    // validation before the submit event fires — no handleSubmit call, no
    // inline message, just a native bubble. jsdom does not implement that
    // validation, so it cannot fail this test the way it fails in a real
    // browser; this assertion is the only thing standing between a future
    // edit and silently reintroducing that gap.
    const { container } = render(<BookingForm />);
    const form = container.querySelector('form');

    expect(form).toHaveAttribute('novalidate');
  });

  it('prefills the WhatsApp link on the failure panel with what the couple already typed', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<BookingForm />);
    await fillValidForm(user);

    hookState = { status: 'error', errorCode: 'SERVER_ERROR', fieldErrors: {} };
    rerender(<BookingForm />);

    // Scoped to the error panel, not "the" WhatsApp link — the left contact
    // column renders its own (with the generic default message) on every
    // render, so an unscoped query would be ambiguous once both are present.
    const link = container.querySelector('[role="alert"] a[href^="https://wa.me/"]');
    expect(link).not.toBeNull();
    // searchParams.get already decodes once. Decoding its result again would
    // make this assertion pass against a double-encoded href too, which is
    // precisely the bug worth catching — a couple would then see literal
    // %26 in WhatsApp instead of the ampersand in their own names.
    const message = new URL(link.getAttribute('href')).searchParams.get('text');
    expect(message).toContain('Ananya & Rohan');
    expect(message).toContain('2027-02-14');
    expect(message).toContain('Umaid Bhawan Palace');
  });

  it('says "about an hour" rather than "about 60 minutes" once the wait crosses an hour', () => {
    hookState = {
      status: 'error', errorCode: 'RATE_LIMITED', fieldErrors: {}, retryAfterSeconds: 3600,
    };
    render(<BookingForm />);

    expect(screen.getByText(/about an hour/i)).toBeInTheDocument();
    expect(screen.queryByText(/60 minutes/i)).not.toBeInTheDocument();
  });

  it('still counts in minutes below an hour', () => {
    hookState = {
      status: 'error', errorCode: 'RATE_LIMITED', fieldErrors: {}, retryAfterSeconds: 300,
    };
    render(<BookingForm />);

    expect(screen.getByText(/about 5 minutes/i)).toBeInTheDocument();
  });
});
