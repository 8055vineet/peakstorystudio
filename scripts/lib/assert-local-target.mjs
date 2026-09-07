// Refuses to let a destructive or mutating script run against anything but
// the local Supabase stack unless the operator says so explicitly.
//
// seed-db and load-real-content delete every content and media row;
// verify-inquiry wipes inquiry_rate_limits and posts a dozen inquiries;
// verify-admin creates an admin account and edits site_settings. Each reads
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from the shell — the same two
// variables docs/DEPLOYMENT.md has the operator export for the HOSTED
// project when seeding it. One `npm run db:seed` in that shell, out of
// habit, would empty the live site. This is the interlock.
//
// seed-admin.mjs deliberately does NOT use it: the deploy runbook runs that
// script against hosted on purpose, and it is non-destructive (it refuses to
// create a second admin by itself).
//
// The environment is a parameter so scripts/__tests__ can exercise the check
// without touching process.env.

export const ALLOW_REMOTE_DB_VAR = 'ALLOW_REMOTE_DB';

// Loopback only: 127.0.0.1 or localhost, http or https, followed by a port,
// a path, or nothing. Anything else — 0.0.0.0, a LAN address, a
// *.supabase.co project — counts as remote.
const LOCAL_URL = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i;

export function isLocalSupabaseUrl(url) {
  return typeof url === 'string' && LOCAL_URL.test(url.trim());
}

// Throws unless SUPABASE_URL points at the local stack or ALLOW_REMOTE_DB=yes
// is set. Exactly `yes` — not `1`, `true`, or an empty string — so the
// override has to be typed deliberately.
export function assertLocalTarget(env = process.env, { scriptName = 'this script' } = {}) {
  const url = env.SUPABASE_URL ?? '';
  if (isLocalSupabaseUrl(url)) return;
  if (env[ALLOW_REMOTE_DB_VAR] === 'yes') return;
  throw new Error(
    `${scriptName}: refusing to run against ${url.trim() || '(unset SUPABASE_URL)'} — ` +
    'that is not the local stack (http://127.0.0.1:... or http://localhost:...), and this ' +
    'script rewrites or deletes real rows. If the hosted project really is the target, ' +
    `re-run with ${ALLOW_REMOTE_DB_VAR}=yes.`,
  );
}

// Script-facing wrapper: the same check, but a one-line refusal on stderr and
// exit code 2 — the code these scripts already use for a bad environment —
// instead of a stack trace.
export function exitUnlessLocalTarget(scriptName, env = process.env) {
  try {
    assertLocalTarget(env, { scriptName });
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}
