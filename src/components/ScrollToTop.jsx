import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// A route change starts the new page at the top; browsers only do this for
// full document loads, not client-side navigations.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
