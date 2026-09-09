// "12 minutes ago" for the admin's publishing widget. Pure — `now` is a
// parameter so tests and a component's render can pin it — and
// deliberately coarse: this describes when a build landed, not a
// stopwatch, so the nearest minute/hour/day is the honest resolution.
// Beyond a week a relative count stops meaning anything and the calendar
// date takes over. No Intl.RelativeTimeFormat: its output varies by
// runtime ICU data, which is exactly what a test must not depend on.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(count, unit) {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

export function relativeTime(value, now = new Date()) {
  const date = value instanceof Date ? value : (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return null;

  const elapsed = (now instanceof Date ? now.getTime() : Number(now)) - date.getTime();
  if (elapsed < 45_000) return 'just now';
  if (elapsed < HOUR) return plural(Math.max(1, Math.round(elapsed / MINUTE)), 'minute');
  if (elapsed < DAY) return plural(Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < 7 * DAY) return plural(Math.floor(elapsed / DAY), 'day');
  return `on ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
}
