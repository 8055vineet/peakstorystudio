// The rebuild floor: decides whether one more Cloudflare Pages build should
// be dispatched given when the last one was.
//
// Pure — no Deno APIs, no clock of its own (the caller passes `now`) — so it
// is unit-tested under Vitest like the rest of _shared and the Edge Function
// that wraps it (request-rebuild) stays a thin shell of I/O.
//
// Rule (spec 2026-09-08-seo-design.md, section 6): a build that started
// before a content change could have read stale content, so a second
// dispatch inside the window is allowed — exactly once — and Cloudflare
// queues it. A third inside the same window is pointless (that queued build
// will see the change) and is skipped. Once the window has elapsed the
// follow-up allowance resets.

export const DEFAULT_WINDOW_MS = 90_000;

// Accepts a millisecond number, a Date, or a timestamp string (ISO 8601, or
// Postgres' own "YYYY-MM-DD HH:MM:SS+00" text form as supabase-js returns
// it). Returns NaN for anything unparseable so the caller can treat it as
// "no previous dispatch" rather than throwing.
function toMs(value) {
  if (value === null || value === undefined || value === '') {
    return NaN;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const text = String(value).trim();
  let parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    // Postgres separates date and time with a space and may write the
    // offset as "+00" (no minutes); Date.parse wants "T" and "+00:00".
    parsed = Date.parse(text.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
  }
  return parsed;
}

export function decideDispatch({
  now,
  lastDispatchAt,
  followupSent = false,
  windowMs = DEFAULT_WINDOW_MS,
  force = false,
}) {
  if (force) {
    return { dispatch: true, reason: 'forced', followupSent: false };
  }

  const nowMs = toMs(now);
  const lastMs = toMs(lastDispatchAt);

  // No previous dispatch (or one we cannot date): the window is open.
  if (Number.isNaN(lastMs) || nowMs - lastMs >= windowMs) {
    return { dispatch: true, reason: 'window_open', followupSent: false };
  }

  if (!followupSent) {
    return { dispatch: true, reason: 'followup', followupSent: true };
  }

  return { dispatch: false, reason: 'window_busy', followupSent: true };
}
