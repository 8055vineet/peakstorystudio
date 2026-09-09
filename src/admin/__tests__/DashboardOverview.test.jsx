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
  pages: { published: 1, draft: 2 },
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

  it('renders a Pages card that navigates to the pages tab', async () => {
    getOverviewCounts.mockResolvedValue(COUNTS);
    const onNavigate = vi.fn();
    render(<DashboardOverview onNavigate={onNavigate} />);
    await waitFor(() => expect(screen.getByText('Pages')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByText('Pages'));
    expect(onNavigate).toHaveBeenCalledWith('pages');
  });
});

// The Publishing card: the freshness loop's Overview widget (spec section
// 6). `publish` is the object AdminDashboard's single usePublishStatus
// instance returns — passed in as a prop so this file needs no hook mock
// and the App shell tests can mock the hook module once.
describe('DashboardOverview publishing card', () => {
  const NOW = new Date('2026-09-08T12:00:00Z');
  const minutesBefore = (minutes) => new Date(NOW.getTime() - minutes * 60_000);

  function publishState(overrides = {}) {
    return {
      status: 'idle',
      lastBuiltAt: minutesBefore(12),
      changesWaitingSince: null,
      lastDispatchAt: minutesBefore(15),
      lastDispatchStatus: 'ok',
      waitingTooLong: false,
      busy: false,
      lastResult: null,
      error: null,
      refresh: vi.fn(),
      rebuild: vi.fn(),
      ...overrides,
    };
  }

  async function renderLoaded(publish) {
    getOverviewCounts.mockResolvedValue(COUNTS);
    render(<DashboardOverview onNavigate={vi.fn()} publish={publish} now={NOW} />);
    await waitFor(() => expect(screen.getByText('Publishing')).toBeInTheDocument());
  }

  it('shows when the site was last published, relative to now', async () => {
    await renderLoaded(publishState());
    expect(screen.getByText(/site last published 12 minutes ago/i)).toBeInTheDocument();
  });

  it('says "Not published yet" when no build info is known', async () => {
    await renderLoaded(publishState({ status: 'unknown', lastBuiltAt: null }));
    expect(screen.getByText(/not published yet/i)).toBeInTheDocument();
  });

  it('shows the waiting line while changes are waiting', async () => {
    await renderLoaded(publishState({ status: 'waiting', changesWaitingSince: minutesBefore(2) }));
    expect(screen.getByText(/changes waiting since .* — publishing automatically…/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the dispatched line once a rebuild has been requested', async () => {
    await renderLoaded(publishState({ status: 'dispatched', lastDispatchAt: minutesBefore(1) }));
    expect(screen.getByText(/rebuild requested 1 minute ago — the site updates in a few minutes/i)).toBeInTheDocument();
  });

  it('says quietly that automatic rebuilds are not configured', async () => {
    await renderLoaded(publishState({ status: 'configured-missing' }));
    expect(screen.getByText(/automatic rebuilds are not configured on this environment/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('raises an alert with the manual fallback after 20 minutes of waiting', async () => {
    await renderLoaded(publishState({
      status: 'waiting', changesWaitingSince: minutesBefore(25), waitingTooLong: true,
    }));
    expect(screen.getByRole('alert')).toHaveTextContent(/still waiting after 20 minutes.*cloudflare dashboard.*retry/i);
  });

  it('"Rebuild now" calls rebuild(true) and is disabled while busy', async () => {
    const rebuild = vi.fn();
    await renderLoaded(publishState({ rebuild }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /rebuild now/i }));
    expect(rebuild).toHaveBeenCalledWith(true);
  });

  it('disables "Rebuild now" while a request is in flight', async () => {
    await renderLoaded(publishState({ busy: true }));
    expect(screen.getByRole('button', { name: /rebuild now/i })).toBeDisabled();
  });

  it('reports a successful dispatch under the button', async () => {
    await renderLoaded(publishState({
      lastResult: {
        ok: true, dispatched: true, reason: 'forced', status: 'ok',
      },
    }));
    expect(screen.getByText('Rebuild requested')).toBeInTheDocument();
  });

  it('reports a skipped dispatch with its reason', async () => {
    await renderLoaded(publishState({ lastResult: { ok: true, dispatched: false, reason: 'window_busy' } }));
    expect(screen.getByText('Skipped: window_busy')).toBeInTheDocument();
  });

  it('reports a hook POST that failed with its status', async () => {
    await renderLoaded(publishState({
      lastResult: {
        ok: true, dispatched: false, reason: 'forced', status: 'http_500',
      },
    }));
    expect(screen.getByText('Skipped: http_500')).toBeInTheDocument();
  });

  it('reports "Not configured" and an error code', async () => {
    await renderLoaded(publishState({ lastResult: { ok: false, error: 'NOT_CONFIGURED' } }));
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('reports a failed call by its error code', async () => {
    await renderLoaded(publishState({ lastResult: { ok: false, error: 'FORBIDDEN' } }));
    expect(screen.getByText('FORBIDDEN')).toBeInTheDocument();
  });

  it('renders without a publish prop at all (the card simply says nothing is known)', async () => {
    getOverviewCounts.mockResolvedValue(COUNTS);
    render(<DashboardOverview onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Publishing')).toBeInTheDocument());
    expect(screen.getByText(/not published yet/i)).toBeInTheDocument();
  });
  it('says the last attempt failed and that it will retry, instead of pretending a rebuild is under way', async () => {
    await renderLoaded(publishState({
      status: 'waiting', changesWaitingSince: minutesBefore(2), lastDispatchAt: minutesBefore(1), lastDispatchStatus: 'http_500',
    }));
    expect(screen.getByText(/Last attempt failed \(http_500\)/)).toBeInTheDocument();
  });

});
