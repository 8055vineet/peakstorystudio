import { STUDIO_ADDRESS, STUDIO_EMAIL, STUDIO_PHONE } from '../../data/contact';
import { HOME_IMAGES } from '../../data/homeContent';
import { descriptionFor } from '../../data/seo';
import { youtubeEmbedUrl } from '../youtube';

// schema.org JSON-LD for the public site (Phase 5). Pure functions over the
// data-layer shapes (docs/DATA-MODEL.md) plus a `siteUrl` — with one, every
// URL is absolute; without one (local builds, tests) paths stay relative.
// No DOM, React, Supabase, or Node, so the build-time SEO step and any
// future edge function can import this module unchanged.

const CONTEXT = 'https://schema.org';
const STUDIO = 'Peak Story Studio';
const LOGO_FALLBACK = '/images/home/logo.webp';

// '/gallery' + 'https://peakstorystudio.in/' -> 'https://peakstorystudio.in/gallery'.
// An already-absolute URL (an R2 upload) passes through; '' stays '' so a
// missing image never becomes the site root.
export function absoluteUrl(path, siteUrl = '') {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(siteUrl ?? '').replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

// The site itself: the bare origin ('https://peakstorystudio.in', no
// trailing slash — what the canonical home URL is), or '/' locally.
function siteRoot(siteUrl = '') {
  return String(siteUrl ?? '').replace(/\/+$/, '') || '/';
}

function normalize(pathname) {
  const path = String(pathname ?? '');
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

// The settings row stores the address as one line ("2/231 Vastu Khand,
// Gomtinagar, Lucknow, UP"); the structured form is that line with the
// city and state peeled off the end, since the studio is in Lucknow.
function postalAddress(address) {
  const street = String(address || STUDIO_ADDRESS)
    .replace(/,\s*Lucknow\s*,\s*(UP|Uttar Pradesh)(\s*,\s*India)?\s*$/i, '')
    .trim();
  return {
    '@type': 'PostalAddress',
    streetAddress: street,
    addressLocality: 'Lucknow',
    addressRegion: 'Uttar Pradesh',
    addressCountry: 'IN',
  };
}

export function localBusinessJsonLd({ settings, siteUrl = '' } = {}) {
  const contact = settings?.contact ?? {};
  const sameAs = [contact.instagramUrl, contact.youtubeUrl].filter(Boolean);
  const ld = {
    '@context': CONTEXT,
    '@type': 'LocalBusiness',
    name: STUDIO,
    url: siteRoot(siteUrl),
    telephone: contact.phone || STUDIO_PHONE,
    email: contact.email || STUDIO_EMAIL,
    address: postalAddress(contact.address),
    areaServed: ['Lucknow', 'Uttar Pradesh'],
    logo: absoluteUrl(settings?.logo || LOGO_FALLBACK, siteUrl),
    image: absoluteUrl(settings?.images?.hero?.src || HOME_IMAGES.hero.src, siteUrl),
  };
  if (sameAs.length) ld.sameAs = sameAs;
  return ld;
}

export function websiteJsonLd({ siteUrl = '' } = {}) {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: STUDIO,
    url: siteRoot(siteUrl),
    inLanguage: 'en',
  };
}

const listItem = (position, fields) => ({ '@type': 'ListItem', position, ...fields });

// The per-page object for a public route, or null where there is none (the
// home page carries the LocalBusiness and WebSite objects instead; unknown
// routes and unknown slugs get nothing).
export function pageJsonLd(pathname, data = {}) {
  const { stories = [], photos = [], films = [], collections = [], siteUrl = '' } = data;
  const path = normalize(pathname);
  const url = (p) => absoluteUrl(p, siteUrl);
  const description = descriptionFor(path, data);

  switch (path) {
    case '/gallery':
      return {
        '@context': CONTEXT,
        '@type': 'ImageGallery',
        name: `Gallery | ${STUDIO}`,
        url: url('/gallery'),
        description,
        image: photos.map((photo) => url(photo.url)).filter(Boolean),
      };
    case '/films':
      return {
        '@context': CONTEXT,
        '@type': 'ItemList',
        name: `Films | ${STUDIO}`,
        url: url('/films'),
        description,
        itemListElement: films.map((film, index) => listItem(index + 1, {
          item: {
            '@type': 'VideoObject',
            name: film.title,
            thumbnailUrl: url(film.thumbnail),
            embedUrl: youtubeEmbedUrl(film.videoEmbedUrl),
          },
        })),
      };
    case '/stories':
      return {
        '@context': CONTEXT,
        '@type': 'ItemList',
        name: `Stories | ${STUDIO}`,
        url: url('/stories'),
        description,
        itemListElement: stories
          .filter((story) => story.slug)
          .map((story, index) => listItem(index + 1, { name: story.title, url: url(`/stories/${story.slug}`) })),
      };
    case '/about':
      return { '@context': CONTEXT, '@type': 'AboutPage', name: `About | ${STUDIO}`, url: url('/about'), description };
    case '/contact':
      return { '@context': CONTEXT, '@type': 'ContactPage', name: `Contact | ${STUDIO}`, url: url('/contact'), description };
    default:
      break;
  }

  const story = path.match(/^\/stories\/([^/]+)$/);
  if (story) {
    const wedding = stories.find((candidate) => candidate.slug === story[1]);
    if (!wedding) return null;
    const pageUrl = url(`/stories/${wedding.slug}`);
    const images = [wedding.coverImage, ...(wedding.fullGallery ?? [])].filter(Boolean);
    return [
      {
        '@context': CONTEXT,
        '@type': 'ImageGallery',
        name: wedding.title,
        url: pageUrl,
        description,
        image: [...new Set(images)].map((image) => url(image)),
      },
      {
        '@context': CONTEXT,
        '@type': 'BreadcrumbList',
        itemListElement: [
          listItem(1, { name: 'Home', item: url('/') }),
          listItem(2, { name: 'Stories', item: url('/stories') }),
          listItem(3, { name: wedding.title, item: pageUrl }),
        ],
      },
    ];
  }

  const more = path.match(/^\/more\/([^/]+)$/);
  if (more) {
    const collection = collections.find((candidate) => candidate.slug === more[1]);
    if (!collection) return null;
    const ld = {
      '@context': CONTEXT,
      '@type': 'CollectionPage',
      name: collection.title,
      url: url(`/more/${collection.slug}`),
      description: collection.description ?? '',
    };
    const image = (collection.items ?? []).find((item) => item.url)?.url;
    if (image) ld.image = url(image);
    return ld;
  }

  return null;
}
