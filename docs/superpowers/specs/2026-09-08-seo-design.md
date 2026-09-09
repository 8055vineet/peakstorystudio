# Phase 5 — SEO and shareable pages (`v0.6`) — design

**Status:** approved for implementation, 2026-09-08. Branch `phase-5/seo`. Roadmap row: "SEO and
shareable pages — Routing, per-wedding URLs, prerendering, sitemap, OG images, structured data.
Definition of done: every wedding has its own indexable, shareable URL."

This design was produced by a judged panel of three independent architectures (build-time
head-only static HTML; build-time full `renderToString` prerender; request-time head injection
in a Cloudflare Pages Function) scored through three lenses (reliability on Pages, freshness and
operational burden for a non-technical solo owner, engineering fit with this repo). The judges
tied on points; the tie broke on agreed fatal flaws: full SSR makes every automatic rebuild
depend on every component staying SSR-safe forever (six public files already read `window`,
`localStorage`, or `Math.random` during render), and the request-time Function puts a runtime
tier plus Supabase in front of every visitor, with a second query layer outside
`src/lib/queries/` and an undocumented Workers-Free daily quota cliff. **Build-time head-only
static HTML won**, strengthened with ideas from the runners-up (below).

## 1. Goal

Make every public page discoverable by search engines and presentable when its link is shared,
without leaving the Vite SPA, and without the owner needing a deploy to publish content:

1. Every published wedding has its own URL, `/stories/<slug>`, rendered as a page, not a modal.
2. Every public route ships crawler-visible HTML with a correct `<title>`, meta description,
   canonical URL, Open Graph / Twitter tags with a real photograph, and JSON-LD — in the raw
   file, with no JavaScript required for share cards or first-wave indexing.
3. `sitemap.xml` and `robots.txt` exist and list every published page.
4. Google's local signals exist: a `LocalBusiness` record with the Lucknow address, phone,
   email, and (when set) Instagram/YouTube.
5. Core Web Vitals are not sabotaged by font loading: only the families the site uses load.
6. Basics: an `<h1>` on Home, a real favicon from the studio logo, and hosting rules that
   actually work on Cloudflare Pages.
7. Content published in the admin reaches crawlers automatically within minutes, and the
   owner can see in the admin when a page is ready to share.

Closes `PS-008` and `PS-045`. Touches `PS-047` (`updated_at` never maintained) ahead of its
planned Phase 7 because sitemap `lastmod` is a lie without it — recorded here per CLAUDE.md.

## 2. Non-goals

- Server-side rendering or hydration of the React tree. React mounts client-side and
  replaces whatever the prerendered file put inside `#root`.
- A Cloudflare Pages Function on the HTML path; a Next.js migration (platform spec §8).
- Real HTTP 404s (`404.html`). Kept as the SPA fallback so a wedding published minutes before
  its rebuild still serves the app rather than a 404 that link-preview fetchers may cache. A
  `404.html` must never be added.
- Designed OG cards or image derivatives. The page's own photograph is the card image. After
  the domain cutover, `og:image` can point at `/cdn-cgi/image/width=1200,height=630,fit=cover/…`
  for a proper crop (Phase 7 follow-up, not built now).
- Removing the `pages.dev` `noindex` header (Phase 7's cutover step; this phase keeps it a
  one-file deletion). Alt-text quality (`PS-052`). Vimeo (`PS-042`).

## 3. Hosting facts this design rests on (verified against developers.cloudflare.com, 2026-09-08)

- **Route matching:** a flat `dist/<route>.html` is served at `/<route>`, and `/<route>.html`
  redirects to it; `<dir>/index.html` is canonicalised to `/<dir>/` with a trailing slash. So
  per-route files are **flat** (`dist/gallery.html`, `dist/stories/<slug>.html`), never
  `<dir>/index.html`.
- **SPA fallback:** with no top-level `404.html`, Pages serves the root for any unmatched path.
- **`_redirects`:** "Redirects are always followed, regardless of whether or not an asset
  matches the incoming request"; proxying (`/a /b 200`) is supported, relative only. Therefore
  the runbook's `/* /index.html 200` catch-all would have proxied every asset and every
  prerendered file to `index.html` — a latent first-deploy breaker (the site has never been
  deployed, so the rule was never exercised). It is removed (done, Phase 5 foundations); the
  built-in SPA fallback does the job. `_redirects` rules are *not* applied to responses served
  by Pages Functions, and `_headers` is not either — both reasons the Function design lost.
- **Deploy Hooks:** a POST to a unique URL builds a chosen branch; the URL is the only
  credential, so it is a secret (Edge Function env, never a `VITE_*` variable or git).
- **Build image v3:** Ubuntu 22.04, Node 22 by default (`NODE_VERSION`/`.nvmrc`), 500 builds a
  month, one concurrent build, 20-minute timeout. Running a browser in the build is
  undocumented and is not relied on.
- **Repo/CI:** the CI `verify` job runs `npm run build` with no database and no `VITE_*`
  variables. The prerender step must therefore never fail a build for lack of a database
  *except* on Cloudflare (`CF_PAGES=1`), where a failed build correctly leaves the last good
  deployment live.

## 4. Architecture

```
npm run build
  = vite build                        (unchanged: dist/index.html, dist/admin.html, assets)
  && vite-node scripts/prerender.mjs  (new post-build step)

scripts/prerender.mjs
  1. origin = VITE_SITE_URL || CF_PAGES_URL || 'http://localhost:4173'
  2. data via the REAL query modules: getPublishedWeddings(), getCollections(),
     getGalleryPhotos(), getFilms(), getSiteSettings()   (anon key → published rows only)
  3. routes = six static + /more/<slug> + /stories/<slug>   (slugs must match SLUG_PATTERN)
  4. per route: head = buildHead(meta), shell = buildShell(meta)
     html = injectHead(dist/index.html, head, shell)   → write dist/<route>.html (flat)
     dist/index.html (Home) is rewritten in place, idempotently
  5. write dist/sitemap.xml and dist/build-info.json
```

- **Why `vite-node`:** `src/lib/supabase.js` and `src/lib/mediaUrl.js` read `import.meta.env`,
  which plain Node cannot evaluate; `vite-node` is already a devDependency and already runs
  `scripts/verify-admin.mjs` the same way (mapping `process.env.VITE_*`). The script imports
  the exact query modules the site runs — one query shape, one media-URL resolver, the same
  published-only filter. `scripts/` is the one place outside `src/lib/queries/` allowed to
  import query modules; components still never import the Supabase client.
- **Head data** comes from the pure modules built in the foundations step: `titleFor` in
  `src/lib/documentTitle.js`, `descriptionFor`/`cardImageFor` in `src/data/seo.js`, and
  `localBusinessJsonLd`/`websiteJsonLd`/`pageJsonLd` in `src/lib/seo/jsonLd.js`. The build
  script and the client share them, so tab titles and prerendered titles cannot drift. A test
  asserts `src/data/seo.js`'s Home description equals `index.html`'s static one.
- **`buildHead`** emits: `<title>`, `meta[name=description]`, `link[rel=canonical]` (no
  trailing slash), `og:site_name`, `og:locale=en_IN`, `og:type`, `og:url`, `og:title`,
  `og:description`, `og:image` (absolute), `og:image:alt`, `og:image:width/height` when the
  media row has them, `twitter:card=summary_large_image` + title/description/image, and one
  `<script type="application/ld+json">` (`LocalBusiness` + `WebSite` on Home, the per-page
  type elsewhere). All values HTML-escaped; JSON-LD has `<` escaped. When the settings resolve
  non-default fonts, the head also carries the `<link id="site-fonts">` the client would
  otherwise add at runtime (`src/lib/googleFonts.js`), so the chosen fonts load in the first
  paint. No `<meta name="robots">` anywhere — `_headers` is the one control.
- **`injectHead`** replaces the existing `<title>` and `meta[name=description]`, inserts the
  rest inside a `<!-- prerender:start -->…<!-- prerender:end -->` block before `</head>`, and
  puts the shell inside `<div id="root">`. It strips any previous block first, so it is
  idempotent. Vite's script/modulepreload/stylesheet tags and the rest of the body stay
  byte-identical.
- **Crawler shell** inside `#root`: a visible, on-design `<h1>` (the page title; for a wedding
  its title with the couple · location · date byline) and one paragraph (the description), using
  the site's own Tailwind classes from the linked stylesheet — never hidden text. React's
  `createRoot().render()` replaces it on mount (a jsdom "takeover" test proves this without
  warnings). The shell text is derived from the same helpers `StoryPage` renders, with a test
  asserting equality, so it cannot drift from the page.
- **Failure policy:** database unreachable or unconfigured → on Cloudflare (`CF_PAGES=1`) exit
  non-zero so the previous deployment stays live; elsewhere (CI, local) log a warning, emit
  the six static routes with static copy, the sitemap of those routes, and `build-info.json`
  marked `degraded: true`, and exit 0. `PRERENDER_ALLOW_EMPTY=1` forces the degraded path on
  Cloudflare too (escape hatch). Zero published weddings is not an error.
- **`build-info.json`:** `{ builtAt, origin, degraded, routes: [...], fingerprint }` where the
  fingerprint hashes the content the build saw. The admin reads it from the public origin to
  show "site last published" and whether a given wedding is live.
- **Sitemap:** the six static routes, every published wedding, every published collection;
  `lastmod` from `updated_at` (weddings; maintained by the new trigger) and `created_at`
  otherwise; absolute URLs from the origin. `robots.txt` stays static in `public/`.
- **`_redirects`** gains `/stories/:slug/ /stories/:slug 301` and `/more/:slug/ /more/:slug 301`
  (placeholders are documented) rather than relying on undocumented trailing-slash handling.
- **Data (additive):** `WEDDING_SELECT` adds `updated_at` and
  `cover:cover_media_id (storage_path, width, height, alt_text)`; `toWedding()` adds
  `updatedAt` and `coverMeta { width, height, alt }`. No consumer changes.
- **Dev/preview:** `npm run dev` is unchanged (client-side titles only; no prerendered head).
  `vite preview` serves `dist/` — Vite's own HTML fallback maps `/gallery` to `gallery.html`, so
  the prerendered files are reviewable locally; the existing `adminEntryRewrite` plugin is
  not extended. `npm run prerender` reruns only the post-build step.
- **Slugs:** one `SLUG_PATTERN` (`/^[a-z0-9-]{1,120}$/`) exported from `src/data/seo.js`,
  asserted against the admin's slugify output in a test and used by the route list, so the
  prerender never writes a filename Pages would canonicalise differently.

## 5. Per-wedding page — done in the foundations step

`StoryPage` (`/stories/:slug`) renders the album via `StoryAlbum` (extracted from the retired
`StoryDetailModal`): tags, title as the page `<h1>`, summary, details card with "Play Film",
active image with prev/next, keyboard-operable thumbnails opening the site lightbox at the
right index. `FeaturedStories` cards are real links. Unknown slug → `NotFoundPage`; while the
list loads → nothing. `titleFor` knows the route; while stories are not yet loaded it says
"Stories | Peak Story Studio", never "Page not found".

## 6. Freshness — automatic rebuild when content changes

**Deviation from the panel:** the synthesis proposed a database-side dispatcher (dirty flag,
`pg_cron` every minute, `pg_net` POST, hook URL in Supabase Vault). That is three new
extensions, a Vault dependency the local stack has commented out, and a verification gate on
the hosted free plan — for a site whose every publish action already happens in the admin.
This phase uses the pattern the repo already trusts for uploads and team management: an
**Edge Function holding the secret**, called by the admin.

- **Migration `site_publish`:** a singleton row (`id = 1 check`) with `content_changed_at`,
  `last_dispatch_at`, `last_dispatch_status` (`text`), `dispatch_count`, plus `updated_at`
  maintenance via `moddatetime` on `weddings` and `site_settings` (`PS-047`, pulled forward).
  Triggers on every public-content table (`weddings`, `wedding_photos`, `gallery_photos`,
  `films`, `testimonials`, `collections`, `collection_items`, `site_settings`,
  `gallery_categories`, `booking_services`) set `content_changed_at = now()` when a change is
  publicly visible (a `status` column changing, or any change to a row that is/was
  `published`, or any change where there is no status). RLS: admins read the row; nobody
  writes it from the browser (the function uses the service role).
- **Edge Function `request-rebuild`** (`verify_jwt = true`, admin role checked from the
  database exactly like `sign-upload`): reads `CF_DEPLOY_HOOK_URL` from its secrets (never in
  git; documented in `supabase/functions/.env.example` as blank), POSTs it with a 10-second
  timeout, records `last_dispatch_at/status` in `site_publish`, and returns
  `{ ok, dispatched, reason }`. Floor: if a dispatch happened under 90 seconds ago, it still
  dispatches once more (a build that started before the change could have read stale content)
  but never a third time inside the window — Cloudflare queues the extra build. Missing hook
  URL → `{ ok: false, error: 'NOT_CONFIGURED' }` (local development never has one).
- **Admin:** a `usePublishStatus` hook (polls `site_publish` every 30 s while the admin is open
  and fetches `<origin>/build-info.json`) drives (a) automatic dispatch — when
  `content_changed_at > last_dispatch_at`, the admin calls `request-rebuild` after a 20-second
  quiet window so a burst of saves becomes one build; (b) an Overview widget: "Site last
  published <time>", "Changes waiting since <time> — publishing…", and a warning when waiting
  exceeds 20 minutes with the manual fallback (Cloudflare dashboard → Retry deployment);
  (c) a **Rebuild now** button (same function, `force: true`); (d) a per-wedding cue in the
  Weddings list — "Live · View page" linking to `/stories/<slug>` when its `updated_at` is
  older than the live `build-info.json`, else "Publishing…".
- Scripts (`load-real-content.mjs`) do not dispatch; the runbook says to press Rebuild now
  afterwards.
- Documented contingency if the admin-driven dispatch ever proves insufficient: the panel's
  `pg_cron` dispatcher, or a GitHub Actions cron (precedent: `keepalive.yml`).

## 7. Failure modes

| Situation | Behaviour |
| --- | --- |
| Database down at build on Cloudflare | build fails, last deployment stays live, admin shows "waiting" |
| Database down at build in CI/local | degraded static build, exit 0, warning logged |
| Wedding unpublished after the last build | its file is served until the rebuild lands (minutes); the client app renders not-found immediately on navigation |
| Wedding published seconds ago, link shared before rebuild | SPA fallback serves the root file; the page renders client-side with the generic card |
| Deploy hook URL unset (local) | function answers `NOT_CONFIGURED`; admin widget says rebuilds are not configured |
| Cloudflare hook POST fails | recorded as `last_dispatch_status`, admin keeps "waiting", retries on the next quiet window |
| Supabase unreachable in the browser | unchanged from today (outage fallback) |

## 8. Testing

Unit (Vitest): `scripts/lib/prerender-html.mjs` (pure `buildHead`/`buildShell`/`injectHead`/
`sitemapXml`/`routesFor`, idempotence, escaping, no-data cases); `src/data/seo.js` and
`src/lib/seo/jsonLd.js` (done); `SLUG_PATTERN` vs the admin slugify; shell-equals-page helpers;
Home description equals `index.html`; the jsdom `createRoot` takeover; `request-rebuild`'s pure
floor logic (`supabase/functions/_shared/`); `usePublishStatus`; Overview widget; weddings-list
cue. Route tests for `/stories/<slug>` (done). Scripts: `npm run verify:prerender` runs the
real prerender against the local stack and asserts `dist/stories/<slug>.html` carries the
wedding's title/description/canonical/og:image and that `sitemap.xml` lists it — wired into
the CI `admin-e2e` job (which has a database), while the `verify` job's databaseless build
must stay green through the degraded path. Browser (Playwright, `.superpowers/sdd`):
`vite preview` serves `/stories/pragya` with the prerendered head; share tags present.

## 9. Docs and conventions

`docs/ARCHITECTURE.md` (build pipeline, SEO modules, freshness loop), `docs/DEPLOYMENT.md`
(`VITE_SITE_URL`, `CF_DEPLOY_HOOK_URL` secret + how to create the hook, preview-deploy curl
checklist: extension-less serving, `/admin` and `/admin/`, `X-Robots-Tag` on every HTML
response, unknown path → SPA fallback, `/gallery.html` → 301), `docs/DATA-MODEL.md`
(`site_publish`, triggers), `docs/COMPONENTS.md` (done for the page/album), `docs/adr/0006-build-time-prerender.md`
(this decision), `docs/KNOWN-ISSUES.md` (`PS-008`/`PS-045` closed, `PS-047` touched,
`_redirects` bug resolved), `docs/ROADMAP.md` (`v0.6`), `README.md` (`npm run prerender`,
`verify:prerender`).

## 10. Owner-facing decisions (defaults chosen; owner may change any in the admin or by asking)

- Wedding pages replace the pop-up album (required by the definition of done).
- Share/title text: `<Wedding title> | Peak Story Studio`; descriptions in `src/data/seo.js`
  mention Lucknow and make no award/press/statistic claims; wedding descriptions come from the
  admin's summary field.
- Structured-data business details are exactly the admin Settings values.
- At deploy time the owner creates the Deploy Hook in Cloudflare and stores its URL as an Edge
  Function secret (runbook step; a single copy-paste).
