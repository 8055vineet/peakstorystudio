// Pure HTML builders for the post-build prerender (Phase 5, SEO design §4).
// Everything here is a function of data already in memory: no DOM, no
// Vite, no Supabase, no filesystem — scripts/prerender.mjs fetches the
// content and writes the files; this module only decides what they say.
// It imports the same pure modules the client uses for tab titles, meta
// descriptions, share images and JSON-LD, so a prerendered head and the
// one React would set at runtime cannot drift.

import { createHash } from 'node:crypto';
import { SLUG_PATTERN, descriptionFor, cardImageFor } from '../../src/data/seo.js';
import { titleFor } from '../../src/lib/documentTitle.js';
import { absoluteUrl, localBusinessJsonLd, websiteJsonLd, pageJsonLd } from '../../src/lib/seo/jsonLd.js';
import { googleFontsHref, nonDefaultFamilies } from '../../src/lib/googleFonts.js';

const STUDIO = 'Peak Story Studio';
const TITLE_SUFFIX = ` | ${STUDIO}`;
// The exact <h1> src/pages/HomePage.jsx renders, so the crawler shell and
// the mounted page say the same thing.
const HOME_H1 = 'Peak Story Studio — Wedding Photography & Films, Lucknow';

const STORY_ROUTE = /^\/stories\/([^/]+)$/;
const MORE_ROUTE = /^\/more\/([^/]+)$/;

export const STATIC_ROUTES = ['/', '/gallery', '/films', '/stories', '/about', '/contact'];

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Attribute- and text-safe: the five characters HTML gives meaning to.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

const stripOrigin = (origin) => String(origin ?? '').replace(/\/+$/, '');

// The routes to prerender: the six sections plus a page per collection and
// per wedding whose slug is one Cloudflare Pages serves verbatim. Rows with
// any other slug are reported rather than written, so a bad row can never
// produce a file the host would silently canonicalise to a different URL.
export function routesFor(data = {}) {
  const routes = [...STATIC_ROUTES];
  const skipped = [];
  const add = (kind, rows, prefix) => {
    for (const row of rows ?? []) {
      const slug = row?.slug ?? '';
      // `index` would become <dir>/index.html, which Pages canonicalises to
      // a trailing slash — a different URL from the canonical the head carries.
      if (SLUG_PATTERN.test(slug) && slug !== 'index') routes.push(`${prefix}/${slug}`);
      else skipped.push({ kind, id: row?.id ?? null, slug });
    }
  };
  add('collection', data.collections, '/more');
  add('story', data.stories, '/stories');
  return { routes, skipped };
}

const toArray = (value) => (Array.isArray(value) ? value : [value]).filter(Boolean);
const dimension = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

// Everything the head and the shell need for one route.
export function metaFor(pathname, data = {}, origin = '') {
  const { stories = [], photos = [], films = [], collections = [], settings = {}, morePages } = data;
  const pages = morePages ?? collections.map(({ slug, title }) => ({ slug, title }));
  const base = stripOrigin(origin);
  const title = titleFor(pathname, pages, stories);
  const description = descriptionFor(pathname, { stories, collections });
  const canonical = pathname === '/' ? `${base}/` : `${base}${pathname}`;

  const storyMatch = pathname.match(STORY_ROUTE);
  const story = storyMatch ? stories.find((candidate) => candidate.slug === storyMatch[1]) : null;
  const ogType = storyMatch || MORE_ROUTE.test(pathname) ? 'article' : 'website';

  const imageUrl = absoluteUrl(cardImageFor(pathname, { stories, photos, films, collections, settings }), base);
  const image = imageUrl
    ? {
      url: imageUrl,
      width: dimension(story?.coverMeta?.width),
      height: dimension(story?.coverMeta?.height),
      alt: story?.coverMeta?.alt || title,
    }
    : null;

  const jsonLd = pathname === '/'
    ? [localBusinessJsonLd({ settings, siteUrl: base }), websiteJsonLd({ siteUrl: base })]
    : toArray(pageJsonLd(pathname, { stories, photos, films, collections, siteUrl: base }));

  const fontsHref = googleFontsHref(nonDefaultFamilies(settings?.fonts)) || null;

  return { pathname, title, description, canonical, ogType, image, jsonLd, fontsHref };
}

const meta = (attr, name, content) => `<meta ${attr}="${name}" content="${escapeHtml(content)}">`;
const property = (name, content) => meta('property', name, content);
const named = (name, content) => meta('name', name, content);

// The head fragment for one route, one tag per line, in a fixed order.
export function buildHead(m) {
  const { title, description, canonical, ogType, image, jsonLd = [], fontsHref } = m;
  const lines = [
    `<title>${escapeHtml(title)}</title>`,
    named('description', description),
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    property('og:site_name', STUDIO),
    property('og:locale', 'en_IN'),
    property('og:type', ogType),
    property('og:url', canonical),
    property('og:title', title),
    property('og:description', description),
  ];
  if (image) {
    lines.push(property('og:image', image.url), property('og:image:alt', image.alt));
    if (image.width != null && image.height != null) {
      lines.push(property('og:image:width', image.width), property('og:image:height', image.height));
    }
  }
  lines.push(named('twitter:card', 'summary_large_image'), named('twitter:title', title), named('twitter:description', description));
  if (image) lines.push(named('twitter:image', image.url));

  const ld = jsonLd.length === 1 ? jsonLd[0] : jsonLd;
  // '<' cannot appear in a <script> body without ending it; \u003c is the
  // same character to a JSON parser.
  lines.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);

  if (fontsHref) lines.push(`<link id="site-fonts" rel="stylesheet" href="${escapeHtml(fontsHref)}">`);
  return lines.join('\n');
}

const SHELL_CLASS = 'px-6 py-24 text-center bg-offwhite-100 text-pitch-900';
const H1_CLASS = 'font-garamond text-3xl tracking-[0.2em]';
const P_CLASS = 'max-w-2xl mx-auto mt-4 text-charcoal-700';

// What a crawler (or a visitor before the bundle runs) sees inside #root:
// the page's heading, a wedding's byline, and the description, on the
// site's own utilities. React replaces it on mount. Never hidden text.
export function buildShell(m, { byline = '' } = {}) {
  const title = String(m.title ?? '');
  const heading = m.pathname === '/'
    ? HOME_H1
    : (title.endsWith(TITLE_SUFFIX) ? title.slice(0, -TITLE_SUFFIX.length) : title);
  return `<div data-prerender-shell class="${SHELL_CLASS}">`
    + `<h1 class="${H1_CLASS}">${escapeHtml(heading)}</h1>`
    + (byline ? `<p class="${P_CLASS}">${escapeHtml(byline)}</p>` : '')
    + `<p class="${P_CLASS}">${escapeHtml(m.description)}</p>`
    + '</div>';
}

const BLOCK_START = '<!-- prerender:start -->';
const BLOCK_END = '<!-- prerender:end -->';
const PREVIOUS_BLOCK = /[ \t]*<!-- prerender:start -->[\s\S]*?<!-- prerender:end -->\n?/g;
const PREVIOUS_SHELL = /<div data-prerender-shell[^>]*>[\s\S]*?<\/div>/g;
const TITLE_TAG = /[ \t]*<title>[\s\S]*?<\/title>\n?/;
const DESCRIPTION_TAG = /[ \t]*<meta\s+name="description"[^>]*>\n?/;
const ROOT_DIV = /<div id="root">\s*<\/div>/;

// Puts one route's head and shell into Vite's built index.html. Strips any
// earlier prerender first, so running it again on its own output — or on
// dist/index.html, which the Home route rewrites in place — is a no-op.
export function injectHead(indexHtml, headFragment, shellHtml) {
  // The <title> is checked before stripping: on a second pass it lives
  // inside the block, and stripping the block removes it deliberately.
  if (!TITLE_TAG.test(String(indexHtml))) throw new Error('injectHead: index.html has no <title>');
  let html = String(indexHtml).replace(PREVIOUS_BLOCK, '').replace(PREVIOUS_SHELL, '');
  if (!html.includes('</head>')) throw new Error('injectHead: index.html has no </head>');
  if (!ROOT_DIV.test(html)) throw new Error('injectHead: index.html has no empty <div id="root">');

  html = html.replace(TITLE_TAG, '').replace(DESCRIPTION_TAG, '');

  const headClose = html.indexOf('</head>');
  const lineStart = html.lastIndexOf('\n', headClose) + 1;
  const indent = html.slice(lineStart, headClose).match(/^[ \t]*$/) ? html.slice(lineStart, headClose) : '';
  const block = `${BLOCK_START}\n${headFragment}\n${BLOCK_END}\n${indent}`;
  html = `${html.slice(0, headClose)}${block}${html.slice(headClose)}`;

  return html.replace(ROOT_DIV, () => `<div id="root">${shellHtml}</div>`);
}

const lastmodDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

// entries: [{ path, lastmod? }] -> the sitemap document.
export function sitemapXml(entries = [], origin = '') {
  const base = stripOrigin(origin);
  const urls = entries.map(({ path, lastmod }) => {
    const date = lastmodDate(lastmod);
    return `  <url><loc>${escapeHtml(`${base}${path}`)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`;
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map((url) => `${url}\n`).join('')
    + '</urlset>\n';
}

// Deep copy with object keys in sorted order, so JSON.stringify is a
// function of the values alone.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value === undefined ? null : value;
}

const sortedStrings = (rows, pick) => (rows ?? []).map((row) => String(pick(row) ?? '')).sort();

// The summary the fingerprint hashes: exactly the content whose change
// should make the admin's "site last published" read as stale.
function contentSummary(data = {}) {
  const settings = data.settings ?? {};
  return canonical({
    stories: (data.stories ?? [])
      .map((story) => ({ slug: String(story?.slug ?? ''), updatedAt: story?.updatedAt ?? null }))
      .sort((a, b) => a.slug.localeCompare(b.slug) || String(a.updatedAt).localeCompare(String(b.updatedAt))),
    collections: sortedStrings(data.collections, (row) => row?.slug),
    settings: {
      quote: settings.quote ?? null,
      brandStory: settings.brandStory ?? null,
      contact: settings.contact ?? null,
      fonts: settings.fonts ?? null,
      logo: settings.logo ?? null,
    },
    photos: sortedStrings(data.photos, (row) => row?.id),
    films: sortedStrings(data.films, (row) => row?.id),
  });
}

export function buildInfo({ builtAt, origin, degraded = false, routes = [], data = {} }) {
  const fingerprint = createHash('sha256').update(JSON.stringify(contentSummary(data))).digest('hex');
  return { builtAt, origin, degraded, routes, fingerprint };
}
