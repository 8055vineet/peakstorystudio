import { useState } from 'react';

// Keyed by the AuthError codes src/lib/auth.js throws (see useSession's
// signIn, which surfaces err?.code straight through as `error`). None of
// these blame the person for something that is not their fault — mirrors
// BookingForm's ERROR_COPY (src/components/BookingForm.jsx): NOT_CONFIGURED
// and NETWORK_ERROR are the studio's problem, not theirs, and say so.
const ERROR_COPY = {
  INVALID_CREDENTIALS: 'That email or password is not correct. Please try again.',
  NOT_CONFIGURED: 'Sign-in is not available right now. Please contact the studio directly.',
  NETWORK_ERROR: "We could not reach the studio's servers just now. Please check your connection and try again.",
};

function errorMessage(errorCode) {
  if (!errorCode) return null;
  return ERROR_COPY[errorCode] ?? 'Something went wrong. Please try again.';
}

const ERROR_ID = 'admin-signin-error';

// Presentational only — it owns the two field values because they never
// need to escape this component (per CLAUDE.md), and reports upward through
// onSignIn. Session and pending state live in the caller (src/admin/App.jsx),
// same division as the rest of this codebase.
export default function SignInForm({ onSignIn, pending, errorCode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const message = errorMessage(errorCode);
  const invalid = Boolean(message);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pending) return;
    onSignIn(email, password);
  };

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-center font-semibold text-lg text-pitch-900 mb-8">
        Studio Admin Sign In
      </h1>
      {/* noValidate: this form has no client-side validation rules of its
          own to enforce before submit — every outcome here comes back from
          Supabase, so there is nothing useful native constraint validation
          would add and, per BookingForm's precedent, it can only get in the
          way (e.g. blocking a submit the server would have accepted). */}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label
            htmlFor="admin-email"
            className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-semibold"
          >
            Email
          </label>
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={invalid}
            aria-describedby={invalid ? ERROR_ID : undefined}
            className="w-full px-4 py-3 rounded-lg bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
          />
        </div>

        <div>
          <label
            htmlFor="admin-password"
            className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-semibold"
          >
            Password
          </label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={invalid}
            aria-describedby={invalid ? ERROR_ID : undefined}
            className="w-full px-4 py-3 rounded-lg bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
          />
        </div>

        {message && (
          <p id={ERROR_ID} role="alert" className="text-xs font-semibold text-pitch-900">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="w-full py-3 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
