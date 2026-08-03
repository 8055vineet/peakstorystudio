import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const useSession = vi.fn();
const listInquiries = vi.fn();
const updateInquiryStatus = vi.fn();
const listMedia = vi.fn();
const weddingsList = vi.fn();
const weddingsCreate = vi.fn();
const weddingsUpdate = vi.fn();
const weddingsRemove = vi.fn();
const weddingsReorder = vi.fn();
const listWeddingPhotos = vi.fn();
const addWeddingPhoto = vi.fn();
const removeWeddingPhoto = vi.fn();
const reorderWeddingPhotos = vi.fn();

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

// The Weddings tab's dashboard (WeddingsDashboard, also defined in App.jsx)
// is deliberately mocked at the resource-config boundary rather than
// re-testing everything src/admin/resources/__tests__/weddings.test.js and
// weddings.timezone.test.jsx already cover — a small fixture-shaped config
// (no media/date/tags fields) keeps these tests about App.jsx's own wiring
// — tab switching, create/edit/delete/toggle/reorder reaching
// weddingsQueries, WeddingPhotos appearing once a wedding has an id — not
// about re-proving the real field list or the slug/date behaviour those
// other two files already own.
vi.mock('../resources/weddings.js', () => ({
  weddingsResource: {
    key: 'weddings',
    label: 'Weddings',
    table: 'weddings',
    columns: ['id', 'title', 'couple', 'location', 'sort_order', 'status'],
    defaultSort: 'sort_order',
    listColumns: [
      { name: 'title', label: 'Title' },
      { name: 'couple', label: 'Couple' },
      { name: 'status', label: 'Status' },
    ],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'couple', label: 'Couple', type: 'text', required: true },
      { name: 'location', label: 'Location', type: 'text', required: true },
      { name: 'sortOrder', label: 'Order', type: 'number', required: false },
    ],
  },
  weddingsQueries: {
    list: (...args) => weddingsList(...args),
    create: (...args) => weddingsCreate(...args),
    update: (...args) => weddingsUpdate(...args),
    remove: (...args) => weddingsRemove(...args),
    reorder: (...args) => weddingsReorder(...args),
  },
}));

// WeddingPhotos (rendered once an edit screen's wedding has an id) drives
// these directly — mocked the same way listInquiries/listMedia are above,
// so opening the edit screen in these tests never reaches the real
// Supabase-backed query layer.
vi.mock('../../lib/queries/adminWeddingPhotos', () => ({
  listWeddingPhotos: (...args) => listWeddingPhotos(...args),
  addWeddingPhoto: (...args) => addWeddingPhoto(...args),
  removeWeddingPhoto: (...args) => removeWeddingPhoto(...args),
  reorderWeddingPhotos: (...args) => reorderWeddingPhotos(...args),
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
  weddingsList.mockReset();
  weddingsCreate.mockReset();
  weddingsUpdate.mockReset();
  weddingsRemove.mockReset();
  weddingsReorder.mockReset();
  listWeddingPhotos.mockReset();
  addWeddingPhoto.mockReset();
  removeWeddingPhoto.mockReset();
  reorderWeddingPhotos.mockReset();
  listInquiries.mockResolvedValue([]);
  listMedia.mockResolvedValue([]);
  weddingsList.mockResolvedValue([]);
  listWeddingPhotos.mockResolvedValue([]);
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

  // WeddingsDashboard (defined in App.jsx) is the main content screen this
  // admin ships — tab switching, create/edit through ResourceForm,
  // delete/publish-toggle/reorder through ResourceList, error surfacing for
  // both the list load and a list-row action, and the rule that
  // WeddingPhotos only mounts once a wedding has an id. The resource config
  // mocked at the top of this file (title/couple/location/sortOrder, no
  // date/media/tags fields) keeps these tests about App.jsx's own wiring —
  // resources/__tests__/weddings.test.js and weddings.timezone.test.jsx
  // already own the real field list and the date-shift guard.
  describe('Weddings tab', () => {
    function signIn() {
      useSession.mockReturnValue({
        ...baseState,
        status: 'authenticated',
        session: { user: { id: 'user-2', email: 'admin@example.test' } },
        profile: { userId: 'user-2', role: 'admin', displayName: 'Studio Director' },
      });
    }

    const WEDDING_A = {
      id: 'wedding-1', title: 'A Palace Wedding', couple: 'Aisha & Dev', location: 'Udaipur', sortOrder: 0, status: 'draft',
    };
    const WEDDING_B = {
      id: 'wedding-2', title: 'A Garden Wedding', couple: 'Priya & Arjun', location: 'Jaipur', sortOrder: 1, status: 'published',
    };

    it('switches to the weddings tab and lists weddings via weddingsQueries.list, not before', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      weddingsList.mockResolvedValue([WEDDING_A]);
      signIn();
      render(<App />);

      // Weddings is not the default tab — nothing here should fetch weddings
      // nobody has gone looking for yet, same principle as the Media
      // Library tab's own "not fetched until asked for" test above.
      expect(weddingsList).not.toHaveBeenCalled();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /weddings/i }));

      expect(screen.getByRole('heading', { level: 1, name: /weddings/i })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('A Palace Wedding')).toBeInTheDocument());
      expect(weddingsList).toHaveBeenCalled();
    });

    it('creates a wedding through ResourceForm and calls weddingsQueries.create with the entered values', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      weddingsList.mockResolvedValueOnce([]);
      weddingsCreate.mockResolvedValue({ id: 'wedding-9' });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /weddings/i }));
      await waitFor(() => expect(screen.getByText(/no weddings yet/i)).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /add new/i }));
      expect(screen.getByRole('heading', { name: /add wedding/i })).toBeInTheDocument();

      await user.type(screen.getByLabelText(/title/i), 'A Palace Wedding');
      await user.type(screen.getByLabelText(/couple/i), 'Aisha & Dev');
      await user.type(screen.getByLabelText(/location/i), 'Udaipur');

      weddingsList.mockResolvedValueOnce([WEDDING_A]);
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => expect(weddingsCreate).toHaveBeenCalledWith(expect.objectContaining({
        title: 'A Palace Wedding', couple: 'Aisha & Dev', location: 'Udaipur',
      })));
      // Returns to the list screen once the create actually resolves.
      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: /weddings/i })).toBeInTheDocument());
    });

    it('edits a wedding through ResourceForm, prefilling its values, and calls weddingsQueries.update with its id', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      weddingsList.mockResolvedValue([WEDDING_A]);
      weddingsUpdate.mockResolvedValue({ ...WEDDING_A, location: 'Jaipur' });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /weddings/i }));
      await waitFor(() => expect(screen.getByText('A Palace Wedding')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /edit/i }));
      expect(screen.getByRole('heading', { name: /edit wedding/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/location/i)).toHaveValue('Udaipur');

      await user.clear(screen.getByLabelText(/location/i));
      await user.type(screen.getByLabelText(/location/i), 'Jaipur');

      weddingsList.mockResolvedValueOnce([{ ...WEDDING_A, location: 'Jaipur' }]);
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(weddingsUpdate).toHaveBeenCalledWith('wedding-1', expect.objectContaining({ location: 'Jaipur' })));
    });

    it('a failed edit keeps the form open and shows the failure — no optimistic return to the list', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      weddingsList.mockResolvedValue([WEDDING_A]);
      weddingsUpdate.mockRejectedValue(new Error('duplicate slug'));
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /weddings/i }));
      await waitFor(() => expect(screen.getByText('A Palace Wedding')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /edit/i }));
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/duplicate slug/i));
      // Still on the edit screen — a failed submit must not bounce back to
      // the list as if it had succeeded.
      expect(screen.getByRole('heading', { name: /edit wedding/i })).toBeInTheDocument();
    });

    it('deletes a wedding after confirmation and calls weddingsQueries.remove with its id', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      weddingsList.mockResolvedValueOnce([WEDDING_A]);
      weddingsRemove.mockResolvedValue({});
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /weddings/i }));
      await waitFor(() => expect(screen.getByText('A Palace Wedding')).toBeInTheDocument());

      weddingsList.mockResolvedValueOnce([]);
      await user.click(screen.getByRole('button', { name: /delete/i }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(weddingsRemove).toHaveBeenCalledWith('wedding-1');
      await waitFor(() => expect(screen.getByText(/no weddings yet/i)).toBeInTheDocument());
      confirmSpy.mockRestore();
    });

    it('a failed publish toggle leaves the old status on screen and surfaces the failure — no optimistic UI', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      weddingsList.mockResolvedValue([WEDDING_A]);
      weddingsUpdate.mockRejectedValue(new Error('permission denied'));
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /weddings/i }));
      await waitFor(() => expect(screen.getByText('A Palace Wedding')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /draft/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not save that change: permission denied/i));
      expect(weddingsUpdate).toHaveBeenCalledWith('wedding-1', { status: 'published' });
      // No reload ever ran (the write itself rejected), so the toggle must
      // still read Draft rather than having flipped ahead of the database.
      expect(screen.getByRole('button', { name: /draft/i })).toBeInTheDocument();
    });

    it('reorders weddings and calls weddingsQueries.reorder with the new id order', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      weddingsList.mockResolvedValue([WEDDING_A, WEDDING_B]);
      weddingsReorder.mockResolvedValue({ ok: true });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /weddings/i }));
      await waitFor(() => expect(screen.getByText('A Palace Wedding')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /move down: a palace wedding/i }));

      expect(weddingsReorder).toHaveBeenCalledWith(['wedding-2', 'wedding-1']);
    });

    it('shows a distinct load-error state with retry, different from the empty state', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      weddingsList.mockRejectedValueOnce(new Error('network down'));
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /weddings/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not load weddings: network down/i));
      expect(screen.queryByText(/no weddings yet/i)).not.toBeInTheDocument();

      weddingsList.mockResolvedValueOnce([]);
      await user.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => expect(screen.getByText(/no weddings yet/i)).toBeInTheDocument());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('does not render WeddingPhotos for a brand-new, unsaved wedding', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      weddingsList.mockResolvedValueOnce([]);
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /weddings/i }));
      await waitFor(() => expect(screen.getByText(/no weddings yet/i)).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /add new/i }));

      expect(screen.getByRole('heading', { name: /add wedding/i })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Photographs' })).not.toBeInTheDocument();
      expect(listWeddingPhotos).not.toHaveBeenCalled();
    });

    it('renders WeddingPhotos, scoped to that wedding, once editing a wedding that has an id', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      weddingsList.mockResolvedValue([WEDDING_A]);
      listWeddingPhotos.mockResolvedValue([]);
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /weddings/i }));
      await waitFor(() => expect(screen.getByText('A Palace Wedding')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /edit/i }));

      expect(screen.getByRole('heading', { name: 'Photographs' })).toBeInTheDocument();
      await waitFor(() => expect(listWeddingPhotos).toHaveBeenCalledWith('wedding-1'));
    });
  });
});
