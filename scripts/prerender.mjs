#!/usr/bin/env node
// Post-build step of `npm run build` (Phase 5, SEO): stamps every public route
// with its own crawler-visible <head> and a small visible shell, and writes
// sitemap.xml and build-info.json — see docs/superpowers/specs/2026-09-08-seo-design.md
// and ADR 0006.
//
// Runs under vite-node, not plain node, for the same reason verify-admin.mjs
// does: the query modules it imports read import.meta.env, which only Vite's
// runtime resolves. Importing the real modules (rather than re-declaring the
// query shape here) is what keeps the prerendered head and the live page
// reading the same rows the same way.
//
// Output layout is deliberate and tested: FLAT files (dist/gallery.html,
// dist/stories/<slug>.html), never <dir>/index.html, because Cloudflare
// Pages serves foo.html at /foo but canonicalises foo/index.html to /foo/.
// dist/index.html (Home) is rewritten in place, idempotently.
//
// Failure policy (scripts/lib/prerender-env.mjs): on Cloudflare a missing or
// unreachable database fails the build so the last good deployment stays
// live; elsewhere the build degrades to the six static routes so CI's
// databaseless build job and a laptop without the local stack still work.
import fs from 'node:fs';
import path from 'node:path';
import { resolveOrigin, failurePolicy, mapDatabaseEnv } from './lib/prerender-env.mjs';
import { storyByline } from '../src/data/seo.js';
import {
  STATIC_ROUTES, routesFor, metaFor, buildHead, buildShell, injectHead, sitemapXml, buildInfo,
} from './lib/prerender-html.mjs';

const DIST = path.resolve(process.cwd(), 'dist');
const INDEX = path.join(DIST, 'index.html');

function log(message) { console.log(`prerender: ${message}`); }
function fail(message) { console.error(`prerender: ${message}`); process.exit(1); }

if (!fs.existsSync(INDEX)) fail('dist/index.html is missing — run `vite build` first (npm run build does both)');

const { origin, source } = resolveOrigin(process.env);
log(`origin ${origin} (from ${source})`);

// Must happen before the query modules are imported (they read import.meta.env).
const database = mapDatabaseEnv(process.env);

async function loadContent() {
  if (!database.configured) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set');
  const [{ getPublishedWeddings }, { getCollections }, { getGalleryPhotos }, { getFilms }, { getSiteSettings }] = await Promise.all([
    import('../src/lib/queries/weddings.js'),
    import('../src/lib/queries/collections.js'),
    import('../src/lib/queries/gallery.js'),
    import('../src/lib/queries/films.js'),
    import('../src/lib/queries/siteSettings.js'),
  ]);
  const [stories, collections, photos, films, settings] = await Promise.all([
    getPublishedWeddings(), getCollections(), getGalleryPhotos(), getFilms(), getSiteSettings(),
  ]);
  return { stories, collections, photos, films, settings };
}

async function degradedContent() {
  const { SITE_SETTINGS_FALLBACK } = await import('../src/data/siteSettingsFallback.js');
  return { stories: [], collections: [], photos: [], films: [], settings: SITE_SETTINGS_FALLBACK };
}

let content;
let degraded = false;
try {
  content = await loadContent();
  log(`content: ${content.stories.length} weddings, ${content.collections.length} pages, ${content.photos.length} gallery photos, ${content.films.length} films`);
} catch (err) {
  const policy = failurePolicy(process.env);
  if (policy.mode === 'fail') {
    fail(`could not load content (${err.message}); refusing to publish a degraded site because ${policy.reason}. Set PRERENDER_ALLOW_EMPTY=1 to override.`);
  }
  log(`WARNING: could not load content (${err.message}); writing the static routes only (${policy.reason})`);
  content = await degradedContent();
  degraded = true;
}

const data = { ...content, morePages: content.collections.map(({ slug, title }) => ({ slug, title })) };
const { routes, skipped } = routesFor(data);
for (const bad of skipped) log(`WARNING: skipped a route whose slug is not URL-safe: ${JSON.stringify(bad)}`);

// A rerun must not leave behind files for weddings or pages unpublished since
// the last run (a fresh build has none; `npm run prerender` reruns do).
for (const dir of ['stories', 'more']) fs.rmSync(path.join(DIST, dir), { recursive: true, force: true });

const indexHtml = fs.readFileSync(INDEX, 'utf8');
const written = [];
for (const pathname of routes) {
  const meta = metaFor(pathname, data, origin);
  const story = pathname.startsWith('/stories/') ? data.stories.find((s) => `/stories/${s.slug}` === pathname) : null;
  const html = injectHead(indexHtml, buildHead(meta), buildShell(meta, { byline: story ? storyByline(story) : '' }));
  const target = pathname === '/' ? INDEX : path.join(DIST, `${pathname.slice(1)}.html`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
  written.push(path.relative(DIST, target));
}

const lastmod = new Map(data.stories.map((s) => [`/stories/${s.slug}`, s.updatedAt]));
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemapXml(routes.map((p) => ({ path: p, lastmod: lastmod.get(p) || undefined })), origin));
const info = buildInfo({ builtAt: new Date().toISOString(), origin, degraded, routes, data });
fs.writeFileSync(path.join(DIST, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`);

log(`wrote ${written.length} route files (${STATIC_ROUTES.length} static, ${routes.length - STATIC_ROUTES.length} dynamic), sitemap.xml, build-info.json${degraded ? ' — DEGRADED' : ''}`);

// The Supabase client keeps sockets alive, which would keep this process
// alive after the work is done; exit explicitly so `npm run build` returns.
process.exit(0);
