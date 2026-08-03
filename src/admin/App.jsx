import { useMemo, useState } from 'react';
import { useSession } from '../hooks/useSession';
import { useResource } from '../hooks/useResource';
import { listInquiries, updateInquiryStatus } from '../lib/queries/adminInquiries';
import { listMedia } from '../lib/queries/media';
import SignInForm from './SignInForm.jsx';
import LeadsTable from './LeadsTable.jsx';
import LeadDetail from './LeadDetail.jsx';
import UploadField from './UploadField.jsx';
import MediaPicker from './MediaPicker.jsx';
import ResourceList from './ResourceList.jsx';
import ResourceForm from './ResourceForm.jsx';
import WeddingPhotos from './WeddingPhotos.jsx';
import { weddingsResource, weddingsQueries } from './resources/weddings.js';
import { galleryResource, galleryQueries } from './resources/gallery.js';
import { filmsResource, filmsQueries } from './resources/films.js';
import { testimonialsResource, testimonialsQueries } from './resources/testimonials.js';

// Owns the leads dashboard's data (via useResource, the generic hook Tasks
// 7-9 will also use) and which inquiry is selected. Kept private to this
// file rather than its own component, the same way src/App.jsx composes the
// public site's sections directly rather than through an extra wrapper —
// this *is* the top-level stateful composition for the admin app.
function InquiriesDashboard() {
  // Memoized so useResource's internal effect (which reloads only when the
  // `list` function it was given changes) doesn't see a new object identity
  // on every render and refetch in a loop.
  const queries = useMemo(() => ({ list: listInquiries, update: updateInquiryStatus }), []);
  const {
    items, status, error, reload, mutate,
  } = useResource(queries);
  const [selectedId, setSelectedId] = useState(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3">
        <h1 className="font-cinzel text-2xl font-bold text-pitch-900 mb-6">Booking Inquiries</h1>
        <LeadsTable
          items={items}
          status={status}
          error={error}
          onRetry={reload}
          selectedId={selectedId}
          onSelectLead={setSelectedId}
        />
      </div>
      <div className="lg:col-span-2">
        <LeadDetail
          inquiry={selected}
          onUpdateStatus={(id, nextStatus) => mutate('update', id, nextStatus)}
        />
      </div>
    </div>
  );
}

// Owns the media library's data the same way InquiriesDashboard owns leads':
// a memoized queries object so useResource's mount effect (which fetches
// once, on mount — see useResource's own module comment) doesn't see a new
// object identity every render and refetch in a loop. MediaPicker and
// UploadField stay fully presentational either way: this is the composition
// that hands MediaPicker its items and hands UploadField the reload that
// makes an upload show up here without any optimistic update.
function MediaLibraryDashboard() {
  const queries = useMemo(() => ({ list: listMedia }), []);
  const {
    items, status, error, reload,
  } = useResource(queries);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-2">
        <h1 className="font-cinzel text-2xl font-bold text-pitch-900 mb-6">Media Library</h1>
        <UploadField onUploaded={reload} />
      </div>
      <div className="lg:col-span-3">
        {/* No selection consumer exists yet — Task 7's `media` field type
            and Task 8's WeddingPhotos are what will pass a real onSelect,
            per the plan's own task ordering. Until then this screen is
            where an admin manages the library directly: upload, and see
            what's missing alt text. */}
        <MediaPicker
          items={items}
          status={status}
          error={error}
          onRetry={reload}
          onSelect={() => {}}
        />
      </div>
    </div>
  );
}

// Owns the weddings resource's data the same way InquiriesDashboard and
// MediaLibraryDashboard own theirs — one useResource instance, per that
// hook's own "one instance per resource, always" rule (see its module
// comment). `weddingsQueries` is already a stable module-level object (see
// src/admin/resources/weddings.js), so no useMemo wrapper is needed here to
// keep it from changing identity across renders.
//
// `view` is this component's own local navigation state — 'list' (the
// ResourceList screen) or 'form' (create/edit, with WeddingPhotos attached
// once a wedding actually has an id to attach photos to). Kept local
// rather than lifted to AdminDashboard's `tab` state, the same way
// InquiriesDashboard keeps `selectedId` local: nothing outside this
// component's own tab needs to know which wedding is being edited.
function WeddingsDashboard() {
  const {
    items, status, error, reload, mutate,
  } = useResource(weddingsQueries);
  const [view, setView] = useState({ mode: 'list' });
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState(null);
  // Distinct from formError: a delete/publish-toggle/reorder click from
  // ResourceList calls its callback synchronously and does not itself
  // await or catch a rejection (see ResourceList.jsx's handleDelete/
  // handleMove — this file must not edit that component, so the catching
  // happens here instead, the same division of labour
  // src/admin/LeadDetail.jsx's own handleTransition already uses for
  // onUpdateStatus). `written` distinguishes a write that actually reached
  // the database from one that never did — see useResource.mutate's own
  // module comment.
  const [listActionError, setListActionError] = useState(null);

  async function runListAction(name, ...args) {
    setListActionError(null);
    try {
      await mutate(name, ...args);
    } catch (err) {
      setListActionError({ message: err?.message || 'unknown error', written: Boolean(err?.written) });
    }
  }

  async function handleSubmit(payload) {
    setFormPending(true);
    setFormError(null);
    try {
      if (view.item?.id) {
        await mutate('update', view.item.id, payload);
      } else {
        await mutate('create', payload);
      }
      setView({ mode: 'list' });
    } catch (err) {
      setFormError(err);
    } finally {
      setFormPending(false);
    }
  }

  if (view.mode === 'form') {
    return (
      <div className="space-y-8">
        <h1 className="font-cinzel text-2xl font-bold text-pitch-900">
          {view.item ? 'Edit Wedding' : 'Add Wedding'}
        </h1>
        {/* Keys are prefixed because these two are siblings under one
            parent: keying both on the bare wedding id made them duplicates,
            which React warns about. The warning was harmless in effect, but
            an admin console that cries wolf is one nobody reads the real
            warning in. */}
        <ResourceForm
          key={`wedding-form-${view.item?.id ?? 'new'}`}
          config={weddingsResource}
          initial={view.item}
          onSubmit={handleSubmit}
          onCancel={() => setView({ mode: 'list' })}
          pending={formPending}
          error={formError}
        />
        {/* Photos can only attach to a wedding row that already exists —
            a brand-new, unsaved wedding has no id for wedding_photos to
            reference. `key={view.item.id}` remounts WeddingPhotos (and
            its own useResource instance) if an admin somehow reaches this
            screen for a different wedding without it unmounting first —
            belt and braces, matching ResourceForm's own
            key={initial?.id ?? 'new'} guidance. */}
        {view.item?.id && (
          <WeddingPhotos key={`wedding-photos-${view.item.id}`} weddingId={view.item.id} />
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-cinzel text-2xl font-bold text-pitch-900 mb-6">Weddings</h1>
      {listActionError && (
        <p role="alert" className="mb-4 text-xs font-semibold text-pitch-900">
          {listActionError.written
            ? `That change saved, but this screen could not refresh to confirm it (${listActionError.message}). Reload to check.`
            : `Could not save that change: ${listActionError.message}. Please try again.`}
        </p>
      )}
      <ResourceList
        config={weddingsResource}
        items={items}
        status={status}
        error={error}
        onRetry={reload}
        onCreate={() => { setFormError(null); setView({ mode: 'form', item: null }); }}
        onEdit={(item) => { setFormError(null); setView({ mode: 'form', item }); }}
        onDelete={(id) => runListAction('remove', id)}
        onToggleStatus={(id, nextStatus) => runListAction('update', id, { status: nextStatus })}
        onReorder={(ids) => runListAction('reorder', ids)}
      />
    </div>
  );
}

// Task 9's three content types — gallery photos, films, testimonials — are
// each a standalone resource with no per-record child the way weddings has
// WeddingPhotos, so every one of these three is WeddingsDashboard's own
// list/form/create/edit/publish/reorder/delete shape with that one piece
// removed, not a new pattern. Kept as three separate functions (rather than
// one parameterized by resource+queries) for the same reason
// InquiriesDashboard, MediaLibraryDashboard, and WeddingsDashboard already
// aren't unified that way: this file has never reached for a shared
// abstraction across dashboards, and introducing one for exactly these three
// would be new code Task 9 was asked not to add, not configuration over the
// pattern Task 7 already built.
function GalleryDashboard() {
  const {
    items, status, error, reload, mutate,
  } = useResource(galleryQueries);
  const [view, setView] = useState({ mode: 'list' });
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState(null);
  const [listActionError, setListActionError] = useState(null);

  async function runListAction(name, ...args) {
    setListActionError(null);
    try {
      await mutate(name, ...args);
    } catch (err) {
      setListActionError({ message: err?.message || 'unknown error', written: Boolean(err?.written) });
    }
  }

  async function handleSubmit(payload) {
    setFormPending(true);
    setFormError(null);
    try {
      if (view.item?.id) {
        await mutate('update', view.item.id, payload);
      } else {
        await mutate('create', payload);
      }
      setView({ mode: 'list' });
    } catch (err) {
      setFormError(err);
    } finally {
      setFormPending(false);
    }
  }

  if (view.mode === 'form') {
    return (
      <div className="space-y-8">
        <h1 className="font-cinzel text-2xl font-bold text-pitch-900">
          {view.item ? 'Edit Gallery Photo' : 'Add Gallery Photo'}
        </h1>
        <ResourceForm
          key={`gallery-form-${view.item?.id ?? 'new'}`}
          config={galleryResource}
          initial={view.item}
          onSubmit={handleSubmit}
          onCancel={() => setView({ mode: 'list' })}
          pending={formPending}
          error={formError}
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-cinzel text-2xl font-bold text-pitch-900 mb-6">Gallery</h1>
      {listActionError && (
        <p role="alert" className="mb-4 text-xs font-semibold text-pitch-900">
          {listActionError.written
            ? `That change saved, but this screen could not refresh to confirm it (${listActionError.message}). Reload to check.`
            : `Could not save that change: ${listActionError.message}. Please try again.`}
        </p>
      )}
      <ResourceList
        config={galleryResource}
        items={items}
        status={status}
        error={error}
        onRetry={reload}
        onCreate={() => { setFormError(null); setView({ mode: 'form', item: null }); }}
        onEdit={(item) => { setFormError(null); setView({ mode: 'form', item }); }}
        onDelete={(id) => runListAction('remove', id)}
        onToggleStatus={(id, nextStatus) => runListAction('update', id, { status: nextStatus })}
        onReorder={(ids) => runListAction('reorder', ids)}
      />
    </div>
  );
}

// Same shape as GalleryDashboard immediately above — see its own comment for
// why this is not further unified into one generic component.
function FilmsDashboard() {
  const {
    items, status, error, reload, mutate,
  } = useResource(filmsQueries);
  const [view, setView] = useState({ mode: 'list' });
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState(null);
  const [listActionError, setListActionError] = useState(null);

  async function runListAction(name, ...args) {
    setListActionError(null);
    try {
      await mutate(name, ...args);
    } catch (err) {
      setListActionError({ message: err?.message || 'unknown error', written: Boolean(err?.written) });
    }
  }

  async function handleSubmit(payload) {
    setFormPending(true);
    setFormError(null);
    try {
      if (view.item?.id) {
        await mutate('update', view.item.id, payload);
      } else {
        await mutate('create', payload);
      }
      setView({ mode: 'list' });
    } catch (err) {
      setFormError(err);
    } finally {
      setFormPending(false);
    }
  }

  if (view.mode === 'form') {
    return (
      <div className="space-y-8">
        <h1 className="font-cinzel text-2xl font-bold text-pitch-900">
          {view.item ? 'Edit Film' : 'Add Film'}
        </h1>
        <ResourceForm
          key={`film-form-${view.item?.id ?? 'new'}`}
          config={filmsResource}
          initial={view.item}
          onSubmit={handleSubmit}
          onCancel={() => setView({ mode: 'list' })}
          pending={formPending}
          error={formError}
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-cinzel text-2xl font-bold text-pitch-900 mb-6">Films</h1>
      {listActionError && (
        <p role="alert" className="mb-4 text-xs font-semibold text-pitch-900">
          {listActionError.written
            ? `That change saved, but this screen could not refresh to confirm it (${listActionError.message}). Reload to check.`
            : `Could not save that change: ${listActionError.message}. Please try again.`}
        </p>
      )}
      <ResourceList
        config={filmsResource}
        items={items}
        status={status}
        error={error}
        onRetry={reload}
        onCreate={() => { setFormError(null); setView({ mode: 'form', item: null }); }}
        onEdit={(item) => { setFormError(null); setView({ mode: 'form', item }); }}
        onDelete={(id) => runListAction('remove', id)}
        onToggleStatus={(id, nextStatus) => runListAction('update', id, { status: nextStatus })}
        onReorder={(ids) => runListAction('reorder', ids)}
      />
    </div>
  );
}

// Same shape as GalleryDashboard and FilmsDashboard above — see
// GalleryDashboard's own comment for why this is not further unified into
// one generic component.
function TestimonialsDashboard() {
  const {
    items, status, error, reload, mutate,
  } = useResource(testimonialsQueries);
  const [view, setView] = useState({ mode: 'list' });
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState(null);
  const [listActionError, setListActionError] = useState(null);

  async function runListAction(name, ...args) {
    setListActionError(null);
    try {
      await mutate(name, ...args);
    } catch (err) {
      setListActionError({ message: err?.message || 'unknown error', written: Boolean(err?.written) });
    }
  }

  async function handleSubmit(payload) {
    setFormPending(true);
    setFormError(null);
    try {
      if (view.item?.id) {
        await mutate('update', view.item.id, payload);
      } else {
        await mutate('create', payload);
      }
      setView({ mode: 'list' });
    } catch (err) {
      setFormError(err);
    } finally {
      setFormPending(false);
    }
  }

  if (view.mode === 'form') {
    return (
      <div className="space-y-8">
        <h1 className="font-cinzel text-2xl font-bold text-pitch-900">
          {view.item ? 'Edit Testimonial' : 'Add Testimonial'}
        </h1>
        <ResourceForm
          key={`testimonial-form-${view.item?.id ?? 'new'}`}
          config={testimonialsResource}
          initial={view.item}
          onSubmit={handleSubmit}
          onCancel={() => setView({ mode: 'list' })}
          pending={formPending}
          error={formError}
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-cinzel text-2xl font-bold text-pitch-900 mb-6">Testimonials</h1>
      {listActionError && (
        <p role="alert" className="mb-4 text-xs font-semibold text-pitch-900">
          {listActionError.written
            ? `That change saved, but this screen could not refresh to confirm it (${listActionError.message}). Reload to check.`
            : `Could not save that change: ${listActionError.message}. Please try again.`}
        </p>
      )}
      <ResourceList
        config={testimonialsResource}
        items={items}
        status={status}
        error={error}
        onRetry={reload}
        onCreate={() => { setFormError(null); setView({ mode: 'form', item: null }); }}
        onEdit={(item) => { setFormError(null); setView({ mode: 'form', item }); }}
        onDelete={(id) => runListAction('remove', id)}
        onToggleStatus={(id, nextStatus) => runListAction('update', id, { status: nextStatus })}
        onReorder={(ids) => runListAction('reorder', ids)}
      />
    </div>
  );
}

// Short nav labels rather than each dashboard's own full heading — 'Leads'
// stays unambiguous from InquiriesDashboard's "Booking Inquiries" <h1> even
// though a screen reader announces both, and the same holds for Gallery,
// Films, and Testimonials below.
const DASHBOARD_TABS = [
  { key: 'leads', label: 'Leads' },
  { key: 'media', label: 'Media Library' },
  { key: 'weddings', label: 'Weddings' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'films', label: 'Films' },
  { key: 'testimonials', label: 'Testimonials' },
];

// The admin's default landing composition. Task 7's reusable resource
// pattern now backs five of these six tabs (every one but Leads and Media
// Library). A tab's dashboard only fetches once it's actually opened (see
// the "not fetched until asked for" test in App.test.jsx), so switching
// tabs, not mounting the shell, is what triggers each one's first load.
function AdminDashboard() {
  const [tab, setTab] = useState('leads');

  return (
    <div>
      <nav className="flex gap-2 mb-8" aria-label="Admin sections">
        {DASHBOARD_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-semibold transition-colors ${
              tab === key
                ? 'bg-pitch-900 text-offwhite-50'
                : 'border border-pitch-900/20 text-pitch-900 hover:bg-offwhite-200'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'leads' && <InquiriesDashboard />}
      {tab === 'media' && <MediaLibraryDashboard />}
      {tab === 'weddings' && <WeddingsDashboard />}
      {tab === 'gallery' && <GalleryDashboard />}
      {tab === 'films' && <FilmsDashboard />}
      {tab === 'testimonials' && <TestimonialsDashboard />}
    </div>
  );
}

// This component decides only what to RENDER for a given useSession()
// status. It is not the security boundary — Row Level Security (the
// `is_admin()` policies from Phase 1b) is what actually protects every
// table and every write, and Task 1 independently verified that a
// signed-in non-admin cannot read inquiries, write any content table, or
// promote themselves, regardless of what this component shows. Do not
// delete this gate on the theory that RLS makes it redundant — it is
// redundant by design, that's the point — and do not treat it as a
// substitute for RLS if that policy set is ever weakened. It grants
// nothing; it only decides what a signed-in browser is shown.
export default function App({
  children = <AdminDashboard />,
}) {
  const {
    status, session, profile, error, signIn, signOut,
  } = useSession();
  const [pending, setPending] = useState(false);

  // useSession's signIn only returns true on a genuine 'authenticated'
  // status (a client-role account that authenticates correctly still
  // resolves false, landing on 'forbidden' instead) — this wrapper adds
  // nothing to that contract, it only tracks the in-flight request so the
  // submit button can disable itself.
  const handleSignIn = async (email, password) => {
    setPending(true);
    try {
      await signIn(email, password);
    } finally {
      setPending(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-offwhite-100 text-pitch-900">
        <p className="text-sm text-charcoal-700">Checking your session…</p>
      </div>
    );
  }

  if (status === 'anonymous') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-offwhite-100 text-pitch-900 p-6">
        <SignInForm onSignIn={handleSignIn} pending={pending} errorCode={error} />
      </div>
    );
  }

  if (status === 'forbidden') {
    // profile can be null even on a real session — useSession resolves
    // 'forbidden' whether the row says a non-admin role or there is no
    // profiles row at all — so the email is the fallback, not an edge case.
    const account = profile?.displayName || session?.user?.email || 'This account';
    return (
      <div className="min-h-screen flex items-center justify-center bg-offwhite-100 text-pitch-900 p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-lg font-semibold">Admin access required</h1>
          {/* Telling someone already signed in to sign in is a dead end
              they cannot escape by doing what it asks — this is the
              refusal that replaces the sign-in form for that case. */}
          <p className="text-sm text-charcoal-700">
            <span className="font-semibold text-pitch-900">{account}</span> is signed in, but
            this account does not have admin access to Studio Admin.
          </p>
          <p className="text-sm text-charcoal-700">
            Sign out and sign back in with an admin account, or contact the studio if this looks
            wrong.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="px-6 py-3 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Gate on the value explicitly rather than letting this be the implicit
  // else. An unrecognised status must not fall through to the dashboard:
  // rendering admin screens because a value was not one of the three we
  // recognised is deciding access from ignorance. The status union is a
  // closed set of four today, so this is unreachable — which is exactly when
  // a fall-through survives review and outlives the assumption that made it
  // safe. RLS would still refuse the data underneath, but the admin should
  // not be showing a dashboard it cannot justify.
  if (status !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-offwhite-100 text-pitch-900 p-6">
        <p className="text-sm text-charcoal-700">
          Studio Admin could not determine your session. Please reload the page.
        </p>
      </div>
    );
  }

  const account = profile?.displayName || session?.user?.email || 'Studio Admin';
  return (
    <div className="min-h-screen bg-offwhite-100 text-pitch-900">
      <header className="flex items-center justify-between px-6 py-4 border-b border-pitch-900/10">
        <span className="text-sm font-semibold">{account}</span>
        <button
          type="button"
          onClick={signOut}
          className="px-4 py-2 rounded-lg border border-pitch-900/20 text-xs uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors"
        >
          Sign Out
        </button>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
