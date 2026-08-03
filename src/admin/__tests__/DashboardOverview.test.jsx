import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const getOverviewCounts = vi.fn();
vi.mock('../../lib/queries/adminOverview', () => ({
  getOverviewCounts: (...args) => getOverviewCounts(...args),
}));

import DashboardOverview from '../DashboardOverview.jsx';

const COUNTS = {
  newLeads: 2,
  weddings: { published: 1, draft: 0 },
  gallery: { published: 64, draft: 3 },
  films: { published: 3, draft: 1 },
  testimonials: { published: 3, draft: 0 },
};

beforeEach(() => getOverviewCounts.mockReset());

describe('DashboardOverview', () => {
  it('renders every count card once the fetch resolves', async () => {
    getOverviewCounts.mockResolvedValue(COUNTS);
    render(<DashboardOverview onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Weddings')).toBeInTheDocument());
    expect(screen.getByText('64')).toBeInTheDocument();
    expect(screen.getByText('3 drafts')).toBeInTheDocument();
  });

  it('shows the lead callout only when new leads exist', async () => {
    getOverviewCounts.mockResolvedValue(COUNTS);
    render(<DashboardOverview onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/2 new leads are waiting/i)).toBeInTheDocument());
  });

  it('hides the lead callout at zero', async () => {
    getOverviewCounts.mockResolvedValue({ ...COUNTS, newLeads: 0 });
    render(<DashboardOverview onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Weddings')).toBeInTheDocument());
    expect(screen.queryByText(/waiting — open booking inquiries/i)).toBeNull();
  });

  it('navigates to the clicked card’s tab', async () => {
    getOverviewCounts.mockResolvedValue(COUNTS);
    const onNavigate = vi.fn();
    render(<DashboardOverview onNavigate={onNavigate} />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText('Gallery Photos')).toBeInTheDocument());
    await user.click(screen.getByText('Gallery Photos'));
    expect(onNavigate).toHaveBeenCalledWith('gallery');
    await user.click(screen.getByText('New Leads'));
    expect(onNavigate).toHaveBeenCalledWith('leads');
  });

  it('renders an error with a working retry', async () => {
    getOverviewCounts.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(COUNTS);
    render(<DashboardOverview onNavigate={vi.fn()} />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/boom/));
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('Weddings')).toBeInTheDocument());
    expect(getOverviewCounts).toHaveBeenCalledTimes(2);
  });
});
