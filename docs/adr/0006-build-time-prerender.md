# 0006. Build-time prerendered heads, not SSR and not an edge function

## Status

Accepted (Phase 5, `v0.6`, 2026-09-08). Resolves the question ADR 0004 deferred to Phase 5.

## Context

The site is a client-rendered Vite SPA on Cloudflare Pages (ADR 0003, ADR 0004). Crawlers and
link unfurlers (WhatsApp, Instagram, Google's first-wave indexer) read the raw HTML, which until
this phase was one `index.html` with one title for every route and no Open Graph tags, so a
shared wedding link showed no card and Google could rank only the home page. The roadmap's
Phase 5 definition of done is "every wedding has its own indexable, shareable URL".

Three architectures were designed independently and scored by three judges (reliability on
Pages' free tier, freshness and burden for a non-technical solo owner, engineering fit with
this repo); the record is in
[the Phase 5 design](../superpowers/specs/2026-09-08-seo-design.md):

1. **Build-time head-only static HTML** — a post-build script writes one flat `dist/<route>.html`
   per public route with a per-route `<head>` and a small visible shell, React still mounts and
   takes over.
2. **Build-time full prerender** with `react-dom/server` and hydration.
3. **Request-time head injection** in a Cloudflare Pages Function with `HTMLRewriter`.

Facts verified against Cloudflare's documentation shaped the choice: flat `foo.html` files are
served extension-less while `foo/index.html` forces a trailing-slash redirect; with no
`404.html` Pages serves the root for unknown paths; `_redirects` rules are followed even when an
asset matches (so the runbook's `/* /index.html 200` catch-all would have broken the first
deploy); `_redirects` and `_headers` do not apply to Function responses; Functions on the free
tier share a daily request quota with Workers; Deploy Hooks are a POST to a secret URL.

## Decision

Option 1. `npm run build` is `vite build` followed by `vite-node scripts/prerender.mjs`, which
fetches published content through the site's own query modules and writes flat per-route HTML
files, `sitemap.xml`, and `build-info.json` into `dist/`. React replaces the shell on mount; no
server rendering, no hydration. Freshness comes from a database dirty flag plus an
admin-authenticated Edge Function that fires a Cloudflare Deploy Hook (the secret lives in the
function's environment, never in git or the browser), with an admin widget showing publish
status and a manual Rebuild-now.

Rejected: option 2, because an automatic rebuild would then depend on every component staying
SSR-safe forever (six public files already touch `window`, `localStorage`, or `Math.random`
during render) and the definition of done does not need a full-body render; option 3, because
it puts a runtime tier and Supabase in front of every visitor, needs a second query layer
outside `src/lib/queries/`, cannot be exercised by the Vitest suite, and sits on an
undocumented quota cliff.

## Consequences

- Share cards and indexable titles work with JavaScript disabled; body content still needs
  Google's JS rendering (acceptable; Google renders it).
- Content is stale for the few minutes between a publish and the rebuild landing; the admin
  shows this state. A wedding shared within that window renders client-side via the SPA
  fallback with a generic card.
- A build failure on Cloudflare leaves the last good deployment live by design; CI's
  databaseless build succeeds through a documented degraded path.
- The build now depends on the hosted database being reachable from Cloudflare's build image.
- 500 builds a month on the free tier bounds how often content can be republished; the
  dispatch floor and the 20-second quiet window in the admin keep bursts to one build.
- `404.html` must never be added, and per-route files must stay flat; both are recorded in the
  spec and enforced by tests.
