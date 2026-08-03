import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import {
  render, screen, waitFor, fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Step 2 of Task 8's brief: prove a wedding date does not shift, under at
// least Asia/Calcutta, America/Los_Angeles, and UTC. Phase 1b already lost a
// day to exactly this bug — see PS-022 in docs/KNOWN-ISSUES.md — so this
// exercises the REAL weddingsResource config through the REAL ResourceForm
// (not a fixture config, and not formatDate.js's already-covered pure
// functions), which is what an admin's browser actually renders and submits.
//
// vite.config.js pins the suite's own TZ to 'UTC' so unrelated assertions
// stay stable across machines; this file deliberately overrides
// process.env.TZ per zone under test, same technique as
// src/admin/__tests__/formatDate.test.js's own "does not shift the day in a
// timezone west of Greenwich" block — Node/the ICU Intl implementation reads
// process.env.TZ per Date/Intl call, so no process restart is needed for the
// override to take effect.

const listMedia = vi.fn();
vi.mock('../../../lib/queries/media', () => ({
  listMedia: (...args) => listMedia(...args),
}));
const useMediaUpload = vi.fn();
vi.mock('../../../hooks/useMediaUpload', () => ({
  useMediaUpload: (...args) => useMediaUpload(...args),
}));

const { default: ResourceForm } = await import('../../ResourceForm.jsx');
const { weddingsResource } = await import('../weddings.js');

beforeEach(() => {
  listMedia.mockReset();
  listMedia.mockResolvedValue([]);
  useMediaUpload.mockReset();
  useMediaUpload.mockReturnValue({
    status: 'idle', progress: 0, error: null, upload: vi.fn(), reset: vi.fn(),
  });
});

function baseProps(overrides = {}) {
  return {
    config: weddingsResource,
    initial: null,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    pending: false,
    error: null,
    ...overrides,
  };
}

// Deliberately includes one date either side of the UTC day boundary — the
// exact shape of the historical bug: new Date('2027-01-01') reads as
// 2027-01-01T00:00:00Z, which is already 2026-12-31 evening in any zone west
// of Greenwich (America/Los_Angeles here), and already 2027-01-01 morning in
// any zone east of it (Asia/Calcutta here) a few hours before UTC agrees.
const ZONES = ['Asia/Calcutta', 'America/Los_Angeles', 'UTC'];
const DATES = ['2027-01-01', '2026-12-31'];

describe.each(ZONES)('the wedding date field under TZ=%s', (zone) => {
  let originalTz;

  beforeEach(() => {
    originalTz = process.env.TZ;
    process.env.TZ = zone;
  });

  afterEach(() => {
    // Same hazard formatDate.test.js's own teardown documents: assigning
    // back an undefined original coerces to the STRING "undefined", leaving
    // every later test in the suite running under no resolved zone at all.
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it.each(DATES)('renders an existing event_date of %s unchanged in the date input', async (isoDate) => {
    render(<ResourceForm {...baseProps({
      initial: {
        id: 'wedding-1',
        title: 'A Wedding',
        couple: 'A & B',
        location: 'Udaipur',
        eventDate: isoDate,
        summary: '',
        coverMediaId: '',
        tags: [],
      },
    })}
    />);

    expect(screen.getByLabelText(/^date/i)).toHaveValue(isoDate);
    await waitFor(() => expect(screen.getByText(/no media yet/i)).toBeInTheDocument());
  });

  it.each(DATES)('stores a freshly-entered date of %s as that exact same calendar day, unchanged, on submit', async (isoDate) => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ResourceForm {...baseProps({ onSubmit })} />);

    await user.type(screen.getByLabelText(/^title/i), 'A Wedding');
    await user.type(screen.getByLabelText(/^couple/i), 'A & B');
    await user.type(screen.getByLabelText(/^location/i), 'Udaipur');
    // fireEvent rather than userEvent.type: jsdom's <input type="date"> does
    // not support per-character typing, and a plain change event is the most
    // direct way to prove nothing downstream constructs a Date from it.
    fireEvent.change(screen.getByLabelText(/^date/i), { target: { value: isoDate } });
    await user.click(screen.getByRole('button', { name: /^create/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ eventDate: isoDate }));
    await waitFor(() => expect(screen.getByText(/no media yet/i)).toBeInTheDocument());
  });

  it('round-trips an existing date unchanged when the form is submitted without editing it', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ResourceForm {...baseProps({
      initial: {
        id: 'wedding-1', title: 'A Wedding', couple: 'A & B', location: 'Udaipur', eventDate: '2027-01-01', summary: '', coverMediaId: '', tags: [],
      },
      onSubmit,
    })}
    />);

    await user.click(screen.getByRole('button', { name: /^(save|create)/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ eventDate: '2027-01-01' }));
    await waitFor(() => expect(screen.getByText(/no media yet/i)).toBeInTheDocument());
  });
});
