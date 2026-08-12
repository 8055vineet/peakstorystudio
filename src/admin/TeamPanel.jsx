import { useMemo, useState } from 'react';
import { useResource } from '../hooks/useResource';
import { listTeam, createAdmin, removeAdmin } from '../lib/queries/adminTeam';

// The owner's team console (Settings tab, owner-only — the caller renders
// this only when profile.isOwner, and manage-team refuses everyone else
// server-side regardless). List the admin accounts, add one, remove one.
// Same no-optimistic-UI contract as everything else: rows change only after
// the database — via the Edge Function — confirms.

const LABEL_CLASS = 'block text-[10px] uppercase tracking-widest text-charcoal-500 font-bold mb-1.5';
const INPUT_CLASS = 'w-full rounded-lg border border-pitch-900/20 bg-offwhite-50 px-3 py-2 text-sm text-pitch-900 focus:outline-none focus:border-pitch-900';
const BUTTON_CLASS = 'px-4 py-2 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed';

// TeamError codes → words a person can act on.
function teamFailureMessage(err) {
  switch (err?.code) {
    case 'EMAIL_EXISTS': return 'That email already has an account.';
    case 'PASSWORD_TOO_SHORT': return 'The password needs at least 10 characters.';
    case 'INVALID_EMAIL': return 'That email address does not look right.';
    case 'CANNOT_REMOVE_OWNER': return 'The owner account cannot be removed.';
    case 'FORBIDDEN': return 'Only the owner can manage the team.';
    default: return `Something went wrong: ${err?.code ?? err?.message ?? 'unknown error'}.`;
  }
}

export default function TeamPanel() {
  const queries = useMemo(() => ({ list: listTeam, add: createAdmin, remove: removeAdmin }), []);
  const {
    items, status, error, reload, mutate,
  } = useResource(queries);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [created, setCreated] = useState(null);

  async function runAction(name, ...args) {
    setPending(true);
    setActionError(null);
    try {
      const result = await mutate(name, ...args);
      return result;
    } catch (err) {
      setActionError(err);
      return null;
    } finally {
      setPending(false);
    }
  }

  async function handleAdd(event) {
    event.preventDefault();
    setCreated(null);
    const member = await runAction('add', { email: email.trim(), password });
    if (member) {
      setCreated(member.email);
      setEmail('');
      setPassword('');
    }
  }

  function handleRemove(member) {
    const name = member.email ?? 'this admin';
    if (!window.confirm(`Remove ${name}? They lose access to the studio dashboard immediately.`)) return;
    runAction('remove', member.userId);
  }

  return (
    <section className="border border-pitch-900/10 rounded-2xl bg-offwhite-50 p-6 space-y-5">
      <h2 className="font-cinzel text-lg font-bold text-pitch-900">Team</h2>
      <p className="text-xs text-charcoal-500">
        Who can sign in to this dashboard. Admins you add manage everything here except the
        team itself — only you can add or remove accounts.
      </p>

      {status === 'error' && (
        <div role="alert" className="p-4 rounded-lg border border-pitch-900/20">
          <p className="text-xs font-semibold text-pitch-900 mb-3">
            Could not load the team{error?.code ? ` (${error.code})` : ''}.
          </p>
          <button type="button" onClick={() => reload()} className={BUTTON_CLASS}>Retry</button>
        </div>
      )}

      {status === 'loading' && items.length === 0 && (
        <p className="text-sm text-charcoal-700">Loading the team…</p>
      )}

      {status === 'ready' && (
        <ul aria-label="Studio admins" className="divide-y divide-pitch-900/10 border border-pitch-900/10 rounded-xl">
          {items.map((member) => (
            <li key={member.userId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-pitch-900 truncate">{member.email ?? member.userId}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-bold ${
                  member.isOwner
                    ? 'bg-pitch-900 text-offwhite-50'
                    : 'border border-pitch-900/20 text-pitch-900'
                }`}
                >
                  {member.isOwner ? 'Owner' : 'Admin'}
                </span>
                {!member.isOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemove(member)}
                    disabled={pending}
                    className={BUTTON_CLASS}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {actionError && (
        <p role="alert" className="text-xs font-semibold text-pitch-900">{teamFailureMessage(actionError)}</p>
      )}
      {created && (
        <p role="status" className="text-xs font-semibold text-pitch-900">
          {created} can now sign in to the dashboard. Share the password with them privately.
        </p>
      )}

      <form onSubmit={handleAdd} className="space-y-4 pt-2 border-t border-pitch-900/10">
        <p className="text-[10px] uppercase tracking-[0.25em] text-charcoal-500 font-bold pt-2">Add an admin</p>
        <div>
          <label htmlFor="team-new-email" className={LABEL_CLASS}>Email</label>
          <input
            id="team-new-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="team-new-password" className={LABEL_CLASS}>Password</label>
          <input
            id="team-new-password"
            type="text"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-xs text-charcoal-500">
            At least 10 characters — generate one in your password manager and hand it over privately.
          </p>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors disabled:opacity-60"
        >
          {pending ? 'Working…' : 'Add admin'}
        </button>
      </form>
    </section>
  );
}
