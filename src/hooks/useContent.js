import { useEffect, useState } from 'react';
import {
  INITIAL_STORIES,
  INITIAL_PHOTOS,
  INITIAL_FILMS,
  TESTIMONIALS,
} from '../data/weddingData';
import { SITE_SETTINGS_FALLBACK } from '../data/siteSettingsFallback';
import { getPublishedWeddings } from '../lib/queries/weddings';
import { getGalleryPhotos } from '../lib/queries/gallery';
import { getFilms } from '../lib/queries/films';
import { getTestimonials } from '../lib/queries/testimonials';
import { getSiteSettings } from '../lib/queries/siteSettings';

// The database is unconditionally authoritative as of Phase 3 (there is no
// longer a `VITE_DATA_SOURCE` switch to read from the static module
// instead — see src/data/weddingData.js).
//
// `staticData` is kept, but only as an error fallback, not as configuration:
// it is what this hook returns synchronously on the first render (before the
// query has had a chance to resolve) and again from the `catch` below if the
// query fails outright. That is resilience, not a second data source — a
// stale site beats a blank one when the database is briefly unreachable.
// Phase 7's truthful-content pass must still clean src/data/weddingData.js
// (PS-002's fabricated press credentials and the testimonial attributed to a
// real married couple), because that module is exactly what a visitor sees
// during an outage, not dead code that can be ignored.
//
// One implementation, four thin wrappers.
function useContent(staticData, query) {
  const [remote, setRemote] = useState({ data: staticData, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    query()
      .then((data) => {
        if (!cancelled) setRemote({ data, loading: false, error: null });
      })
      .catch((err) => {
        // Keep showing the static content rather than emptying every section
        // out from under the user; the error is still surfaced via `error`
        // for callers that want to report the failure.
        if (!cancelled) setRemote({ data: staticData, loading: false, error: err.message });
      });

    return () => { cancelled = true; };
  }, [query, staticData]);

  return remote;
}

export const useWeddings = () => useContent(INITIAL_STORIES, getPublishedWeddings);

export const useGalleryPhotos = () => useContent(INITIAL_PHOTOS, getGalleryPhotos);

export const useFilms = () => useContent(INITIAL_FILMS, getFilms);

export const useTestimonials = () => useContent(TESTIMONIALS, getTestimonials);

// The site's singular content (Phase 3c): quote, Brand Story, Home images,
// contact, socials — one settings row, same stale-beats-blank fallback as
// the collections above.
export const useSiteSettings = () => useContent(SITE_SETTINGS_FALLBACK, getSiteSettings);
