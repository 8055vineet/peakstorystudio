import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LeadDetail from '../LeadDetail.jsx';

const INQUIRY = {
  id: 'inq-1',
  name: 'Ananya & Rohan',
  email: 'ananya@example.test',
  phone: '+91 98200 00000',
  weddingDate: '2027-02-14',
  venue: 'Umaid Bhawan Palace',
  services: ['Cinematic Film', 'Fine Art Photography'],
  message: 'We would love to hear more about your destination packages.',
  status: 'new',
  notificationStatus: 'sent',
  createdAt: '2026-08-01T10:00:00Z',
};

describe('LeadDetail', () => {
  it('shows the full message and every requested service', () => {
    render(<LeadDetail inquiry={INQUIRY} onUpdateStatus={vi.fn()} />);

    expect(screen.getByText(INQUIRY.message)).toBeInTheDocument();
    expect(screen.getByText('Cinematic Film')).toBeInTheDocument();
    expect(screen.getByText('Fine Art Photography')).toBeInTheDocument();
  });

  it('offers all four status transitions', () => {
    render(<LeadDetail inquiry={INQUIRY} onUpdateStatus={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contacted' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Booked' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archived' })).toBeInTheDocument();
  });

  it('calls onUpdateStatus with the id and the chosen status', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onUpdateStatus = vi.fn().mockResolvedValue({ ...INQUIRY, status: 'contacted' });
    render(<LeadDetail inquiry={INQUIRY} onUpdateStatus={onUpdateStatus} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Contacted' }));

    expect(onUpdateStatus).toHaveBeenCalledWith('inq-1', 'contacted');
  });

  it('disables every transition control while a change is in flight', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    let release;
    const onUpdateStatus = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    render(<LeadDetail inquiry={INQUIRY} onUpdateStatus={onUpdateStatus} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Contacted' }));

    expect(screen.getByRole('button', { name: 'Contacted' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Booked' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Archived' })).toBeDisabled();

    release({ ...INQUIRY, status: 'contacted' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Booked' })).not.toBeDisabled());
  });

  it('surfaces a failed change and does not show the new status as if it had applied', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onUpdateStatus = vi.fn().mockRejectedValue(new Error('update rejected by RLS'));
    render(<LeadDetail inquiry={INQUIRY} onUpdateStatus={onUpdateStatus} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Booked' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not update|try again/i);
    // The component only ever reflects the `inquiry` prop it was given — it
    // never fabricates a new status locally, so re-rendering with the same
    // (unchanged) prop is what "did not apply" looks like from outside.
    expect(screen.getByRole('button', { name: 'New' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Booked' })).not.toBeDisabled();
  });

  it('re-enables the controls once a failed change settles', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onUpdateStatus = vi.fn().mockRejectedValue(new Error('network down'));
    render(<LeadDetail inquiry={INQUIRY} onUpdateStatus={onUpdateStatus} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Booked' }));
    await screen.findByRole('alert');

    expect(screen.getByRole('button', { name: 'Contacted' })).not.toBeDisabled();
  });

  it('renders a placeholder rather than crashing when nothing is selected', () => {
    render(<LeadDetail inquiry={null} onUpdateStatus={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
  });

  it('renders no delete affordance', () => {
    render(<LeadDetail inquiry={INQUIRY} onUpdateStatus={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /delete/i })).not.toBeInTheDocument();
  });
});
