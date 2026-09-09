// Per-route SEO copy and share-card images (Phase 5). Pure data and pure
// functions over the shapes the data layer already produces (see
// docs/DATA-MODEL.md) — no DOM, no React, no Supabase, no Node — so the
// same module serves a component, the build-time SEO step that writes
// per-route HTML, and any future edge function.
//
// Content-integrity rule (CLAUDE.md): these descriptions state what the
// studio is and where it works. No awards, press, statistics, or client
// names — none of that is substantiated anywhere in the repo.

export const STATIC_SEO = {
  '/': {
    description: 'Peak Story Studio is a wedding photography and film studio in Lucknow, Uttar Pradesh: fine art photographs and cinematic films of weddings, here and beyond.',
  },
  '/gallery': {
    description: 'Wedding, pre-wedding, engagement, haldi and mehendi photographs by Peak Story Studio, a fine art wedding photography studio based in Gomtinagar, Lucknow.',
  },
  '/films': {
    description: 'Cinematic wedding films by Peak Story Studio, Lucknow: the ceremonies, the baraat, and the quiet moments between, edited into a film the couple keeps.',
  },
  '/stories': {
    description: 'Complete wedding stories photographed and filmed by Peak Story Studio in Lucknow, Uttar Pradesh: each couple, their venue, and the full album.',
  },
  '/about': {
    description: 'About Peak Story Studio, a wedding photography and cinematic film studio in Lucknow, Uttar Pradesh: how we work, and what we look for in a wedding.',
  },
  '/contact': {
    description: 'Book Peak Story Studio for your wedding photography and film in Lucknow or anywhere in Uttar Pradesh: check a date, ask a question, or visit us in Gomtinagar.',
  },
};

// The one rule for what a public slug may look like: lowercase ASCII
// letters, digits and hyphens, at most 120 characters. The admin's slugify
// (src/admin/resources/weddings.js, collections.js) only ever produces
// this shape; the prerender uses it to decide which rows get a page, so it
// never writes a filename Cloudflare Pages would canonicalise differently.
export const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

// "Couple · Location · Date" with whichever parts the wedding has, '' when
// it has none — the byline under a wedding's title, on its page and in the
// prerendered shell alike.
export function storyByline(story) {
  return [story?.couple, story?.location, story?.date].filter(Boolean).join(' · ');
}

// '/gallery/' -> '/gallery'; '/' stays '/'.
function normalize(pathname) {
  const path = String(pathname ?? '');
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

const STORY_ROUTE = /^\/stories\/([^/]+)$/;
const MORE_ROUTE = /^\/more\/([^/]+)$/;

const findStory = (stories, slug) => (stories ?? []).find((story) => story.slug === slug);
const findCollection = (collections, slug) => (collections ?? []).find((collection) => collection.slug === slug);

// "Summary. Couple; Location, Date." with whichever parts the wedding has.
function storyDescription(story) {
  const where = [story.location, story.date].filter(Boolean).join(', ');
  const who = [story.couple, where].filter(Boolean).join('; ');
  return [story.summary, who ? `${who}.` : ''].filter(Boolean).join(' ').trim();
}

// The meta description for a public route: a wedding's own summary on its
// page, a collection's description on its More page, the static copy for
// the six sections, '' for anything else.
export function descriptionFor(pathname, { stories = [], collections = [] } = {}) {
  const path = normalize(pathname);
  if (STATIC_SEO[path]) return STATIC_SEO[path].description;

  const story = path.match(STORY_ROUTE);
  if (story) {
    const wedding = findStory(stories, story[1]);
    return (wedding && storyDescription(wedding)) || STATIC_SEO['/stories'].description;
  }

  const more = path.match(MORE_ROUTE);
  if (more) return findCollection(collections, more[1])?.description ?? '';

  return '';
}

// The image a share card (Open Graph / Twitter) shows for a route, '' when
// nothing is available — callers omit the tag rather than point at nothing.
export function cardImageFor(pathname, { stories = [], photos = [], films = [], collections = [], settings } = {}) {
  const path = normalize(pathname);
  const images = settings?.images ?? {};

  switch (path) {
    case '/':
    case '/contact':
      return images.hero?.src ?? '';
    case '/about':
      return images.brandStory?.src ?? '';
    case '/gallery':
      return photos.find((photo) => photo.url)?.url ?? '';
    case '/films':
      return films.find((film) => film.thumbnail)?.thumbnail ?? '';
    case '/stories':
      return stories.find((story) => story.coverImage)?.coverImage ?? '';
    default:
      break;
  }

  const story = path.match(STORY_ROUTE);
  if (story) return findStory(stories, story[1])?.coverImage ?? '';

  const more = path.match(MORE_ROUTE);
  if (more) {
    const items = findCollection(collections, more[1])?.items ?? [];
    return items.find((item) => item.url)?.url ?? '';
  }

  return '';
}
