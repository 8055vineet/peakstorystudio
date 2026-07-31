import { useEffect, useState } from 'react';
import {
  INITIAL_STORIES,
  INITIAL_PHOTOS,
  INITIAL_FILMS,
  TESTIMONIALS,
} from '../data/weddingData';
import { DATA_SOURCE } from '../lib/dataSource';
import { getPublishedWeddings } from '../lib/queries/weddings';
import { getGalleryPhotos } from '../lib/queries/gallery';
import { getFilms } from '../lib/queries/films';
import { getTestimonials } from '../lib/queries/testimonials';

// One implementation, four thin wrappers. `source` is injectable so tests can
// exercise both paths without touching import.meta.env.
function useContent(staticData, query, source) {
  const isSupabase = source === 'supabase';
  // Start from the static content so every section renders real data on the
  // first paint, before the query resolves. Falling back to an empty array
  // here meant components briefly received nothing.
  const [remote, setRemote] = useState({ data: staticData, loading: true, error: null });

  useEffect(() => {
    if (!isSupabase) return undefined;

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
  }, [isSupabase, query, staticData]);

  // Static content is known synchronously - no effect, no loading state.
  if (!isSupabase) return { data: staticData, loading: false, error: null };

  return remote;
}

export const useWeddings = (source = DATA_SOURCE) =>
  useContent(INITIAL_STORIES, getPublishedWeddings, source);

export const useGalleryPhotos = (source = DATA_SOURCE) =>
  useContent(INITIAL_PHOTOS, getGalleryPhotos, source);

export const useFilms = (source = DATA_SOURCE) =>
  useContent(INITIAL_FILMS, getFilms, source);

export const useTestimonials = (source = DATA_SOURCE) =>
  useContent(TESTIMONIALS, getTestimonials, source);
