#!/usr/bin/env node
// Gate for the post-build prerender (Phase 5, SEO): asserts that the dist/
// a build just wrote carries what the design in
// docs/superpowers/specs/2026-09-08-seo-design.md promises, checked against
// the database the build read from.
//
// Reads every published wedding and collection back through
// src/lib/queries/weddings.js and src/lib/queries/collections.js — the
// exact modules scripts/prerender.mjs itself imports — and then inspects
// the files: one flat HTML file per route with the wedding's own title,
// canonical, og:image, JSON-LD and visible shell; the six static pages;
// sitemap.xml listing every route; build-info.json not degraded; and no
// <dir>/index.html anywhere the host would canonicalise to a trailing slash.
// A green `npm run build` only proves the script exited 0; this is what
// proves the output is the one crawlers need.
//
// Does NOT build. Run `npm run build` (or `npm run prerender`) first, with
// the same VITE_SITE_URL and VITE_MEDIA_BASE_URL this script sees, so both
// sides resolve the same origin and the same media URLs.
//
// Runs under vite-node, not plain node, for the same reason verify-admin.mjs
// does: the query modules read import.meta.env.VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY, which only Vite's runtime resolves.
import fs from 'node:fs';
import path from 'node:path';
import { exitUnlessLocalTarget } from './lib/assert-local-target.mjs';

// src/lib/supabase.js only ever reads the VITE_-prefixed names; the
// local-target guard and the other verifiers read the plain ones. Accept
// either spelling and fill in the other, before the dynamic imports below
// ask vite-node to resolve import.meta.env for the query modules.
process.env.VITE_SUPABASE_URL ??= process.env.SUPABASE_URL;
process.env.VITE_SUPABASE_ANON_KEY ??= process.env.SUPABASE_ANON_KEY;
process.env.SUPABASE_URL ??= process.env.VITE_SUPABASE_URL;
process.env.SUPABASE_ANON_KEY ??= process.env.VITE_SUPABASE_ANON_KEY;

const DIST = path.resolve(process.cwd(), 'dist');
const BUILD_INFO = path.join(DIST, 'build-info.json');
const STATIC_ROUTES = ['/', '/gallery', '/films', '/stories', '/about', '/contact'];
const STATIC_FILES = ['index.html', 'gallery.html', 'films.html', 'stories.html', 'about.html', 'contact.html'];

if (!fs.existsSync(BUILD_INFO)) {
  console.error('dist/build-info.json is missing — run npm run build first (verify:prerender does not build).');
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error(
    'Missing credentials. supabase status names them API_URL/ANON_KEY;\n' +
    'this script reads SUPABASE_URL/SUPABASE_ANON_KEY (or the VITE_-prefixed pair). Map them:\n' +
    '  eval "$(supabase status -o env | sed \'s/^/export /\')"\n' +
    '  export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY"',
  );
  process.exit(1);
}

// Read-only, but it still reads real rows: local stack only unless
// ALLOW_REMOTE_DB=yes — see scripts/lib/assert-local-target.mjs.
exitUnlessLocalTarget('verify:prerender');

// Imported for real, not reimplemented — the same modules the prerender reads.
const { getPublishedWeddings } = await import('../src/lib/queries/weddings.js');
const { getCollections } = await import('../src/lib/queries/collections.js');
const { storyByline } = await import('../src/data/seo.js');

const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

// --- small readers over the built files ------------------------------------

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const unescapeHtml = (value) => String(value ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity]);

const readDist = (relative) => fs.readFileSync(path.join(DIST, relative), 'utf8');
const distHas = (relative) => fs.existsSync(path.join(DIST, relative));

function titleOf(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/);
  return match ? unescapeHtml(match[1]) : null;
}

function canonicalOf(html) {
  const match = html.match(/<link rel="canonical" href="([^"]*)">/);
  return match ? unescapeHtml(match[1]) : null;
}

function metaContent(html, attr, name) {
  const match = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)">`));
  return match ? unescapeHtml(match[1]) : null;
}

// The JSON-LD script's parsed value, as an array whatever the head wrote;
// null when there is no script or it does not parse.
function jsonLdOf(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return null;
  }
}

function shellHeadingOf(html) {
  const match = html.match(/<div data-prerender-shell[^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/);
  return match ? unescapeHtml(match[1]) : null;
}

// The byline paragraph the shell carries under a wedding's h1 (couple · location ·
// date) — the first <p> inside the shell.
function shellBylineOf(html) {
  const match = html.match(/<div data-prerender-shell[^>]*>[\s\S]*?<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/);
  return match ? unescapeHtml(match[1]) : null;
}

const count = (haystack, needle) => haystack.split(needle).length - 1;

// The og:image the head should carry for a wedding: its coverImage as the
// site resolves it, made absolute against the build's origin. Computed
// here rather than imported from src/lib/seo/jsonLd.js so the expectation
// is independent of the function the prerender itself calls.
function expectedImage(coverImage, origin) {
  if (/^https?:\/\//i.test(coverImage)) return coverImage;
  return `${origin.replace(/\/+$/, '')}${coverImage.startsWith('/') ? '' : '/'}${coverImage}`;
}

// Every file named index.html below dist/<dir>, which Cloudflare Pages
// would serve at /<dir>/<slug>/ (trailing slash) instead of /<dir>/<slug>.
function indexFilesUnder(dir) {
  const root = path.join(DIST, dir);
  if (!fs.existsSync(root)) return [];
  const found = [];
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.html') found.push(path.relative(DIST, full));
    }
  };
  walk(root);
  return found;
}

// --- checks ------------------------------------------------------------------

function checkBuildInfo() {
  console.log('build-info.json');
  let info = null;
  try {
    info = JSON.parse(readDist('build-info.json'));
  } catch (error) {
    check('build-info.json parses', false, error.message);
    return null;
  }
  check('build-info.json parses', info && typeof info === 'object');
  check('the build was not degraded', info.degraded === false, `degraded=${JSON.stringify(info.degraded)}`);
  check('origin is an absolute http(s) URL', /^https?:\/\/[^/\s]+/i.test(String(info.origin ?? '')), String(info.origin));
  const routes = Array.isArray(info.routes) ? info.routes : [];
  const missing = STATIC_ROUTES.filter((route) => !routes.includes(route));
  check('routes include the six static routes', missing.length === 0, `missing ${missing.join(', ')}`);
  return info;
}

function checkStaticPages() {
  console.log('\nstatic pages');
  for (const file of STATIC_FILES) check(`dist/${file} exists`, distHas(file));
  if (distHas('index.html')) {
    const starts = count(readDist('index.html'), '<!-- prerender:start -->');
    check('dist/index.html carries exactly one prerender block', starts === 1, `found ${starts}`);
  }
  check('dist/robots.txt exists', distHas('robots.txt'));
}

function checkWedding(wedding, origin) {
  const file = `stories/${wedding.slug}.html`;
  console.log(`\nwedding "${wedding.title}" (${file})`);
  if (!distHas(file)) {
    check(`dist/${file} exists`, false);
    return;
  }
  check(`dist/${file} exists`, true);
  const html = readDist(file);

  const title = titleOf(html);
  check('<title> contains the wedding title', Boolean(title) && title.includes(wedding.title), JSON.stringify(title));

  const canonical = canonicalOf(html);
  check(`canonical ends with /stories/${wedding.slug}`, Boolean(canonical) && canonical.endsWith(`/stories/${wedding.slug}`), JSON.stringify(canonical));

  if (wedding.coverImage) {
    const expected = expectedImage(wedding.coverImage, origin);
    const actual = metaContent(html, 'property', 'og:image');
    check('og:image is the cover image, absolute', actual === expected, `expected ${expected}, got ${actual}`);
  } else {
    check('og:image skipped — the wedding has no cover image', true);
  }

  const jsonLd = jsonLdOf(html);
  check('JSON-LD script parses', jsonLd !== null);
  const gallery = (jsonLd ?? []).find((node) => node?.['@type'] === 'ImageGallery');
  check('JSON-LD has an ImageGallery named after the wedding', gallery?.name === wedding.title, JSON.stringify(gallery?.name ?? null));

  const heading = shellHeadingOf(html);
  check('the crawler shell h1 is the wedding title', heading === wedding.title, JSON.stringify(heading));
  const expectedByline = storyByline(wedding);
  if (expectedByline) {
    const byline = shellBylineOf(html);
    check('the crawler shell carries the couple · location · date byline', byline === expectedByline, JSON.stringify(byline));
  }
}

function checkCollection(collection) {
  const file = `more/${collection.slug}.html`;
  console.log(`\ncollection "${collection.title}" (${file})`);
  if (!distHas(file)) {
    check(`dist/${file} exists`, false);
    return;
  }
  check(`dist/${file} exists`, true);
  const title = titleOf(readDist(file));
  check('<title> contains the collection title', Boolean(title) && title.includes(collection.title), JSON.stringify(title));
}

function checkSitemap(origin, weddings, collections) {
  console.log('\nsitemap.xml');
  if (!distHas('sitemap.xml')) {
    check('dist/sitemap.xml exists', false);
    return;
  }
  check('dist/sitemap.xml exists', true);
  const xml = readDist('sitemap.xml');
  const base = origin.replace(/\/+$/, '');
  const expectedPaths = [
    ...STATIC_ROUTES,
    ...weddings.map((wedding) => `/stories/${wedding.slug}`),
    ...collections.map((collection) => `/more/${collection.slug}`),
  ];
  for (const route of expectedPaths) {
    const loc = `<loc>${base}${route}</loc>`;
    check(`sitemap lists ${route}`, xml.includes(loc), `no ${loc}`);
  }
}

function checkFlatLayout() {
  console.log('\nflat-file layout');
  for (const dir of ['stories', 'more']) {
    const found = indexFilesUnder(dir);
    check(`no index.html under dist/${dir}`, found.length === 0, found.join(', '));
  }
}

async function main() {
  const info = checkBuildInfo();
  if (!info) return;
  const origin = String(info.origin ?? '');

  const [weddings, collections] = await Promise.all([getPublishedWeddings(), getCollections()]);
  console.log(`\ndatabase: ${weddings.length} published wedding(s), ${collections.length} collection(s)`);

  checkStaticPages();
  for (const wedding of weddings) checkWedding(wedding, origin);
  for (const collection of collections) checkCollection(collection);
  checkSitemap(origin, weddings, collections);
  checkFlatLayout();

  console.log('');
  if (failures.length > 0) {
    console.error(`verify:prerender FAILED — ${failures.length} check(s): ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log(`verify:prerender passed — dist/ carries a prerendered head for every published route (${info.routes.length} routes).`);
  process.exit(0);
}

main().catch((error) => {
  console.error('verify:prerender crashed:', error.message);
  process.exit(1);
});
