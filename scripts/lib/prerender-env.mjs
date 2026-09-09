// Pure environment rules for scripts/prerender.mjs, kept out of the script
// so they can be unit-tested without a build or a database.

const DEFAULT_ORIGIN = 'http://localhost:4173'; // `vite preview`'s port

// The canonical origin every absolute URL in the prerendered output uses.
// VITE_SITE_URL is the production value (https://peakstorystudio.in);
// Cloudflare injects CF_PAGES_URL on every build, which keeps preview deploys
// self-consistent; local runs fall back to vite preview.
export function resolveOrigin(env) {
  const candidates = [
    ['VITE_SITE_URL', env.VITE_SITE_URL],
    ['CF_PAGES_URL', env.CF_PAGES_URL],
  ];
  for (const [source, value] of candidates) {
    if (!value) continue;
    if (!/^https?:\/\/[^/\s]+/i.test(value)) {
      throw new Error(`${source} must be an absolute http(s) origin, got "${value}"`);
    }
    return { origin: value.replace(/\/+$/, ''), source };
  }
  return { origin: DEFAULT_ORIGIN, source: 'default' };
}

// What to do when the database is unreachable or unconfigured. On Cloudflare
// a failed build leaves the previous deployment live, which is the safe
// outcome for a live site; everywhere else (CI's databaseless build job, a
// laptop without the local stack) the build degrades to static routes so the
// rest of the pipeline still runs.
export function failurePolicy(env) {
  if (env.CF_PAGES === '1') {
    if (env.PRERENDER_ALLOW_EMPTY === '1') return { mode: 'degrade', reason: 'PRERENDER_ALLOW_EMPTY=1' };
    return { mode: 'fail', reason: 'CF_PAGES=1' };
  }
  return { mode: 'degrade', reason: 'not a Cloudflare Pages build' };
}

// src/lib/supabase.js reads only the VITE_-prefixed names; the other scripts
// (and CI) hand credentials over as SUPABASE_URL / SUPABASE_ANON_KEY. Map
// them, without overriding an explicit VITE_ value, the way verify-admin.mjs
// does — before the query modules are imported.
export function mapDatabaseEnv(env) {
  if (!env.VITE_SUPABASE_URL && env.SUPABASE_URL) env.VITE_SUPABASE_URL = env.SUPABASE_URL;
  if (!env.VITE_SUPABASE_ANON_KEY && env.SUPABASE_ANON_KEY) env.VITE_SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
  return {
    configured: Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY),
    url: env.VITE_SUPABASE_URL,
  };
}
