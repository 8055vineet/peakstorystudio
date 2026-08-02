import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const useSession = vi.fn();
const listInquiries = vi.fn();
const updateInquiryStatus = vi.fn();
const listMedia = vi.fn();

vi.mock('../../hooks/useSession', () => ({
  useSession: (...args) => useSession(...args),
}));

// The default-mounted dashboard (InquiriesDashboard, defined in App.jsx)
// calls the real useResource hook, which calls these. Mocked here the same
// way the query module is mocked in src/lib/queries/__tests__/*.test.js, so
// this stays a test of App.jsx's wiring rather than a network integration
// test.
vi.mock('../../lib/queries/adminInquiries', () => ({
  listInquiries: (...args) => listInquiries(...args),
  updateInquiryStatus: (...args) => updateInquiryStatus(...args),
  INQUIRY_STATUSES: ['new', 'contacted', 'booked', 'archived'],
}));

// The Media Library tab's dashboard (MediaLibraryDashboard, also defined in
// App.jsx) calls listMedia through the same useResource hook. UploadField's
// own useMediaUpload hook is mocked wholesale — these tests are about the
// shell's tab wiring, not the upload pipeline Task 5 already proved and
// UploadField.test.jsx already exercises against a mocked hook of its own.
vi.mock('../../lib/queries/media', () => ({
  listMedia: (...args) => listMedia(...args),
}));
vi.mock('../../hooks/useMediaUpload', () => ({
  useMediaUpload: () => ({
    status: 'idle', progress: 0, error: null, upload: vi.fn(), reset: vi.fn(),
  }),
}));

const { default: App } = await import('../App.jsx');

const baseState = {
  session: null,
  profile: null,
  error: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
};

beforeEach(() => {
  useSession.mockReset();
  listInquiries.mockReset();
  updateInquiryStatus.mockReset();
  listMedia.mockReset();
  listInquiries.mockResolvedValue([]);
  listMedia.mockResolvedValue([]);
  baseState.signIn = vi.fn();
  baseState.signOut = vi.fn();
});

describe('admin App shell', () => {
  it('renders a loading state and no form while status is loading', () => {
    useSession.mockReturnValue({ ...baseState, status: 'loading' });
    render(<App />);

    expect(screen.getByText(/checking your session/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it('renders the sign-in form when anonymous', () => {
    useSession.mockReturnValue({ ...baseState, status: 'anonymous' });
    render(<App />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('renders a refusal naming the account and offers sign-out when forbidden — not the sign-in form', () => {
    const signOut = vi.fn();
    useSession.mockReturnValue({
      ...baseState,
      status: 'forbidden',
      session: { user: { id: 'user-1', email: 'couple@example.test' } },
      profile: { userId: 'user-1', role: 'client', displayName: 'A Couple' },
      signOut,
    });
    render(<App />);

    expect(screen.getByText(/A Couple/)).toBeInTheDocument();
    // Not a dead end: someone who is already signed in must never be shown
    // a form that tells them to do the thing they already did.
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
  });

  it('falls back to the session email when a forbidden session has no profile row at all', () => {
    // useSession's own contract: getProfile can resolve null (no row), and
    // that must still land on 'forbidden', never crash the refusal screen.
    useSession.mockReturnValue({
      ...baseState,
      status: 'forbidden',
      session: { user: { id: 'user-1', email: 'no-profile@example.test' } },
      profile: null,
    });
    render(<App />);

    expect(screen.getByText(/no-profile@example\.test/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
  });

  it('renders children and a sign-out control when authenticated', () => {
    const signOut = vi.fn();
    useSession.mockReturnValue({
      ...baseState,
      status: 'authenticated',
      session: { user: { id: 'user-2', email: 'admin@example.test' } },
      profile: { userId: 'user-2', role: 'admin', displayName: 'Studio Director' },
      signOut,
    });
    render(<App><p>Dashboard content</p></App>);

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
  });

  it('mounts the leads dashboard by default when authenticated and no children are supplied', async () => {
    listInquiries.mockResolvedValue([{
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
    }]);
    useSession.mockReturnValue({
      ...baseState,
      status: 'authenticated',
      session: { user: { id: 'user-2', email: 'admin@example.test' } },
      profile: { userId: 'user-2', role: 'admin', displayName: 'Studio Director' },
    });

    render(<App />);

    expect(screen.getByText(/booking inquiries/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Ananya & Rohan')).toBeInTheDocument());
    expect(listInquiries).toHaveBeenCalled();
  });

  it('does not render the dashboard for a status it does not recognise', () => {
    // Falling through to the dashboard because a value was not one of the
    // three recognised states is deciding access from ignorance. Unreachable
    // while the status union stays closed — which is exactly when a
    // fall-through survives review and outlives the assumption behind it.
    useSession.mockReturnValue({
      ...baseState,
      status: 'something-unrecognised',
      session: { user: { id: 'user-3', email: 'someone@example.test' } },
    });
    render(<App><p>Dashboard content</p></App>);

    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it('calls signOut when the sign-out control is clicked while forbidden', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const signOut = vi.fn();
    useSession.mockReturnValue({
      ...baseState,
      status: 'forbidden',
      session: { user: { id: 'user-1', email: 'couple@example.test' } },
      profile: { userId: 'user-1', role: 'client', displayName: 'A Couple' },
      signOut,
    });
    render(<App />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sign Out' }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  describe('Media Library tab', () => {
    function signIn() {
      useSession.mockReturnValue({
        ...baseState,
        status: 'authenticated',
        session: { user: { id: 'user-2', email: 'admin@example.test' } },
        profile: { userId: 'user-2', role: 'admin', displayName: 'Studio Director' },
      });
    }

    it('switches to the media library and lists it via listMedia when the tab is opened', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      listMedia.mockResolvedValue([{
        id: 'media-1',
        storagePath: 'uploads/one.webp',
        width: 2000,
        height: 1500,
        altText: 'A couple at dusk.',
        blurhash: null,
        createdAt: '2026-08-01T10:00:00Z',
      }]);
      signIn();
      render(<App />);
      const user = userEvent.setup();

      // Leads is the default tab — Media Library is not fetched until asked
      // for, same principle as useResource's own "one hook instance per
      // resource" constraint (see its module comment): nothing here should
      // pull media rows nobody has gone looking for yet.
      expect(listMedia).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /media library/i }));

      expect(screen.getByRole('heading', { name: /media library/i })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());
      expect(listMedia).toHaveBeenCalled();
    });

    it('still shows the leads dashboard first, unaffected by the new tab existing', async () => {
      signIn();
      render(<App />);

      expect(screen.getByText(/booking inquiries/i)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /media library/i })).not.toBeInTheDocument();
      // Lets InquiriesDashboard's own listInquiries() call resolve — and the
      // state update that follows actually land — before the test ends, so
      // it isn't left dangling outside act().
      await waitFor(() => expect(screen.getByText(/no inquiries yet/i)).toBeInTheDocument());
    });

    it('switching back to Leads does not re-render Dashboard content passed as explicit children', async () => {
      // The tab shell only replaces App's *default* children — an explicit
      // children override (as every other test in this file uses to isolate
      // the session-gate behaviour) must keep bypassing it entirely.
      signIn();
      render(<App><p>Dashboard content</p></App>);

      expect(screen.getByText('Dashboard content')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /media library/i })).not.toBeInTheDocument();
    });
  });
});
