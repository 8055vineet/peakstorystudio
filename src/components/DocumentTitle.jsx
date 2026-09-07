import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { titleFor } from '../lib/documentTitle';

// Names the browser tab (and the search-result title) per route — see
// titleFor in src/lib/documentTitle.js for the rules. Renders nothing. The
// sitemap, OG tags, and prerendering remain PS-008's work.
export default function DocumentTitle({ morePages = [], stories = [] }) {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = titleFor(pathname, morePages, stories);
  }, [pathname, morePages, stories]);
  return null;
}
