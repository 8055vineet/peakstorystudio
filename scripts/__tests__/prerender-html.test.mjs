import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  STATIC_ROUTES,
  routesFor,
  metaFor,
  buildHead,
  buildShell,
  injectHead,
  sitemapXml,
  buildInfo,
  escapeHtml,
} from '../lib/prerender-html.mjs';
import { STATIC_SEO, descriptionFor, storyByline } from '../../src/data/seo.js';
import { HOME_TITLE, titleFor } from '../../src/lib/documentTitle.js';
import { SITE_SETTINGS_FALLBACK } from '../../src/data/siteSettingsFallback.js';

const ORIGIN = 'https://peakstorystudio.in';

const royal = {
  id: 'w-1', slug: 'a-royal-affair', title: 'A Royal Affair', couple: 'Sam & Alex',
  location: 'La Martiniere, Lucknow', date: 'November 2024',
  summary: 'Three days of ceremony under the winter sun.',
  coverImage: '/images/w/cover.jpg', fullGallery: ['/images/w/cover.jpg', '/images/w/two.jpg'], tags: [],
  updatedAt: '2026-08-01T10:00:00.000Z',
  coverMeta: { width: 1600, height: 1067, alt: 'Sam and Alex under the mandap' },
};
const bare = {
  id: 'w-2', slug: 'pragya', title: 'Pragya <3 & "Co"', couple: '', location: 'Lucknow', date: '',
  summary: '', coverImage: 'https://cdn.example/pragya.jpg', fullGallery: [], tags: [],
  updatedAt: '2026-08-02T10:00:00.000Z',
  coverMeta: { width: null, height: null, alt: null },
};
const badSlug = { ...royal, id: 'w-3', slug: 'Bad Slug', title: 'Bad' };
const stories = [royal, bare, badSlug];
const photos = [{ id: 'g-1', title: 'Baraat', url: '/images/g/first.jpg', category: 'Wedding' }];
const films = [{ id: 'f-1', title: 'A Film', thumbnail: '/images/f/thumb.jpg', videoEmbedUrl: 'https://youtu.be/dQw4w9WgXcQ' }];
const collections = [
  {
    id: 'c-1', slug: 'travels', title: 'Travels', description: 'On the road with couples.',
    items: [{ id: 'i-2', url: '/images/x/1.jpg', videoEmbedUrl: null, caption: null }],
  },
  { id: 'c-2', slug: '', title: 'No slug', description: '', items: [] },
];
const settings = SITE_SETTINGS_FALLBACK;
const morePages = collections.map(({ slug, title }) => ({ slug, title }));
const data = { stories, photos, films, collections, settings, morePages };

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>PEAK STORY STUDIO | Fine Art Wedding Photography & Cinematic Films</title>
    <meta name="description" content="Static copy." />
    <link rel="stylesheet" href="/assets/index-abc.css">
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script>window.__x = 1;</script>
  </body>
</html>
`;

describe('STATIC_ROUTES', () => {
  it('is the six public sections', () => {
    expect(STATIC_ROUTES).toEqual(['/', '/gallery', '/films', '/stories', '/about', '/contact']);
  });
});

describe('routesFor', () => {
  it('adds a /more and /stories route per row with a valid slug, and reports the rest', () => {
    const { routes, skipped } = routesFor(data);
    expect(routes).toEqual([...STATIC_ROUTES, '/more/travels', '/stories/a-royal-affair', '/stories/pragya']);
    expect(skipped).toEqual([
      { kind: 'collection', id: 'c-2', slug: '' },
      { kind: 'story', id: 'w-3', slug: 'Bad Slug' },
    ]);
  });

  it('copes with missing lists', () => {
    expect(routesFor({})).toEqual({ routes: STATIC_ROUTES, skipped: [] });
  });
});

describe('metaFor', () => {
  it('Home: title, description, canonical, website type, both site-level JSON-LD objects', () => {
    const meta = metaFor('/', data, ORIGIN);
    expect(meta).toMatchObject({
      pathname: '/',
      title: HOME_TITLE,
      description: STATIC_SEO['/'].description,
      canonical: `${ORIGIN}/`,
      ogType: 'website',
      fontsHref: null,
    });
    expect(meta.image).toEqual({ url: `${ORIGIN}${settings.images.hero.src}`, width: null, height: null, alt: HOME_TITLE });
    expect(meta.jsonLd.map((ld) => ld['@type'])).toEqual(['LocalBusiness', 'WebSite']);
    expect(meta.jsonLd[0].url).toBe(ORIGIN);
  });

  it('a section: canonical has no trailing slash and the page object is the one JSON-LD entry', () => {
    const meta = metaFor('/gallery', data, `${ORIGIN}/`);
    expect(meta.title).toBe(titleFor('/gallery'));
    expect(meta.canonical).toBe(`${ORIGIN}/gallery`);
    expect(meta.ogType).toBe('website');
    expect(meta.jsonLd).toHaveLength(1);
    expect(meta.jsonLd[0]['@type']).toBe('ImageGallery');
    expect(meta.image.url).toBe(`${ORIGIN}/images/g/first.jpg`);
  });

  it('a wedding: article type, cover dimensions and alt from coverMeta, both page objects', () => {
    const meta = metaFor('/stories/a-royal-affair', data, ORIGIN);
    expect(meta.title).toBe('A Royal Affair | Peak Story Studio');
    expect(meta.description).toBe(descriptionFor('/stories/a-royal-affair', data));
    expect(meta.canonical).toBe(`${ORIGIN}/stories/a-royal-affair`);
    expect(meta.ogType).toBe('article');
    expect(meta.image).toEqual({
      url: `${ORIGIN}/images/w/cover.jpg`, width: 1600, height: 1067, alt: 'Sam and Alex under the mandap',
    });
    expect(meta.jsonLd.map((ld) => ld['@type'])).toEqual(['ImageGallery', 'BreadcrumbList']);
  });

  it('a wedding with no cover metadata falls back to the title for alt and keeps an absolute URL as is', () => {
    const meta = metaFor('/stories/pragya', data, ORIGIN);
    expect(meta.image).toEqual({ url: 'https://cdn.example/pragya.jpg', width: null, height: null, alt: 'Pragya <3 & "Co" | Peak Story Studio' });
  });

  it('a More page: the collection title, article type, CollectionPage JSON-LD', () => {
    const meta = metaFor('/more/travels', data, ORIGIN);
    expect(meta.title).toBe('Travels | Peak Story Studio');
    expect(meta.description).toBe('On the road with couples.');
    expect(meta.ogType).toBe('article');
    expect(meta.jsonLd.map((ld) => ld['@type'])).toEqual(['CollectionPage']);
  });

  it('image is null when the route has none, and JSON-LD is empty where pageJsonLd has nothing', () => {
    const empty = { stories: [], photos: [], films: [], collections: [], settings: { ...settings, images: {} }, morePages: [] };
    expect(metaFor('/gallery', empty, ORIGIN).image).toBeNull();
    expect(metaFor('/stories/nope', empty, ORIGIN).jsonLd).toEqual([]);
  });

  it('carries the Google Fonts link only when the settings choose a non-default family', () => {
    const custom = { ...data, settings: { ...settings, fonts: { ...settings.fonts, heading: 'Playfair Display' } } };
    const href = metaFor('/', custom, ORIGIN).fontsHref;
    expect(href).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?family=Playfair\+Display/);
    expect(metaFor('/', data, ORIGIN).fontsHref).toBeNull();
  });
});

describe('escapeHtml', () => {
  it('escapes the five characters that matter in attributes and text', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
    expect(escapeHtml(null)).toBe('');
  });
});

describe('buildHead', () => {
  const tags = (html) => html.split('\n').filter(Boolean);

  it('emits the tags in the documented order for a wedding with cover dimensions', () => {
    const meta = metaFor('/stories/a-royal-affair', data, ORIGIN);
    const head = buildHead(meta);
    expect(tags(head)).toEqual([
      '<title>A Royal Affair | Peak Story Studio</title>',
      `<meta name="description" content="${escapeHtml(meta.description)}">`,
      `<link rel="canonical" href="${ORIGIN}/stories/a-royal-affair">`,
      '<meta property="og:site_name" content="Peak Story Studio">',
      '<meta property="og:locale" content="en_IN">',
      '<meta property="og:type" content="article">',
      `<meta property="og:url" content="${ORIGIN}/stories/a-royal-affair">`,
      '<meta property="og:title" content="A Royal Affair | Peak Story Studio">',
      `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
      `<meta property="og:image" content="${ORIGIN}/images/w/cover.jpg">`,
      '<meta property="og:image:alt" content="Sam and Alex under the mandap">',
      '<meta property="og:image:width" content="1600">',
      '<meta property="og:image:height" content="1067">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:title" content="A Royal Affair | Peak Story Studio">',
      `<meta name="twitter:description" content="${escapeHtml(meta.description)}">`,
      `<meta name="twitter:image" content="${ORIGIN}/images/w/cover.jpg">`,
      `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`,
    ]);
  });

  it('omits width/height without both numbers, and every image tag without an image', () => {
    const pragya = buildHead(metaFor('/stories/pragya', data, ORIGIN));
    expect(pragya).toContain('og:image"');
    expect(pragya).not.toContain('og:image:width');
    expect(pragya).not.toContain('og:image:height');

    const noImage = buildHead({ ...metaFor('/gallery', data, ORIGIN), image: null });
    expect(noImage).not.toContain('og:image');
    expect(noImage).not.toContain('twitter:image');
    expect(noImage).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  it('escapes a title containing <, & and " everywhere it appears', () => {
    const head = buildHead(metaFor('/stories/pragya', data, ORIGIN));
    expect(head).toContain('<title>Pragya &lt;3 &amp; &quot;Co&quot; | Peak Story Studio</title>');
    expect(head).toContain('<meta property="og:title" content="Pragya &lt;3 &amp; &quot;Co&quot; | Peak Story Studio">');
    expect(head).toContain('<meta property="og:image:alt" content="Pragya &lt;3 &amp; &quot;Co&quot; | Peak Story Studio">');
    expect(head).not.toMatch(/content="[^"]*<3/);
  });

  it('serialises a single JSON-LD object bare, a list as an array, with every < escaped', () => {
    const one = buildHead({ ...metaFor('/about', data, ORIGIN), jsonLd: [{ '@type': 'AboutPage', name: '</script><b>' }] });
    expect(one).toContain('<script type="application/ld+json">{"@type":"AboutPage","name":"\\u003c/script>\\u003cb>"}</script>');
    const home = buildHead(metaFor('/', data, ORIGIN));
    expect(home).toContain('<script type="application/ld+json">[{"@context"');
  });

  it('adds the site-fonts link only when there is an href', () => {
    const custom = { ...data, settings: { ...settings, fonts: { ...settings.fonts, body: 'Inter' } } };
    const meta = metaFor('/', custom, ORIGIN);
    const withFonts = buildHead(meta);
    expect(tags(withFonts).at(-1)).toBe(`<link id="site-fonts" rel="stylesheet" href="${escapeHtml(meta.fontsHref)}">`);
    expect(buildHead(metaFor('/', data, ORIGIN))).not.toContain('site-fonts');
  });
});

describe('buildShell', () => {
  it('Home renders the same <h1> HomePage.jsx does, then the description', () => {
    const shell = buildShell(metaFor('/', data, ORIGIN));
    expect(shell).toBe(
      '<div data-prerender-shell class="px-6 py-24 text-center bg-offwhite-100 text-pitch-900">'
      + '<h1 class="font-garamond text-3xl tracking-[0.2em]">Peak Story Studio — Wedding Photography &amp; Films, Lucknow</h1>'
      + `<p class="max-w-2xl mx-auto mt-4 text-charcoal-700">${escapeHtml(STATIC_SEO['/'].description)}</p>`
      + '</div>',
    );
  });

  it('a section strips the studio suffix from the title', () => {
    const shell = buildShell(metaFor('/gallery', data, ORIGIN));
    expect(shell).toContain('<h1 class="font-garamond text-3xl tracking-[0.2em]">Gallery</h1>');
    expect(shell).not.toContain('| Peak Story Studio');
  });

  it('a wedding shows the story title and the same byline storyByline() gives StoryPage', () => {
    const shell = buildShell(metaFor('/stories/a-royal-affair', data, ORIGIN), { byline: storyByline(royal) });
    const h1 = shell.match(/<h1[^>]*>(.*?)<\/h1>/)[1];
    const byline = shell.match(/<\/h1><p[^>]*>(.*?)<\/p>/)[1];
    expect(h1).toBe(royal.title);
    expect(byline).toBe(escapeHtml(storyByline(royal)));
    expect(byline).toBe('Sam &amp; Alex · La Martiniere, Lucknow · November 2024');
    expect(shell.match(/<p /g)).toHaveLength(2);
  });

  it('omits the byline paragraph when there is no byline, escapes text, and uses no inline style or hiding', () => {
    const shell = buildShell(metaFor('/stories/pragya', data, ORIGIN), { byline: '' });
    expect(shell).toContain('<h1 class="font-garamond text-3xl tracking-[0.2em]">Pragya &lt;3 &amp; &quot;Co&quot;</h1>');
    expect(shell.match(/<p /g)).toHaveLength(1);
    expect(shell).not.toMatch(/style=|hidden|sr-only|aria-hidden/);
  });
});

describe('injectHead', () => {
  const meta = metaFor('/stories/a-royal-affair', data, ORIGIN);
  const head = buildHead(meta);
  const shell = buildShell(meta, { byline: storyByline(royal) });

  it('replaces the title and description, adds the block before </head>, fills #root, leaves the rest byte-identical', () => {
    const out = injectHead(INDEX_HTML, head, shell);
    expect(out.match(/<title>/g)).toHaveLength(1);
    expect(out.match(/name="description"/g)).toHaveLength(1);
    expect(out).toContain('<title>A Royal Affair | Peak Story Studio</title>');
    expect(out).not.toContain('Static copy.');
    expect(out).toContain(`<!-- prerender:start -->\n${head}\n<!-- prerender:end -->\n  </head>`);
    expect(out).toContain(`<div id="root">${shell}</div>`);

    const strip = (html) => html
      .replace(/[ \t]*<!-- prerender:start -->[\s\S]*?<!-- prerender:end -->\n/, '')
      .replace(/<div data-prerender-shell[\s\S]*?<\/div>/, '');
    const original = INDEX_HTML
      .replace(/[ \t]*<title>.*<\/title>\n/, '')
      .replace(/[ \t]*<meta name="description"[^>]*>\n/, '');
    expect(strip(out)).toBe(original);
  });

  it('is idempotent: injecting twice equals injecting once, and a different route replaces the first', () => {
    const once = injectHead(INDEX_HTML, head, shell);
    expect(injectHead(once, head, shell)).toBe(once);

    const gallery = metaFor('/gallery', data, ORIGIN);
    const second = injectHead(once, buildHead(gallery), buildShell(gallery));
    expect(second).toBe(injectHead(INDEX_HTML, buildHead(gallery), buildShell(gallery)));
    expect(second).not.toContain('A Royal Affair');
  });

  it('throws when the document lacks a <title>, </head>, or #root', () => {
    expect(() => injectHead(INDEX_HTML.replace(/<title>.*<\/title>/, ''), head, shell)).toThrow(/<title>/);
    expect(() => injectHead(INDEX_HTML.replace('</head>', ''), head, shell)).toThrow(/<\/head>/);
    expect(() => injectHead(INDEX_HTML.replace('<div id="root"></div>', '<main></main>'), head, shell)).toThrow(/id="root"/);
  });
});

describe('sitemapXml', () => {
  it('lists absolute, escaped locations with lastmod as a date only when given', () => {
    const xml = sitemapXml([
      { path: '/' },
      { path: '/stories/a-royal-affair', lastmod: '2026-08-01T10:00:00.000Z' },
      { path: '/more/tom&jerry', lastmod: '2026-07-15' },
    ], `${ORIGIN}/`);
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + `  <url><loc>${ORIGIN}/</loc></url>\n`
      + `  <url><loc>${ORIGIN}/stories/a-royal-affair</loc><lastmod>2026-08-01</lastmod></url>\n`
      + `  <url><loc>${ORIGIN}/more/tom&amp;jerry</loc><lastmod>2026-07-15</lastmod></url>\n`
      + '</urlset>\n',
    );
  });

  it('is an empty urlset for no entries', () => {
    expect(sitemapXml([], ORIGIN)).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>');
  });
});

describe('buildInfo', () => {
  const base = { builtAt: '2026-09-08T00:00:00.000Z', origin: ORIGIN, degraded: false, routes: ['/', '/gallery'] };

  it('returns the build facts plus a sha256 fingerprint of the content', () => {
    const info = buildInfo({ ...base, data });
    expect(info).toMatchObject(base);
    expect(info.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(info)).toEqual(['builtAt', 'origin', 'degraded', 'routes', 'fingerprint']);
  });

  it('is stable across key order, list order, and fields the site does not render', () => {
    const shuffled = {
      settings: { logo: settings.logo, fonts: { quote: settings.fonts.quote, body: settings.fonts.body, heading: settings.fonts.heading }, contact: { ...settings.contact }, brandStory: settings.brandStory, quote: settings.quote, appearance: { warmth: 'other' } },
      stories: [...stories].reverse().map((story) => ({ ...story, fullGallery: [] })),
      collections: [...collections].reverse(),
      films: [...films].reverse(),
      photos: [...photos].reverse(),
    };
    expect(buildInfo({ ...base, data: shuffled }).fingerprint).toBe(buildInfo({ ...base, data }).fingerprint);
    expect(buildInfo({ ...base, builtAt: '2027-01-01T00:00:00.000Z', data }).fingerprint).toBe(buildInfo({ ...base, data }).fingerprint);
  });

  it('changes when a slug, an updatedAt, a setting, a photo or a film changes', () => {
    const before = buildInfo({ ...base, data }).fingerprint;
    const variants = [
      { ...data, stories: [{ ...royal, slug: 'a-royal-affair-2' }, bare, badSlug] },
      { ...data, stories: [{ ...royal, updatedAt: '2026-08-09T10:00:00.000Z' }, bare, badSlug] },
      { ...data, collections: [{ ...collections[0], slug: 'journeys' }, collections[1]] },
      { ...data, settings: { ...settings, quote: { ...settings.quote, text: 'Changed' } } },
      { ...data, settings: { ...settings, fonts: { ...settings.fonts, heading: 'Inter' } } },
      { ...data, photos: [...photos, { id: 'g-2', url: '/images/g/2.jpg' }] },
      { ...data, films: [] },
    ];
    for (const variant of variants) expect(buildInfo({ ...base, data: variant }).fingerprint).not.toBe(before);
  });

  it('is the sha256 of a sorted summary, so it is reproducible', () => {
    const info = buildInfo({ ...base, data: { stories: [], photos: [], films: [], collections: [], settings: {} } });
    const summary = { collections: [], films: [], photos: [], settings: { brandStory: null, contact: null, fonts: null, logo: null, quote: null }, stories: [] };
    expect(info.fingerprint).toBe(createHash('sha256').update(JSON.stringify(summary)).digest('hex'));
  });
});

describe('routesFor and the reserved basename', () => {
  it('skips a slug of "index" — <dir>/index.html would be canonicalised to a trailing slash on Pages', () => {
    const { routes, skipped } = routesFor({ collections: [{ id: 'c', slug: 'index', title: 'Index' }], stories: [{ id: 's', slug: 'index' }] });
    expect(routes).not.toContain('/more/index');
    expect(routes).not.toContain('/stories/index');
    expect(skipped.map((s) => s.slug)).toEqual(['index', 'index']);
  });
});
