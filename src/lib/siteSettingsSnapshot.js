import { SITE_SETTINGS_FALLBACK } from '../data/siteSettingsFallback';

// The build (scripts/prerender.mjs) stamps the site_settings row into every
// route's <head> as <script type="application/json" id="site-settings">.
// useSiteSettings starts from it while the live query is in flight, so the
// first render already has the real hero, quote, contact and logo: Home
// paints at once and the intro mounts on the first frame, instead of an
// empty <main> (footer directly under the header) that fills in all at once
// when the query returns. That wait is what Cloudflare's field data scored
// as a 0.85 footer layout shift and a P99 hero paint of 15.8s.
//
// The snapshot is only ever a head start — the query still runs and its
// answer replaces it, so an admin edit shows before the rebuild it also
// triggers has finished. Merged over the fallback so a key an older build
// did not write still has a value. Absent (dev server, a degraded build) or
// malformed, this is null and the hook starts from the shipped fallback.
export function readSiteSettingsSnapshot() {
  if (typeof document === 'undefined') return null;
  const tag = document.getElementById('site-settings');
  if (!tag) return null;
  try {
    const parsed = JSON.parse(tag.textContent);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return { ...SITE_SETTINGS_FALLBACK, ...parsed };
  } catch {
    return null;
  }
}
