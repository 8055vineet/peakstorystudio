import { supabase } from '../supabase';

// The admin's side of the freshness loop (docs/superpowers/specs/
// 2026-09-08-seo-design.md section 6): the public site is prerendered at
// build time, so a content change is only live once Cloudflare has rebuilt.
// Three reads/writes, all consumed by src/hooks/usePublishStatus.js:
//   getPublishStatus — the site_publish singleton (when content last
//     changed, when/how the request-rebuild function last fired);
//   requestRebuild   — asks the Edge Function to POST the deploy hook;
//   getBuildInfo     — what build is actually live, from the
//     build-info.json the prerender writes at the site root.

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function getPublishStatus() {
  const { data, error } = await supabase
    .from('site_publish')
    .select('content_changed_at, last_dispatch_at, last_dispatch_status, dispatch_count')
    .eq('id', 1)
    .single();

  if (error) throw new Error(`site_publish: read failed: ${error.message}`);
  return {
    contentChangedAt: toDate(data?.content_changed_at),
    lastDispatchAt: toDate(data?.last_dispatch_at),
    lastDispatchStatus: data?.last_dispatch_status ?? null,
    dispatchCount: data?.dispatch_count ?? 0,
  };
}

async function readErrorBody(error) {
  // Mirrors media.js's readErrorBody: supabase-js wraps a non-2xx as
  // FunctionsHttpError and hangs the original Response off .context; a
  // network failure (DNS, offline) carries no context at all.
  try {
    return await error?.context?.json?.();
  } catch {
    return null;
  }
}

// Resolves to the function's JSON body whatever it says — including the
// quiet `{ ok: false, error: 'NOT_CONFIGURED' }` a hook-less environment
// (every local stack) answers at 200, which is a state to display, not a
// failure to throw. Only a non-2xx (401/403/400/500) or a network failure
// throws, as an Error whose .code is the body's error code, the same
// contract MediaError gives the upload pipeline.
export async function requestRebuild({ force = false } = {}) {
  const { data, error } = await supabase.functions.invoke('request-rebuild', {
    body: { force },
  });

  if (error) {
    const body = await readErrorBody(error);
    const code = body?.error ?? 'NETWORK_ERROR';
    throw Object.assign(new Error(code), { code });
  }

  return data;
}

// Never throws: the dev server has no build-info.json (Vite answers the
// SPA's index.html, which is not JSON), a preview may 404, and the network
// may be down — every one of those is "the live build is unknown", which
// the hook and the Overview widget already render as a state of their own.
// `cache: 'no-store'` because the whole point is to learn whether the
// build that just finished has landed, and a cached copy would say no.
export async function getBuildInfo() {
  try {
    const response = await fetch(`${window.location.origin}/build-info.json`, { cache: 'no-store' });
    if (!response.ok) return null;
    const body = await response.json();
    const builtAt = toDate(body?.builtAt);
    if (!builtAt) return null;
    return { ...body, builtAt };
  } catch {
    return null;
  }
}
