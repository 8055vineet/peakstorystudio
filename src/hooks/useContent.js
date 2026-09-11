import { useEffect, useState } from 'react';
import {
  INITIAL_STORIES,
  INITIAL_PHOTOS,
  INITIAL_FILMS,
  TESTIMONIALS,
} from '../data/weddingData';
import { SITE_SETTINGS_FALLBACK } from '../data/siteSettingsFallback';
import { readSiteSettingsSnapshot } from '../lib/siteSettingsSnapshot';
import { GALLERY_CATEGORY_FALLBACK } from '../data/galleryCategories';
import { SERVICES } from '@shared/inquiry-validation.js';
import { getPublishedWeddings } from '../lib/queries/weddings';
import { getGalleryPhotos, getGalleryCategories } from '../lib/queries/gallery';
import { getFilms } from '../lib/queries/films';
import { getTestimonials } from '../lib/queries/testimonials';
import { getSiteSettings } from '../lib/queries/siteSettings';
import { getCollections } from '../lib/queries/collections';
import { getBookingServices } from '../lib/queries/bookingServices';

// The database is unconditionally authoritative as of Phase 3 (there is no
// longer a `VITE_DATA_SOURCE` switch to read from the static module
// instead — see src/data/weddingData.js).
//
// query has had a chance to resolve) and again from the `catch` below if the
// query fails outright. That is resilience, not a second data source — a
// stale site beats a blank one when the database is briefly unreachable.
// Phase 7's truthful-content pass must still clean src/data/weddingData.js
// (PS-002's fabricated press credentials and the testimonial attributed to a
// real married couple), because that module is exactly what a visitor sees
// during an outage, not dead code that can be ignored.
//
// Module-level so its identity is stable (see NO_COLLECTIONS below).
const NOTHING_YET = [];

// One implementation, four thin wrappers.
function useContent(staticData, query, loadingData = staticData) {
  const [remote, setRemote] = useState({ data: loadingData, loading: true, error: null });

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
  }, [query, staticData, loadingData]);

  return remote;
}

export const useWeddings = () => useContent(INITIAL_STORIES, getPublishedWeddings, NOTHING_YET);

export const useGalleryPhotos = () => useContent(INITIAL_PHOTOS, getGalleryPhotos, NOTHING_YET);

export const useFilms = () => useContent(INITIAL_FILMS, getFilms, NOTHING_YET);

export const useTestimonials = () => useContent(TESTIMONIALS, getTestimonials, NOTHING_YET);

// The site's singular content (Phase 3c): quote, Brand Story, Home images,
// contact, socials — one settings row, same stale-beats-blank fallback as
// the collections above. While the query is in flight it shows the
// build-time snapshot the prerendered head carries (see
// src/lib/siteSettingsSnapshot.js), read once so its identity is stable.
const SITE_SETTINGS_SNAPSHOT = readSiteSettingsSnapshot() ?? SITE_SETTINGS_FALLBACK;

export const useSiteSettings = () => useContent(SITE_SETTINGS_FALLBACK, getSiteSettings, SITE_SETTINGS_SNAPSHOT);

// Phase 3e: the admin-extensible lists. Fallbacks are module-level
// constants on purpose — useContent's effect re-runs when `staticData`
// changes identity, so a fresh [] per call would refetch forever. An empty
// collections fallback means the More menu simply hides during an outage.
const NO_COLLECTIONS = [];

export const useCollections = () => useContent(NO_COLLECTIONS, getCollections);

export const useGalleryCategories = () => useContent(GALLERY_CATEGORY_FALLBACK, getGalleryCategories);

export const useBookingServices = () => useContent(SERVICES, getBookingServices);
