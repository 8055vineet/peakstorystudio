import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// A route change starts the new page at the top; browsers only do this for
// full document loads, not client-side navigations. Two refinements:
// - `behavior: 'instant'`: the document carries `scroll-behavior: smooth`
//   for in-page anchors, and a route change must not inherit it, or the new
//   page visibly scrolls up from wherever the old one was.
// - Back/forward (a POP, which is also what the very first render reports)
//   is left alone so the browser can restore the position the visitor left
//   that page at, the way it does on any site.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType === 'POP') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, navigationType]);
  return null;
}
