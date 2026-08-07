import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render, screen, waitFor, within, act,
} from '@testing-library/react';

const useSession = vi.fn();
const listInquiries = vi.fn();
const updateInquiryStatus = vi.fn();
const listMedia = vi.fn();
const getOverviewCounts = vi.fn();
const getSettingsRow = vi.fn();
const updateSiteSettings = vi.fn();
const weddingsList = vi.fn();
const weddingsCreate = vi.fn();
const weddingsUpdate = vi.fn();
const weddingsRemove = vi.fn();
const weddingsReorder = vi.fn();
const listWeddingPhotos = vi.fn();
const addWeddingPhoto = vi.fn();
const removeWeddingPhoto = vi.fn();
const reorderWeddingPhotos = vi.fn();
const galleryList = vi.fn();
const galleryCreate = vi.fn();
const galleryUpdate = vi.fn();
const galleryRemove = vi.fn();
const galleryReorder = vi.fn();
const filmsList = vi.fn();
const filmsCreate = vi.fn();
const filmsUpdate = vi.fn();
const filmsRemove = vi.fn();
const filmsReorder = vi.fn();
const testimonialsList = vi.fn();
const testimonialsCreate = vi.fn();
const testimonialsUpdate = vi.fn();
const testimonialsRemove = vi.fn();
const testimonialsReorder = vi.fn();
const collectionsList = vi.fn();
const collectionsCreate = vi.fn();
const collectionsUpdate = vi.fn();
const collectionsRemove = vi.fn();
const collectionsReorder = vi.fn();
const listCollectionItems = vi.fn();
const addCollectionPhoto = vi.fn();
const addCollectionVideo = vi.fn();
const removeCollectionItem = vi.fn();
const reorderCollectionItems = vi.fn();
const listGalleryCategories = vi.fn();
const addGalleryCategory = vi.fn();
const renameGalleryCategory = vi.fn();
const reorderGalleryCategories = vi.fn();
const removeGalleryCategory = vi.fn();
const listBookingServices = vi.fn();
const addBookingService = vi.fn();
const renameBookingService = vi.fn();
const reorderBookingServices = vi.fn();
const removeBookingService = vi.fn();

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

// The Dashboard landing tab fetches counts on mount, and the Settings tab
// reads/writes the settings row — both mocked at the query-module boundary
// like everything above, so the shell tests stay network-free.
vi.mock('../../lib/queries/adminOverview', () => ({
  getOverviewCounts: (...args) => getOverviewCounts(...args),
}));
vi.mock('../../lib/queries/adminSettings', () => ({
  getSettingsRow: (...args) => getSettingsRow(...args),
  updateSiteSettings: (...args) => updateSiteSettings(...args),
}));
vi.mock('../../hooks/useMediaUpload', () => ({
  useMediaUpload: () => ({
    status: 'idle',
    progress: 0,
    error: null,
    // Resolves a distinct media row per call so the bulk-add flow (each
    // upload → one gallery row) has real ids to work with.
    upload: vi.fn(async () => ({ id: `media-${Math.random().toString(36).slice(2, 8)}`, storagePath: 'uploads/x.webp' })),
    reset: vi.fn(),
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
      {
        name: 'sortOrder', label: 'Order', type: 'number', required: false, emptyValue: 0,
      },
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

// The Gallery, Films, and Testimonials tabs (Task 9) are mocked the same way
// and for the same reason as the Weddings tab immediately above: a small
// fixture-shaped config (plain text/number fields, no select or media field)
// keeps these tests about GalleryDashboard/FilmsDashboard/
// TestimonialsDashboard's own wiring in App.jsx — tab switching, create/
// edit/delete/toggle/reorder reaching the right queries — not about
// re-proving the real field lists (the `select` closed to five categories,
// the `select` closed to four grid spans, the media fields, the
// content-integrity help text) that
// src/admin/resources/__tests__/gallery.test.js,
// src/admin/resources/__tests__/films.test.js, and
// src/admin/resources/__tests__/testimonials.test.js already own, or the
// generic field-type behaviour ResourceForm.test.jsx already owns.
vi.mock('../resources/gallery.js', () => ({
  galleryResource: {
    key: 'gallery',
    label: 'Gallery',
    table: 'gallery_photos',
    columns: ['id', 'title', 'category', 'sort_order', 'status'],
    defaultSort: 'sort_order',
    listColumns: [
      { name: 'title', label: 'Title' },
      { name: 'category', label: 'Category' },
      { name: 'status', label: 'Status' },
    ],
    fields: [
      {
        name: 'mediaId', label: 'Photograph', type: 'media', required: false, emptyValue: null,
      },
      { name: 'title', label: 'Title', type: 'text', required: true },
      {
        name: 'category', label: 'Category', type: 'select', required: true, options: [],
      },
      {
        name: 'sortOrder', label: 'Order', type: 'number', required: false, emptyValue: 0,
      },
    ],
  },
  galleryQueries: {
    list: (...args) => galleryList(...args),
    create: (...args) => galleryCreate(...args),
    update: (...args) => galleryUpdate(...args),
    remove: (...args) => galleryRemove(...args),
    reorder: (...args) => galleryReorder(...args),
  },
}));

vi.mock('../resources/films.js', () => ({
  filmsResource: {
    key: 'films',
    label: 'Films',
    table: 'films',
    columns: ['id', 'title', 'couple', 'sort_order', 'status'],
    defaultSort: 'sort_order',
    listColumns: [
      { name: 'title', label: 'Title' },
      { name: 'couple', label: 'Couple' },
      { name: 'status', label: 'Status' },
    ],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      {
        name: 'couple', label: 'Couple', type: 'text', required: false, emptyValue: null,
      },
      {
        name: 'sortOrder', label: 'Order', type: 'number', required: false, emptyValue: 0,
      },
    ],
  },
  filmsQueries: {
    list: (...args) => filmsList(...args),
    create: (...args) => filmsCreate(...args),
    update: (...args) => filmsUpdate(...args),
    remove: (...args) => filmsRemove(...args),
    reorder: (...args) => filmsReorder(...args),
  },
}));

vi.mock('../resources/testimonials.js', () => ({
  testimonialsResource: {
    key: 'testimonials',
    label: 'Testimonials',
    table: 'testimonials',
    columns: ['id', 'quote', 'couple', 'sort_order', 'status'],
    defaultSort: 'sort_order',
    listColumns: [
      { name: 'couple', label: 'Couple' },
      { name: 'status', label: 'Status' },
    ],
    fields: [
      { name: 'quote', label: 'Quote', type: 'textarea', required: true },
      { name: 'couple', label: 'Couple', type: 'text', required: true },
      {
        name: 'sortOrder', label: 'Order', type: 'number', required: false, emptyValue: 0,
      },
    ],
  },
  testimonialsQueries: {
    list: (...args) => testimonialsList(...args),
    create: (...args) => testimonialsCreate(...args),
    update: (...args) => testimonialsUpdate(...args),
    remove: (...args) => testimonialsRemove(...args),
    reorder: (...args) => testimonialsReorder(...args),
  },
}));

// The Pages tab (Phase 3e) is mocked at the same two boundaries as the
// Weddings tab: a small fixture-shaped resource config, and the item
// queries its CollectionItems child drives.
vi.mock('../resources/collections.js', () => ({
  collectionsResource: {
    key: 'pages',
    label: 'Pages',
    table: 'collections',
    columns: ['id', 'slug', 'title', 'sort_order', 'status'],
    defaultSort: 'sort_order',
    deleteNote: "The page's items go with it; photographs stay in the media library.",
    listColumns: [
      { name: 'title', label: 'Title' },
      { name: 'slug', label: 'URL' },
      { name: 'status', label: 'Status' },
    ],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
    ],
  },
  collectionsQueries: {
    list: (...args) => collectionsList(...args),
    create: (...args) => collectionsCreate(...args),
    update: (...args) => collectionsUpdate(...args),
    remove: (...args) => collectionsRemove(...args),
    reorder: (...args) => collectionsReorder(...args),
  },
}));

vi.mock('../../lib/queries/adminCollectionItems', () => ({
  listCollectionItems: (...args) => listCollectionItems(...args),
  addCollectionPhoto: (...args) => addCollectionPhoto(...args),
  addCollectionVideo: (...args) => addCollectionVideo(...args),
  removeCollectionItem: (...args) => removeCollectionItem(...args),
  reorderCollectionItems: (...args) => reorderCollectionItems(...args),
}));

vi.mock('../../lib/queries/adminGalleryCategories', () => ({
  listGalleryCategories: (...args) => listGalleryCategories(...args),
  addGalleryCategory: (...args) => addGalleryCategory(...args),
  renameGalleryCategory: (...args) => renameGalleryCategory(...args),
  reorderGalleryCategories: (...args) => reorderGalleryCategories(...args),
  removeGalleryCategory: (...args) => removeGalleryCategory(...args),
}));

vi.mock('../../lib/queries/adminBookingServices', () => ({
  listBookingServices: (...args) => listBookingServices(...args),
  addBookingService: (...args) => addBookingService(...args),
  renameBookingService: (...args) => renameBookingService(...args),
  reorderBookingServices: (...args) => reorderBookingServices(...args),
  removeBookingService: (...args) => removeBookingService(...args),
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
  // Tab clicks write location.hash (AdminDashboard keeps its tab there) —
  // reset it so no test inherits another test's tab.
  window.history.replaceState(null, '', window.location.pathname);
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
  galleryList.mockReset();
  galleryCreate.mockReset();
  galleryUpdate.mockReset();
  galleryRemove.mockReset();
  galleryReorder.mockReset();
  filmsList.mockReset();
  filmsCreate.mockReset();
  filmsUpdate.mockReset();
  filmsRemove.mockReset();
  filmsReorder.mockReset();
  testimonialsList.mockReset();
  testimonialsCreate.mockReset();
  testimonialsUpdate.mockReset();
  testimonialsRemove.mockReset();
  testimonialsReorder.mockReset();
  listBookingServices.mockReset();
  addBookingService.mockReset();
  renameBookingService.mockReset();
  reorderBookingServices.mockReset();
  removeBookingService.mockReset();
  listBookingServices.mockResolvedValue([
    { id: 'svc-1', name: 'Cinematic Film', sortOrder: 0 },
    { id: 'svc-2', name: 'Fine Art Photography', sortOrder: 1 },
    { id: 'svc-3', name: 'Drone Aerials', sortOrder: 2 },
    { id: 'svc-4', name: 'Pre-Wedding Shoot', sortOrder: 3 },
  ]);
  listGalleryCategories.mockReset();
  addGalleryCategory.mockReset();
  renameGalleryCategory.mockReset();
  reorderGalleryCategories.mockReset();
  removeGalleryCategory.mockReset();
  listGalleryCategories.mockResolvedValue([
    { id: 'cat-1', name: 'Pre-Wedding', sortOrder: 0 },
    { id: 'cat-2', name: 'Wedding', sortOrder: 1 },
    { id: 'cat-3', name: 'Engagement', sortOrder: 2 },
    { id: 'cat-4', name: 'Haldi & Mehendi', sortOrder: 3 },
  ]);
  collectionsList.mockReset();
  collectionsCreate.mockReset();
  collectionsUpdate.mockReset();
  collectionsRemove.mockReset();
  collectionsReorder.mockReset();
  listCollectionItems.mockReset();
  addCollectionPhoto.mockReset();
  addCollectionVideo.mockReset();
  removeCollectionItem.mockReset();
  reorderCollectionItems.mockReset();
  collectionsList.mockResolvedValue([]);
  listCollectionItems.mockResolvedValue([]);
  getOverviewCounts.mockReset();
  getSettingsRow.mockReset();
  updateSiteSettings.mockReset();
  getOverviewCounts.mockResolvedValue({
    newLeads: 0,
    weddings: { published: 0, draft: 0 },
    gallery: { published: 0, draft: 0 },
    films: { published: 0, draft: 0 },
    testimonials: { published: 0, draft: 0 },
    pages: { published: 0, draft: 0 },
  });
  getSettingsRow.mockResolvedValue({
    id: 1,
    quoteText: 'Q', quoteCredit: 'C', brandStoryHeading: 'H',
    brandStoryP1: 'P1', brandStoryP2: 'P2',
    heroMediaId: null, brandStoryMediaId: null, closingMediaId: null,
    studioAddress: 'A', studioEmail: 'e@x.test', studioPhone: '+91 1',
    whatsappNumber: '', instagramUrl: '', youtubeUrl: '',
  });
  listInquiries.mockResolvedValue([]);
  listMedia.mockResolvedValue([]);
  weddingsList.mockResolvedValue([]);
  listWeddingPhotos.mockResolvedValue([]);
  galleryList.mockResolvedValue([]);
  filmsList.mockResolvedValue([]);
  testimonialsList.mockResolvedValue([]);
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

  it('lands on the dashboard overview by default, leads only on request', async () => {
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

    // Dashboard is the landing tab; nothing fetches leads nobody asked for.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument());
    expect(getOverviewCounts).toHaveBeenCalled();
    expect(listInquiries).not.toHaveBeenCalled();

    // The header always offers the way back to the site itself.
    const viewSite = screen.getByRole('link', { name: /view website/i });
    expect(viewSite).toHaveAttribute('href', '/');
    expect(viewSite).toHaveAttribute('target', '_blank');

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const nav = screen.getByRole('navigation', { name: /admin sections/i });
    await user.click(within(nav).getByRole('button', { name: 'Leads' }));
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
      //
      // The flush is load-bearing. useResource defers its mount fetch through
      // a microtask, so a bare assertion straight after render() passes even
      // for a dashboard that IS wrongly mounted — the callback simply has not
      // had its turn yet. Verified in review by mounting this dashboard
      // unconditionally and watching this exact assertion keep passing.
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
      expect(listMedia).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /media library/i }));

      expect(screen.getByRole('heading', { name: /media library/i })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByAltText('A couple at dusk.')).toBeInTheDocument());
      expect(listMedia).toHaveBeenCalled();
      // The standalone library manages the collection; there is no form to
      // select into here, so no Select buttons may render (they were once a
      // no-op — dead controls on the screen).
      expect(screen.queryByRole('button', { name: /select/i })).toBeNull();
    });

    it('still lands on the dashboard first, unaffected by the media tab existing', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      signIn();
      render(<App />);

      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument());
      expect(screen.queryByRole('heading', { name: /media library/i })).not.toBeInTheDocument();

      const user = userEvent.setup();
      const nav = screen.getByRole('navigation', { name: /admin sections/i });
      await user.click(within(nav).getByRole('button', { name: 'Leads' }));
      expect(screen.getByText(/booking inquiries/i)).toBeInTheDocument();
      // Lets InquiriesDashboard's own listInquiries() call resolve — and the
      // state update that follows actually land — before the test ends, so
      // it isn't left dangling outside act().
      await waitFor(() => expect(screen.getByText(/no inquiries yet/i)).toBeInTheDocument());
    });

    it('Add to Gallery jumps straight into a pre-filled Add Gallery Photo form', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      listMedia.mockResolvedValue([{
        id: 'media-9',
        storagePath: '/images/gallery/wedding/9.jpg',
        width: 1600,
        height: 2400,
        altText: 'Bride among leaves',
        blurhash: null,
        createdAt: '2026-08-04T10:00:00Z',
      }]);
      galleryList.mockResolvedValue([]);
      signIn();
      render(<App />);
      const user = userEvent.setup();

      const nav = screen.getByRole('navigation', { name: /admin sections/i });
      await user.click(within(nav).getByRole('button', { name: /media library/i }));
      await waitFor(() => expect(screen.getByRole('button', { name: /add to gallery/i })).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: /add to gallery/i }));

      // Lands on the Gallery tab's create form with that photograph already
      // in the slot — thumbnail plus a Change control, no inline grid.
      expect(screen.getByRole('heading', { name: /add gallery photo/i })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByAltText('Bride among leaves')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /^change$/i })).toBeInTheDocument();
    });

    it('opens on the tab named in the URL hash after a refresh', async () => {
      window.history.replaceState(null, '', '#media');
      signIn();
      render(<App />);
      expect(await screen.findByRole('heading', { name: /media library/i })).toBeInTheDocument();
      await waitFor(() => expect(listMedia).toHaveBeenCalled());
    });

    it('falls back to Dashboard on an unrecognised hash', async () => {
      window.history.replaceState(null, '', '#not-a-tab');
      signIn();
      render(<App />);
      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument());
    });

    it('writes the hash on tab change and scrolls back to the top', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      const scrollSpy = vi.spyOn(window, 'scrollTo');
      signIn();
      render(<App />);
      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument());

      const user = userEvent.setup();
      scrollSpy.mockClear();
      const nav = screen.getByRole('navigation', { name: /admin sections/i });
      await user.click(within(nav).getByRole('button', { name: /media library/i }));

      expect(window.location.hash).toBe('#media');
      await waitFor(() => expect(scrollSpy).toHaveBeenCalledWith(0, 0));
      await waitFor(() => expect(listMedia).toHaveBeenCalled());
    });

    afterEach(() => {
      window.history.replaceState(null, '', window.location.pathname);
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
      //
      // See that test for why the flush matters: without it this assertion
      // passes even when the dashboard is mounted, and review confirmed an
      // always-mounted WeddingsDashboard was caught by nothing in the suite.
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
      expect(weddingsList).not.toHaveBeenCalled();

      const user = userEvent.setup();
      const nav = screen.getByRole('navigation', { name: /admin sections/i });
      await user.click(within(nav).getByRole('button', { name: /weddings/i }));

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

  // GalleryDashboard, FilmsDashboard, and TestimonialsDashboard (all defined
  // in App.jsx, Task 9) are each WeddingsDashboard's own list/form/create/
  // edit/publish/reorder/delete shape with no per-record child component —
  // no wedding_photos-style join table exists for any of the three. These
  // three describe blocks are the Weddings tab's own tests (immediately
  // above) applied to each, minus the two WeddingPhotos-specific cases that
  // do not apply here.
  describe('Gallery tab', () => {
    function signIn() {
      useSession.mockReturnValue({
        ...baseState,
        status: 'authenticated',
        session: { user: { id: 'user-2', email: 'admin@example.test' } },
        profile: { userId: 'user-2', role: 'admin', displayName: 'Studio Director' },
      });
    }

    const PHOTO_A = {
      id: 'gallery-1', title: 'Palace Steps', category: 'Wedding', sortOrder: 0, status: 'draft',
    };
    const PHOTO_B = {
      id: 'gallery-2', title: 'Garden Toast', category: 'Engagement', sortOrder: 1, status: 'published',
    };

    it('switches to the gallery tab and lists gallery photos via galleryQueries.list, not before', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      galleryList.mockResolvedValue([PHOTO_A]);
      signIn();
      render(<App />);

      // A macrotask tick, not just a microtask — enough for a *wrongly*
      // always-mounted GalleryDashboard's own useResource mount effect
      // (Promise.resolve().then(reload)) to have actually called
      // galleryList by now. Asserting immediately after render(), with no
      // flush at all, would still read zero calls even for a component
      // mounted this instant, purely because that effect's callback hasn't
      // had a turn on the microtask queue yet — a false pass this test
      // caught in review, verified by temporarily rendering
      // <GalleryDashboard /> unconditionally and watching this exact
      // assertion keep passing without it.
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
      expect(galleryList).not.toHaveBeenCalled();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^gallery$/i }));

      expect(screen.getByRole('heading', { level: 1, name: /^gallery$/i })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('Palace Steps')).toBeInTheDocument());
      expect(galleryList).toHaveBeenCalled();
    });

    it('creates a gallery photo through ResourceForm and calls galleryQueries.create with the entered values', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      galleryList.mockResolvedValueOnce([]);
      galleryCreate.mockResolvedValue({ id: 'gallery-9' });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^gallery$/i }));
      await waitFor(() => expect(screen.getByText(/no gallery yet/i)).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /add new/i }));
      expect(screen.getByRole('heading', { name: /add gallery photo/i })).toBeInTheDocument();

      await user.type(screen.getByLabelText(/^title/i), 'Palace Steps');
      // Options arrive from the managed categories list once it resolves.
      await waitFor(() => expect(screen.getByRole('option', { name: 'Wedding' })).toBeInTheDocument());
      await user.selectOptions(screen.getByLabelText(/^category/i), 'Wedding');

      galleryList.mockResolvedValueOnce([PHOTO_A]);
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => expect(galleryCreate).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Palace Steps', category: 'Wedding',
      })));
      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: /^gallery$/i })).toBeInTheDocument());

      // Every create lands as a draft (adminContent.js forces it) — the
      // banner is what makes that state loud, with publish right here.
      expect(screen.getByRole('status')).toHaveTextContent(/saved as draft — publish when ready/i);
      galleryUpdate.mockResolvedValue({ id: 'gallery-9', status: 'published' });
      galleryList.mockResolvedValueOnce([PHOTO_A]);
      await user.click(screen.getByRole('button', { name: /publish now/i }));
      await waitFor(() => expect(galleryUpdate).toHaveBeenCalledWith('gallery-9', { status: 'published' }));
      await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    });

    it('edits a gallery photo through ResourceForm, prefilling its values, and calls galleryQueries.update with its id', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      galleryList.mockResolvedValue([PHOTO_A]);
      galleryUpdate.mockResolvedValue({ ...PHOTO_A, category: 'Engagement' });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^gallery$/i }));
      await waitFor(() => expect(screen.getByText('Palace Steps')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /edit/i }));
      expect(screen.getByRole('heading', { name: /edit gallery photo/i })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByLabelText(/^category/i)).toHaveValue('Wedding'));

      await user.selectOptions(screen.getByLabelText(/^category/i), 'Engagement');

      galleryList.mockResolvedValueOnce([{ ...PHOTO_A, category: 'Engagement' }]);
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(galleryUpdate).toHaveBeenCalledWith('gallery-1', expect.objectContaining({ category: 'Engagement' })));
    });

    it('a failed edit keeps the form open and shows the failure — no optimistic return to the list', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      galleryList.mockResolvedValue([PHOTO_A]);
      galleryUpdate.mockRejectedValue(new Error('permission denied'));
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^gallery$/i }));
      await waitFor(() => expect(screen.getByText('Palace Steps')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /edit/i }));
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/permission denied/i));
      expect(screen.getByRole('heading', { name: /edit gallery photo/i })).toBeInTheDocument();
    });

    it('deletes a gallery photo after confirmation and calls galleryQueries.remove with its id', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      galleryList.mockResolvedValueOnce([PHOTO_A]);
      galleryRemove.mockResolvedValue({});
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^gallery$/i }));
      await waitFor(() => expect(screen.getByText('Palace Steps')).toBeInTheDocument());

      galleryList.mockResolvedValueOnce([]);
      // Scoped to the photo table — the Manage categories panel above the
      // list carries its own Delete buttons now.
      await user.click(within(screen.getByRole('table')).getByRole('button', { name: /delete/i }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(galleryRemove).toHaveBeenCalledWith('gallery-1');
      await waitFor(() => expect(screen.getByText(/no gallery yet/i)).toBeInTheDocument());
      confirmSpy.mockRestore();
    });

    it('a failed publish toggle leaves the old status on screen and surfaces the failure — no optimistic UI', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      galleryList.mockResolvedValue([PHOTO_A]);
      galleryUpdate.mockRejectedValue(new Error('permission denied'));
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^gallery$/i }));
      await waitFor(() => expect(screen.getByText('Palace Steps')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /draft/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not save that change: permission denied/i));
      expect(galleryUpdate).toHaveBeenCalledWith('gallery-1', { status: 'published' });
      expect(screen.getByRole('button', { name: /draft/i })).toBeInTheDocument();
    });

    it('reorders gallery photos and calls galleryQueries.reorder with the new id order', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      galleryList.mockResolvedValue([PHOTO_A, PHOTO_B]);
      galleryReorder.mockResolvedValue({ ok: true });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^gallery$/i }));
      await waitFor(() => expect(screen.getByText('Palace Steps')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /move down: palace steps/i }));

      expect(galleryReorder).toHaveBeenCalledWith(['gallery-2', 'gallery-1']);
    });

    it('shows a distinct load-error state with retry, different from the empty state', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      galleryList.mockRejectedValueOnce(new Error('network down'));
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^gallery$/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not load gallery: network down/i));
      expect(screen.queryByText(/no gallery yet/i)).not.toBeInTheDocument();

      galleryList.mockResolvedValueOnce([]);
      await user.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => expect(screen.getByText(/no gallery yet/i)).toBeInTheDocument());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Films tab', () => {
    function signIn() {
      useSession.mockReturnValue({
        ...baseState,
        status: 'authenticated',
        session: { user: { id: 'user-2', email: 'admin@example.test' } },
        profile: { userId: 'user-2', role: 'admin', displayName: 'Studio Director' },
      });
    }

    const FILM_A = {
      id: 'film-1', title: 'The Palace Symphony', couple: 'Aisha & Dev', sortOrder: 0, status: 'draft',
    };
    const FILM_B = {
      id: 'film-2', title: 'Garden Vows', couple: 'Priya & Arjun', sortOrder: 1, status: 'published',
    };

    it('switches to the films tab and lists films via filmsQueries.list, not before', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      filmsList.mockResolvedValue([FILM_A]);
      signIn();
      render(<App />);

      // See the identical flush in the Gallery tab's own version of this
      // test for why a bare assertion right after render() is not enough.
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
      expect(filmsList).not.toHaveBeenCalled();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^films$/i }));

      expect(screen.getByRole('heading', { level: 1, name: /^films$/i })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('The Palace Symphony')).toBeInTheDocument());
      expect(filmsList).toHaveBeenCalled();
    });

    it('creates a film through ResourceForm and calls filmsQueries.create with the entered values', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      filmsList.mockResolvedValueOnce([]);
      filmsCreate.mockResolvedValue({ id: 'film-9' });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^films$/i }));
      await waitFor(() => expect(screen.getByText(/no films yet/i)).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /add new/i }));
      expect(screen.getByRole('heading', { name: /add film/i })).toBeInTheDocument();

      await user.type(screen.getByLabelText(/^title/i), 'The Palace Symphony');
      await user.type(screen.getByLabelText(/^couple/i), 'Aisha & Dev');

      filmsList.mockResolvedValueOnce([FILM_A]);
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => expect(filmsCreate).toHaveBeenCalledWith(expect.objectContaining({
        title: 'The Palace Symphony', couple: 'Aisha & Dev',
      })));
      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: /^films$/i })).toBeInTheDocument());
    });

    it('edits a film through ResourceForm, prefilling its values, and calls filmsQueries.update with its id', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      filmsList.mockResolvedValue([FILM_A]);
      filmsUpdate.mockResolvedValue({ ...FILM_A, couple: 'Someone Else' });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^films$/i }));
      await waitFor(() => expect(screen.getByText('The Palace Symphony')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /edit/i }));
      expect(screen.getByRole('heading', { name: /edit film/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^couple/i)).toHaveValue('Aisha & Dev');

      await user.clear(screen.getByLabelText(/^couple/i));
      await user.type(screen.getByLabelText(/^couple/i), 'Someone Else');

      filmsList.mockResolvedValueOnce([{ ...FILM_A, couple: 'Someone Else' }]);
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(filmsUpdate).toHaveBeenCalledWith('film-1', expect.objectContaining({ couple: 'Someone Else' })));
    });

    it('a failed edit keeps the form open and shows the failure — no optimistic return to the list', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      filmsList.mockResolvedValue([FILM_A]);
      filmsUpdate.mockRejectedValue(new Error('permission denied'));
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^films$/i }));
      await waitFor(() => expect(screen.getByText('The Palace Symphony')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /edit/i }));
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/permission denied/i));
      expect(screen.getByRole('heading', { name: /edit film/i })).toBeInTheDocument();
    });

    it('deletes a film after confirmation and calls filmsQueries.remove with its id', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      filmsList.mockResolvedValueOnce([FILM_A]);
      filmsRemove.mockResolvedValue({});
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^films$/i }));
      await waitFor(() => expect(screen.getByText('The Palace Symphony')).toBeInTheDocument());

      filmsList.mockResolvedValueOnce([]);
      await user.click(screen.getByRole('button', { name: /delete/i }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(filmsRemove).toHaveBeenCalledWith('film-1');
      await waitFor(() => expect(screen.getByText(/no films yet/i)).toBeInTheDocument());
      confirmSpy.mockRestore();
    });

    it('a failed publish toggle leaves the old status on screen and surfaces the failure — no optimistic UI', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      filmsList.mockResolvedValue([FILM_A]);
      filmsUpdate.mockRejectedValue(new Error('permission denied'));
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^films$/i }));
      await waitFor(() => expect(screen.getByText('The Palace Symphony')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /draft/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not save that change: permission denied/i));
      expect(filmsUpdate).toHaveBeenCalledWith('film-1', { status: 'published' });
      expect(screen.getByRole('button', { name: /draft/i })).toBeInTheDocument();
    });

    it('reorders films and calls filmsQueries.reorder with the new id order', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      filmsList.mockResolvedValue([FILM_A, FILM_B]);
      filmsReorder.mockResolvedValue({ ok: true });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^films$/i }));
      await waitFor(() => expect(screen.getByText('The Palace Symphony')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /move down: the palace symphony/i }));

      expect(filmsReorder).toHaveBeenCalledWith(['film-2', 'film-1']);
    });

    it('shows a distinct load-error state with retry, different from the empty state', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      filmsList.mockRejectedValueOnce(new Error('network down'));
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^films$/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not load films: network down/i));
      expect(screen.queryByText(/no films yet/i)).not.toBeInTheDocument();

      filmsList.mockResolvedValueOnce([]);
      await user.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => expect(screen.getByText(/no films yet/i)).toBeInTheDocument());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Testimonials tab', () => {
    function signIn() {
      useSession.mockReturnValue({
        ...baseState,
        status: 'authenticated',
        session: { user: { id: 'user-2', email: 'admin@example.test' } },
        profile: { userId: 'user-2', role: 'admin', displayName: 'Studio Director' },
      });
    }

    const TESTIMONIAL_A = {
      id: 'testimonial-1', quote: 'Best day of our lives.', couple: 'Aisha & Dev', sortOrder: 0, status: 'draft',
    };
    const TESTIMONIAL_B = {
      id: 'testimonial-2', quote: 'Absolutely stunning work.', couple: 'Priya & Arjun', sortOrder: 1, status: 'published',
    };

    it('switches to the testimonials tab and lists testimonials via testimonialsQueries.list, not before', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      testimonialsList.mockResolvedValue([TESTIMONIAL_A]);
      signIn();
      render(<App />);

      // See the identical flush in the Gallery tab's own version of this
      // test for why a bare assertion right after render() is not enough.
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
      expect(testimonialsList).not.toHaveBeenCalled();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^testimonials$/i }));

      expect(screen.getByRole('heading', { level: 1, name: /^testimonials$/i })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('Aisha & Dev')).toBeInTheDocument());
      expect(testimonialsList).toHaveBeenCalled();
    });

    it('creates a testimonial through ResourceForm and calls testimonialsQueries.create with the entered values', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      testimonialsList.mockResolvedValueOnce([]);
      testimonialsCreate.mockResolvedValue({ id: 'testimonial-9' });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^testimonials$/i }));
      await waitFor(() => expect(screen.getByText(/no testimonials yet/i)).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /add new/i }));
      expect(screen.getByRole('heading', { name: /add testimonial/i })).toBeInTheDocument();

      await user.type(screen.getByLabelText(/^quote/i), 'Best day of our lives.');
      await user.type(screen.getByLabelText(/^couple/i), 'Aisha & Dev');

      testimonialsList.mockResolvedValueOnce([TESTIMONIAL_A]);
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => expect(testimonialsCreate).toHaveBeenCalledWith(expect.objectContaining({
        quote: 'Best day of our lives.', couple: 'Aisha & Dev',
      })));
      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: /^testimonials$/i })).toBeInTheDocument());
    });

    it('edits a testimonial through ResourceForm, prefilling its values, and calls testimonialsQueries.update with its id', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      testimonialsList.mockResolvedValue([TESTIMONIAL_A]);
      testimonialsUpdate.mockResolvedValue({ ...TESTIMONIAL_A, quote: 'Edited quote.' });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^testimonials$/i }));
      await waitFor(() => expect(screen.getByText('Aisha & Dev')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /edit/i }));
      expect(screen.getByRole('heading', { name: /edit testimonial/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^quote/i)).toHaveValue('Best day of our lives.');

      await user.clear(screen.getByLabelText(/^quote/i));
      await user.type(screen.getByLabelText(/^quote/i), 'Edited quote.');

      testimonialsList.mockResolvedValueOnce([{ ...TESTIMONIAL_A, quote: 'Edited quote.' }]);
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(testimonialsUpdate).toHaveBeenCalledWith('testimonial-1', expect.objectContaining({ quote: 'Edited quote.' })));
    });

    it('a failed edit keeps the form open and shows the failure — no optimistic return to the list', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      testimonialsList.mockResolvedValue([TESTIMONIAL_A]);
      testimonialsUpdate.mockRejectedValue(new Error('permission denied'));
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^testimonials$/i }));
      await waitFor(() => expect(screen.getByText('Aisha & Dev')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /edit/i }));
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/permission denied/i));
      expect(screen.getByRole('heading', { name: /edit testimonial/i })).toBeInTheDocument();
    });

    it('deletes a testimonial after confirmation and calls testimonialsQueries.remove with its id', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      testimonialsList.mockResolvedValueOnce([TESTIMONIAL_A]);
      testimonialsRemove.mockResolvedValue({});
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^testimonials$/i }));
      await waitFor(() => expect(screen.getByText('Aisha & Dev')).toBeInTheDocument());

      testimonialsList.mockResolvedValueOnce([]);
      await user.click(screen.getByRole('button', { name: /delete/i }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(testimonialsRemove).toHaveBeenCalledWith('testimonial-1');
      await waitFor(() => expect(screen.getByText(/no testimonials yet/i)).toBeInTheDocument());
      confirmSpy.mockRestore();
    });

    it('a failed publish toggle leaves the old status on screen and surfaces the failure — no optimistic UI', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      testimonialsList.mockResolvedValue([TESTIMONIAL_A]);
      testimonialsUpdate.mockRejectedValue(new Error('permission denied'));
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^testimonials$/i }));
      await waitFor(() => expect(screen.getByText('Aisha & Dev')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /draft/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not save that change: permission denied/i));
      expect(testimonialsUpdate).toHaveBeenCalledWith('testimonial-1', { status: 'published' });
      expect(screen.getByRole('button', { name: /draft/i })).toBeInTheDocument();
    });

    it('reorders testimonials and calls testimonialsQueries.reorder with the new id order', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      testimonialsList.mockResolvedValue([TESTIMONIAL_A, TESTIMONIAL_B]);
      testimonialsReorder.mockResolvedValue({ ok: true });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^testimonials$/i }));
      await waitFor(() => expect(screen.getByText('Aisha & Dev')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /move down: aisha & dev/i }));

      expect(testimonialsReorder).toHaveBeenCalledWith(['testimonial-2', 'testimonial-1']);
    });

    it('shows a distinct load-error state with retry, different from the empty state', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      testimonialsList.mockRejectedValueOnce(new Error('network down'));
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^testimonials$/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not load testimonials: network down/i));
      expect(screen.queryByText(/no testimonials yet/i)).not.toBeInTheDocument();

      testimonialsList.mockResolvedValueOnce([]);
      await user.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => expect(screen.getByText(/no testimonials yet/i)).toBeInTheDocument());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Pages tab', () => {
    function signIn() {
      useSession.mockReturnValue({
        ...baseState,
        status: 'authenticated',
        session: { user: { id: 'user-2', email: 'admin@example.test' } },
        profile: { userId: 'user-2', role: 'admin', displayName: 'Studio Director' },
      });
    }

    it('switches to the pages tab and lists collections, not before', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      collectionsList.mockResolvedValue([{
        id: 'c-1', slug: 'travels', title: 'Travels', sortOrder: 0, status: 'draft',
      }]);
      signIn();
      render(<App />);
      const user = userEvent.setup();

      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
      expect(collectionsList).not.toHaveBeenCalled();

      const nav = screen.getByRole('navigation', { name: /admin sections/i });
      await user.click(within(nav).getByRole('button', { name: 'Pages' }));

      expect(screen.getByRole('heading', { level: 1, name: 'Pages' })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('Travels')).toBeInTheDocument());
      expect(collectionsList).toHaveBeenCalled();
    });

    it('creates a page through the form — the slug is derived, never typed', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      collectionsList.mockResolvedValue([]);
      collectionsCreate.mockResolvedValue({
        id: 'c-9', slug: 'travels', title: 'Travels', sortOrder: 0, status: 'draft',
      });
      signIn();
      render(<App />);
      const user = userEvent.setup();

      const nav = screen.getByRole('navigation', { name: /admin sections/i });
      await user.click(within(nav).getByRole('button', { name: 'Pages' }));
      await waitFor(() => expect(screen.getByText(/no pages yet/i)).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: /add new/i }));

      expect(screen.queryByLabelText(/slug|url/i)).toBeNull();
      await user.type(screen.getByLabelText(/^title/i), 'Travels');
      collectionsList.mockResolvedValue([{
        id: 'c-9', slug: 'travels', title: 'Travels', sortOrder: 0, status: 'draft',
      }]);
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(collectionsCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Travels' })));
      // Draft-first create announces itself with the publish-now banner.
      await waitFor(() => expect(screen.getByText(/saved as draft/i)).toBeInTheDocument());
    });

    it('editing an existing page also offers the items manager; creating does not', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      collectionsList.mockResolvedValue([{
        id: 'c-1', slug: 'travels', title: 'Travels', sortOrder: 0, status: 'draft',
      }]);
      signIn();
      render(<App />);
      const user = userEvent.setup();

      const nav = screen.getByRole('navigation', { name: /admin sections/i });
      await user.click(within(nav).getByRole('button', { name: 'Pages' }));
      await waitFor(() => expect(screen.getByText('Travels')).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: /edit/i }));

      expect(screen.getByRole('heading', { name: /edit page/i })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: /add photographs/i })).toBeInTheDocument());
      expect(listCollectionItems).toHaveBeenCalledWith('c-1');

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      await user.click(screen.getByRole('button', { name: /add new/i }));
      expect(screen.queryByRole('button', { name: /add photographs/i })).toBeNull();
    });
  });

  describe('Gallery categories manager', () => {
    function signIn() {
      useSession.mockReturnValue({
        ...baseState,
        status: 'authenticated',
        session: { user: { id: 'user-2', email: 'admin@example.test' } },
        profile: { userId: 'user-2', role: 'admin', displayName: 'Studio Director' },
      });
    }

    async function openGallery(user) {
      const nav = screen.getByRole('navigation', { name: /admin sections/i });
      await user.click(within(nav).getByRole('button', { name: 'Gallery' }));
      await waitFor(() => expect(screen.getByText('Manage categories')).toBeInTheDocument());
    }

    it('shows the manager with the managed list and adds a new category', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      galleryList.mockResolvedValue([]);
      addGalleryCategory.mockResolvedValue({ name: 'Travel Diaries', sortOrder: 4 });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await openGallery(user);

      // The managed-list row renders as a <span>; scope to it since the new
      // Bulk-add-to-Gallery select also lists the category as an <option>.
      expect(screen.getByText('Haldi & Mehendi', { selector: 'span' })).toBeInTheDocument();
      await user.type(screen.getByLabelText(/new category/i), 'Travel Diaries');
      await user.click(screen.getByRole('button', { name: /^add$/i }));
      await waitFor(() => expect(addGalleryCategory).toHaveBeenCalledWith('Travel Diaries'));
    });

    it("the photo form's Category select offers the managed list's names", async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      galleryList.mockResolvedValue([]);
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await openGallery(user);

      await user.click(screen.getByRole('button', { name: /add new/i }));
      expect(screen.getByRole('option', { name: 'Haldi & Mehendi' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Engagement' })).toBeInTheDocument();
    });

    it('renames through the atomic RPC path', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      galleryList.mockResolvedValue([]);
      renameGalleryCategory.mockResolvedValue({ name: 'Pre Wedding Shoots' });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await openGallery(user);

      await user.click(screen.getAllByRole('button', { name: /^rename$/i })[0]);
      const input = screen.getByDisplayValue('Pre-Wedding');
      await user.clear(input);
      await user.type(input, 'Pre Wedding Shoots');
      await user.click(screen.getByRole('button', { name: /^save$/i }));
      await waitFor(() => expect(renameGalleryCategory).toHaveBeenCalledWith('Pre-Wedding', 'Pre Wedding Shoots'));
    });

    it('surfaces the delete refusal with its photograph count', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      galleryList.mockResolvedValue([]);
      removeGalleryCategory.mockRejectedValue(new Error('Cannot delete "Wedding" — 24 photograph(s) still use it.'));
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await openGallery(user);

      await user.click(screen.getAllByRole('button', { name: /^delete$/i })[1]);
      await waitFor(() => expect(screen.getByText(/24 photograph\(s\) still use it/i)).toBeInTheDocument());
      confirmSpy.mockRestore();
    });

    it('bulk-adds uploaded photos as draft rows titled from the file name, then publishes all', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      galleryList.mockResolvedValue([]);
      let created = 0;
      galleryCreate.mockImplementation(async (payload) => {
        created += 1;
        return { id: `g-${created}`, ...payload, status: 'draft' };
      });
      galleryUpdate.mockResolvedValue({ status: 'published' });
      signIn();
      render(<App />);
      const user = userEvent.setup();
      await openGallery(user);

      expect(screen.getByText('Bulk add to Gallery')).toBeInTheDocument();
      // Exact match: ManagedList also renders a "New category" input.
      await user.selectOptions(screen.getByLabelText('Category'), 'Wedding');
      await user.upload(screen.getByLabelText(/choose images/i), [
        new File(['a'], 'haldi-1.jpg', { type: 'image/jpeg' }),
        new File(['b'], 'haldi-2.jpg', { type: 'image/jpeg' }),
      ]);

      await waitFor(() => expect(galleryCreate).toHaveBeenCalledTimes(2));
      expect(galleryCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
        title: 'haldi-1', category: 'Wedding', mediaId: expect.any(String), sortOrder: 0,
      }));
      expect(galleryCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: 'haldi-2', sortOrder: 1 }));

      await waitFor(() => expect(screen.getByText(/2 draft photos created in Wedding/i)).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: /publish all 2/i }));
      await waitFor(() => expect(galleryUpdate).toHaveBeenCalledWith('g-1', { status: 'published' }));
      expect(galleryUpdate).toHaveBeenCalledWith('g-2', { status: 'published' });
    });
  });

  describe('Booking services manager (Settings tab)', () => {
    function signIn() {
      useSession.mockReturnValue({
        ...baseState,
        status: 'authenticated',
        session: { user: { id: 'user-2', email: 'admin@example.test' } },
        profile: { userId: 'user-2', role: 'admin', displayName: 'Studio Director' },
      });
    }

    it('renders the services panel under the settings form and adds a new service', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      addBookingService.mockResolvedValue({ name: 'Album Design', sortOrder: 4 });
      signIn();
      render(<App />);
      const user = userEvent.setup();

      const nav = screen.getByRole('navigation', { name: /admin sections/i });
      await user.click(within(nav).getByRole('button', { name: 'Settings' }));
      await waitFor(() => expect(screen.getByText('Booking services')).toBeInTheDocument());
      expect(screen.getByText('Drone Aerials')).toBeInTheDocument();
      expect(screen.getByText(/past inquiries keep the services/i)).toBeInTheDocument();

      await user.type(screen.getByLabelText(/new service/i), 'Album Design');
      await user.click(screen.getByRole('button', { name: /^add$/i }));
      await waitFor(() => expect(addBookingService).toHaveBeenCalledWith('Album Design'));
    });

    it('renames a service by id', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      renameBookingService.mockResolvedValue({ id: 'svc-1', name: 'Cinema Film' });
      signIn();
      render(<App />);
      const user = userEvent.setup();

      const nav = screen.getByRole('navigation', { name: /admin sections/i });
      await user.click(within(nav).getByRole('button', { name: 'Settings' }));
      await waitFor(() => expect(screen.getByText('Booking services')).toBeInTheDocument());

      await user.click(screen.getAllByRole('button', { name: /^rename$/i })[0]);
      const input = screen.getByDisplayValue('Cinematic Film');
      await user.clear(input);
      await user.type(input, 'Cinema Film');
      await user.click(screen.getByRole('button', { name: /^save$/i }));
      await waitFor(() => expect(renameBookingService).toHaveBeenCalledWith('svc-1', 'Cinema Film'));
    });
  });
});
