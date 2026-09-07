const STUDIO = 'Peak Story Studio';
// Mirrors index.html's <title>, which is what Home shows before React runs.
export const HOME_TITLE = 'PEAK STORY STUDIO | Fine Art Wedding Photography & Cinematic Films';
const SECTION_TITLES = {
  '/gallery': 'Gallery',
  '/films': 'Films',
  '/stories': 'Stories',
  '/about': 'About',
  '/contact': 'Contact',
};

// The browser-tab / search-result title for a public route: the section
// first, the studio last, so a visitor with several tabs open can tell them
// apart. A More page uses its collection's title; a wedding's own page
// (`/stories/<slug>`) uses the wedding's title, falling back to the Stories
// section title while the weddings list is still loading (the caller cannot
// tell "not loaded" from "no such wedding" here, and a direct link must never
// be labelled not-found while its data is in flight); anything else reads as
// not found. Pure, so the component that applies it stays a one-liner.
export function titleFor(pathname, morePages = [], stories = []) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/') return HOME_TITLE;
  if (SECTION_TITLES[path]) return `${SECTION_TITLES[path]} | ${STUDIO}`;
  const more = path.match(/^\/more\/([^/]+)$/);
  if (more) {
    const page = morePages.find((candidate) => candidate.slug === more[1]);
    if (page) return `${page.title} | ${STUDIO}`;
  }
  const story = path.match(/^\/stories\/([^/]+)$/);
  if (story) {
    const wedding = stories.find((candidate) => candidate.slug === story[1]);
    return `${wedding ? wedding.title : SECTION_TITLES['/stories']} | ${STUDIO}`;
  }
  return `Page not found | ${STUDIO}`;
}
