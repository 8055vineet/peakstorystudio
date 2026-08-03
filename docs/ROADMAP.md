# Roadmap

This is the phase and version roadmap for turning Peak Story Studio from a static frontend
into a working commercial website. It reproduces the table from section 3 of
[the end-to-end platform design spec](superpowers/specs/2026-07-30-end-to-end-platform-design.md);
that document is the source of truth for the rationale behind the ordering, the platform
choices, and the constraints — this page only tracks the plan and where things currently stand.

Each phase is its own branch, reviewed and merged, then tagged. No phase boundary is crossed
with work half-finished.

## Current position

**Phase 1a — Quality foundation**, **Phase 1b — Backend foundation**, **Phase 2 — Inquiries
real**, and **Phase 3 — Admin: auth, CMS, media** are complete, tagged `v0.2a`, `v0.2b`, `v0.3`,
and `v0.4` respectively. A submitted booking inquiry reaches Postgres through a dedicated Edge
Function, protected by Turnstile and a per-visitor rate limit, and is acknowledged to the couple
and the studio by email — `npm run verify:inquiry` proves the whole path end to end against a
real database, and the same check runs in CI.

Phase 3 added a studio-only admin (`admin.html`, a separate Vite entry with no shared bundle with
the public site) behind Supabase Auth: a leads dashboard over `inquiries`, image upload to
S3-compatible object storage, and full CRUD — create, edit, publish/unpublish, reorder, delete —
over weddings and their photographs, the standalone gallery, films, and testimonials, all writing
straight to Postgres with no `localStorage` involved anywhere. See
[The admin app](ARCHITECTURE.md#the-admin-app) in `docs/ARCHITECTURE.md` for how it is put
together, and `docs/KNOWN-ISSUES.md` for what it deliberately left open (`PS-029`–`PS-033`) —
most notably that a genuinely uploaded photograph does not yet render on the public site, because
public read access to the storage bucket is Phase 4 scope, not this one's. `npm run verify:admin`
proves the publishing pipeline end to end — sign in, upload, publish, then read the result back
through the exact query layer the public site calls — and the same check runs in CI alongside
`verify:inquiry`.

**Phase 3b — Multi-page redesign** (`v0.4b`) was not in the original table; it was inserted at
the owner's request, using the same a/b convention as Phase 1, when they supplied the design
for the site they actually want: separate pages per navbar option and a new, quieter visual
language. The public site is now routed with React Router v6 (`/`, `/gallery`, `/films`,
`/stories`, `/about`, `/contact`), restyled to the owner's approved Home design, and carries
the studio's **real, owner-confirmed contact details** (Lucknow — this closed `PS-028`). Ten
single-page-era components were deleted, closing `PS-013`, `PS-020`, and `PS-023` by removal.
Two scheduled items arrived early, deliberately: the routing *mechanism* from Phase 5 (whose
remaining scope — per-wedding URLs, prerendering, sitemap, OG images, structured data — stays
in Phase 5), and part of Phase 7's truthful-content pass (`PS-002` is narrowed: the fabricated
press strip, badge, and statistics no longer render anywhere; the seeded celebrity testimonial
remains until the owner replaces it through the admin). See the
[Phase 3b design spec](superpowers/specs/2026-08-03-multi-page-redesign-design.md) for the
full decisions.

**Phase 3c — Admin CMS completion** (`v0.4c`) finished the owner's ask that the admin edit
*everything*: a one-row `site_settings` table (quote, Brand Story, the three Home images,
contact, socials) behind a new Settings tab, read live by the public site with the shipped
constants as the outage fallback; a Dashboard landing tab (counts, new-lead callout); an
Add-to-Gallery flow from the Media Library; a publish-now banner after every draft-first
create; and a View-website header link. `npm run verify:admin` now also proves a settings
edit round-trips to the public read path. See the
[Phase 3c design spec](superpowers/specs/2026-08-04-admin-cms-settings-design.md).

## Phase and version table

| Version | Phase | Deliverable | Definition of done | Runs on |
| --- | --- | --- | --- | --- |
| **v0.1** | 0 — Documentation baseline | Document the frontend as it exists. No behaviour changes. | A new engineer can run and understand the app from the docs alone | local |
| **v0.2a** | 1a — Quality foundation | Real ESLint and a Vitest suite; an error boundary around the app; the PS-006 Rules-of-Hooks fix in `LightboxModal`/`StoryDetailModal` | `npm run lint` and `npm test` are meaningful gates; a render throw shows a recovery screen instead of a blank page | local |
| **v0.2b** | 1b — Backend foundation | Local Supabase, schema, migrations, content moved to Postgres, data-access layer | App renders identically but from the database; static fallback still works | local |
| **v0.2** | 1 — Quality and backend foundation | Umbrella tag for Phase 1 as a whole, reached once both 1a and 1b have merged | Combines the 1a and 1b deliverables and definitions of done above | local |
| **v0.3** | 2 — Inquiries real | Booking form persists; Edge Function emails studio and couple; `wa.me` button; spam protection | A submitted inquiry is in the database, in the studio inbox, and acknowledged to the couple | local |
| **v0.4** | 3 — Admin: auth, CMS, media | Supabase Auth for admin; real CRUD; image uploads; leads dashboard | A wedding can be added and photos uploaded with no code edit and no `localStorage` | local |
| **v0.4b** | 3b — Multi-page redesign | React Router pages per navbar option; full restyle to the owner's approved design; real Lucknow contact details | Each nav option is its own URL; no fabricated press/stat claims rendered by any component; suite green | local |
| **v0.4c** | 3c — Admin CMS completion | `site_settings` table; Settings + Dashboard tabs; add-to-gallery; draft-state clarity | Every visitor-visible word and image is editable from the admin with no code change | local |
| **v0.5** | 4 — First deploy | Hosted Supabase project; Cloudflare Pages deploy; CI/CD; preview deploys | Site reachable on `*.pages.dev`, `noindex` set, deploys on merge | Cloudflare Pages |
| **v0.6** | 5 — SEO and shareable pages | Routing, per-wedding URLs, prerendering, sitemap, OG images, structured data | Every wedding has its own indexable, shareable URL | Cloudflare Pages |
| **v0.7** | 6 — Client proofing portal | Per-client galleries, magic-link auth, persisted favourites, high-res downloads | A couple signs in and sees only their own photographs | Cloudflare Pages |
| **v1.0** | 7 — Domain cutover and go-live | Truthful-content pass, domain, DNS, SSL, backups, privacy policy, analytics, monitoring, performance and accessibility pass; `noindex` removed | Site live on the studio domain, monitored, backed up, nothing fabricated | studio domain |

Hosting is **Cloudflare Pages**. See the
[Decisions section of the spec](superpowers/specs/2026-07-30-end-to-end-platform-design.md#2-decisions)
for the full rationale and the rejected alternatives; the choice is also recorded as an ADR
(`docs/adr/0003-cloudflare-pages-hosting.md`).

For why the phases are ordered this way — including why inquiries (Phase 2) precede admin
tooling (Phase 3), why deployment (Phase 4) precedes SEO (Phase 5), and why the client portal
(Phase 6) is deliberately last — see the
[Ordering rationale](superpowers/specs/2026-07-30-end-to-end-platform-design.md#ordering-rationale)
and [Domain timing](superpowers/specs/2026-07-30-end-to-end-platform-design.md#domain-timing)
sections of the spec.

## Where open issues fit in

[`KNOWN-ISSUES.md`](KNOWN-ISSUES.md) lists every currently open issue with the phase in which
it is planned to be closed. Phases 1 through 2 are specified in full detail in the linked spec;
phases 3 through 7 are deliberately sketched rather than specified — each gets its own spec at
the time it starts, once the preceding phases have produced the information (real image sizes,
measured search performance, and so on) that those decisions depend on.
