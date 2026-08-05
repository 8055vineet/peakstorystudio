import { useEffect } from 'react';

// Every admin navigation starts the new screen at the top — without this,
// clicking Edit from halfway down a long list lands the admin mid-form.
// AdminDashboard passes its tab key; each resource dashboard passes its
// view mode. jsdom's missing scrollTo is already no-op'd in
// src/test/setup.js, so tests can spy on it.
export function useScrollToTop(dep) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [dep]);
}
