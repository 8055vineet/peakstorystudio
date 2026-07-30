# Roadmap

This is the phase and version roadmap for turning Peak Story Studio from a static frontend
into a working commercial website. It reproduces the table from section 3 of
[the end-to-end platform design spec](superpowers/specs/2026-07-30-end-to-end-platform-design.md);
that document is the source of truth for the rationale behind the ordering, the platform
choices, and the constraints — this page only tracks the plan and where things currently stand.

Each phase is its own branch, reviewed and merged, then tagged. No phase boundary is crossed
with work half-finished.

## Current position

**Phase 0 — Documentation baseline** is complete, tagged `v0.1`.

## Phase and version table

| Version | Phase | Deliverable | Definition of done | Runs on |
| --- | --- | --- | --- | --- |
| **v0.1** | 0 — Documentation baseline | Document the frontend as it exists. No behaviour changes. | A new engineer can run and understand the app from the docs alone | local |
| **v0.2a** | 1a — Quality foundation | Real ESLint and a Vitest suite; an error boundary around the app; the PS-006 Rules-of-Hooks fix in `LightboxModal`/`StoryDetailModal` | `npm run lint` and `npm test` are meaningful gates; a render throw shows a recovery screen instead of a blank page | local |
| **v0.2b** | 1b — Backend foundation | Local Supabase, schema, migrations, content moved to Postgres, data-access layer | App renders identically but from the database; static fallback still works | local |
| **v0.2** | 1 — Quality and backend foundation | Umbrella tag for Phase 1 as a whole, reached once both 1a and 1b have merged | Combines the 1a and 1b deliverables and definitions of done above | local |
| **v0.3** | 2 — Inquiries real | Booking form persists; Edge Function emails studio and couple; `wa.me` button; spam protection | A submitted inquiry is in the database, in the studio inbox, and acknowledged to the couple | local |
| **v0.4** | 3 — Admin: auth, CMS, media | Supabase Auth for admin; real CRUD; image uploads; leads dashboard | A wedding can be added and photos uploaded with no code edit and no `localStorage` | local |
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
