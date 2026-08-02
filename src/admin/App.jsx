import { useState } from 'react';
import { useSession } from '../hooks/useSession';
import SignInForm from './SignInForm.jsx';

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
  children = <p className="text-sm text-charcoal-500">No admin screens are mounted yet.</p>,
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
