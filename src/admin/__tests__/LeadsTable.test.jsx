import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeadsTable from '../LeadsTable.jsx';

const ITEMS = [
  {
    id: 'inq-1',
    name: 'Ananya & Rohan',
    email: 'ananya@example.test',
    phone: '+91 98200 00000',
    weddingDate: '2027-02-14',
    venue: 'Umaid Bhawan Palace',
    services: ['Cinematic Film'],
    message: 'We would love to hear more.',
    status: 'new',
    notificationStatus: 'sent',
    createdAt: '2026-08-01T10:00:00Z',
  },
  {
    id: 'inq-2',
    name: 'Meera & Karan',
    email: 'meera@example.test',
    phone: '+91 98200 11111',
    weddingDate: '2027-03-01',
    venue: 'Lake Palace',
    services: ['Fine Art Photography'],
    message: 'Please call us back.',
    status: 'contacted',
    notificationStatus: 'failed',
    createdAt: '2026-08-02T10:00:00Z',
  },
];

describe('LeadsTable', () => {
  it('renders a row per inquiry with name, wedding date, venue, submitted date, and status', () => {
    render(<LeadsTable items={ITEMS} status="ready" error={null} onRetry={vi.fn()} onSelectLead={vi.fn()} />);

    expect(screen.getByText('Ananya & Rohan')).toBeInTheDocument();
    expect(screen.getByText('2027-02-14')).toBeInTheDocument();
    expect(screen.getByText('Umaid Bhawan Palace')).toBeInTheDocument();
    expect(screen.getByText(/Aug 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();

    expect(screen.getByText('Meera & Karan')).toBeInTheDocument();
  });

  it('marks a failed notification_status visibly and distinctly from a sent one', () => {
    render(<LeadsTable items={ITEMS} status="ready" error={null} onRetry={vi.fn()} onSelectLead={vi.fn()} />);

    // The row that was never emailed carries wording no other row does.
    expect(screen.getByText(/not notified/i)).toBeInTheDocument();
    // The sent row must not also read as "not notified".
    const notNotifiedMentions = screen.getAllByText(/not notified/i);
    expect(notNotifiedMentions).toHaveLength(1);
  });

  it('marks a skipped notification_status visibly too', () => {
    const items = [{ ...ITEMS[0], notificationStatus: 'skipped' }];
    render(<LeadsTable items={items} status="ready" error={null} onRetry={vi.fn()} onSelectLead={vi.fn()} />);

    expect(screen.getByText(/not notified/i)).toBeInTheDocument();
  });

  it('filters the rendered rows by status', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    render(<LeadsTable items={ITEMS} status="ready" error={null} onRetry={vi.fn()} onSelectLead={vi.fn()} />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText(/filter by status/i), 'contacted');

    expect(screen.queryByText('Ananya & Rohan')).not.toBeInTheDocument();
    expect(screen.getByText('Meera & Karan')).toBeInTheDocument();
  });

  it('shows a distinct empty state when there are no inquiries — not the error state', () => {
    render(<LeadsTable items={[]} status="ready" error={null} onRetry={vi.fn()} onSelectLead={vi.fn()} />);

    expect(screen.getByText(/no inquiries yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/could not load/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('shows a distinct error state with a retry control — not the empty state', () => {
    const onRetry = vi.fn();
    render(<LeadsTable items={[]} status="error" error={new Error('permission denied')} onRetry={onRetry} onSelectLead={vi.fn()} />);

    expect(screen.getByText(/could not load/i)).toBeInTheDocument();
    expect(screen.queryByText(/no inquiries yet/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls onRetry when the retry control is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onRetry = vi.fn();
    render(<LeadsTable items={[]} status="error" error={new Error('boom')} onRetry={onRetry} onSelectLead={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('still shows the error state even if items happen to be non-empty', () => {
    // Guards against the hook's "keep last known-good items on a failed
    // reload" behaviour being misread by this component as "we have data,
    // so render the table" — status must win.
    render(<LeadsTable items={ITEMS} status="error" error={new Error('boom')} onRetry={vi.fn()} onSelectLead={vi.fn()} />);

    expect(screen.getByText(/could not load/i)).toBeInTheDocument();
    expect(screen.queryByText('Ananya & Rohan')).not.toBeInTheDocument();
  });

  it('calls onSelectLead with the inquiry id when a row is opened', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onSelectLead = vi.fn();
    render(<LeadsTable items={ITEMS} status="ready" error={null} onRetry={vi.fn()} onSelectLead={onSelectLead} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByRole('button', { name: /view/i })[0]);

    expect(onSelectLead).toHaveBeenCalledWith('inq-1');
  });

  it('renders no delete affordance anywhere', () => {
    render(<LeadsTable items={ITEMS} status="ready" error={null} onRetry={vi.fn()} onSelectLead={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /delete/i })).not.toBeInTheDocument();
  });
});
