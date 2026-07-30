# 0005. Client state in localStorage (current state, to be replaced)

## Status

Accepted

## Context

With no backend yet, `src/App.jsx` persists both content and session state to the browser's
`localStorage` under three keys: `peak_story_stories`, `peak_story_photos`, and
`peak_story_user` (see [DATA-MODEL.md](../DATA-MODEL.md) for the full shapes). Content edited
through the Content Manager is written back to `peak_story_stories`/`peak_story_photos` on every
change; the logged-in user object is written back to `peak_story_user` on every change to
`user`, and removed when the user logs out.

The session side of this was verified directly against the current code before writing this
record. `src/App.jsx` restores `user` verbatim from `localStorage` with no signature and no
server-side check:

```js
const [user, setUser] = useState(() => {
  try {
    const saved = localStorage.getItem('peak_story_user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
});
```

`src/components/Navbar.jsx` then grants the admin UI purely on `user.role === 'admin'`, at two
separate call sites (lines 74 and 157), with no independent check of how that role was obtained.
Nothing between these two facts verifies that the `role` came from a real login: `AuthModal.jsx`'s
admin login itself performs no real authentication either — `handleAdminLogin` only checks that a
password is at least 6 characters long, then unconditionally calls back with
`{ role: 'admin', name: 'Studio Director', email: adminEmail }` for whatever email was typed. The
practical result is that admin access requires no real credential at all today, and independently
of that, anyone with devtools open can call
`localStorage.setItem('peak_story_user', JSON.stringify({ role: 'admin' }))` and reload to grant
themselves the admin UI directly, bypassing the login form entirely.

## Decision

This ADR documents the `localStorage` approach as the state of the system before Phase 1, not as
an endorsed design. It exists so that a future reader — human or agent — has an accurate,
factual record of what the pre-backend code actually does and does not protect, rather than
inferring intent from the code alone.

## Consequences

Content and session state are per-browser: nothing written in one browser is visible in another,
and clearing site data or switching devices loses everything, including the admin session and any
edits made through the Content Manager. Uploaded images are converted to base64 and stored in
`localStorage`, which has a practical quota of roughly 5 MB per origin in most browsers — a small
number of real photos exhausts it (tracked as PS-004 in
[KNOWN-ISSUES.md](../KNOWN-ISSUES.md)). A malformed value previously blanked the entire app on
load, because the three `localStorage` reads called `JSON.parse` with no error handling; that was
fixed by wrapping each read in a `try`/`catch` in commit `8ef6d5e`, and is no longer an open issue,
but it illustrates how little validation this storage layer otherwise has.

Most seriously, the session is trivially forgeable: because `user` is restored from
`localStorage` with no signature or server verification, and the admin UI is gated purely on
`user.role === 'admin'`, writing that value by hand in devtools is sufficient to obtain the admin
view client-side. There is no real backend behind it yet, so no protected data or write path is
actually exposed by this today — but the pattern would be a genuine privilege-escalation
vulnerability the moment any real admin-only data or mutation is wired to a check that trusts this
`user` object.

This entire approach is superseded by [ADR 0002](0002-supabase-as-backend.md) from Phase 1
onward, which replaces it with Supabase Auth: real authentication, server-issued and
server-verified sessions, and an explicit `role` column enforced by Row Level Security in
Postgres rather than trusted from a client-supplied object.
