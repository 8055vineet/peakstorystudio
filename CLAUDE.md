# CLAUDE.md

Conventions for any agent session working on Peak Story Studio. Read this before touching code.

## Project

Peak Story Studio is a commercial wedding-photography studio site — a business taking paid
bookings, not a portfolio or demo. Today it is a Vite + React 18 + Tailwind CSS app routed
with react-router-dom v6 (since Phase 3b, `v0.4b`): six pages — `/`, `/gallery`, `/films`,
`/stories`, `/about`, `/contact` — sharing one header/footer frame (`src/components/Layout.jsx`),
each page in `src/pages/` a thin composition over the section components, styled to the
owner's approved quiet design (Cormorant Garamond headings, cream surfaces, the `pitch` maroon
accents; the contact details in `src/data/contact.js` are the studio's real, owner-confirmed
ones). Since Phase 1b (`v0.2b`) it also has a local Supabase backend: a Postgres database in
`supabase/migrations/`, Row Level Security, and a data-access layer (`src/lib/queries/`,
`src/hooks/`) that components call through. As of Phase 3, that database is unconditionally
authoritative — there is no more `VITE_DATA_SOURCE` switch. The static
`src/data/weddingData.js` module still exists, but only as the error fallback
`src/hooks/useContent.js` renders when a query fails, not as a second, selectable source; see
[docs/DATA-MODEL.md](docs/DATA-MODEL.md) for the full shape of both. `src/App.jsx` remains the
only stateful component of consequence — it owns session and modal state and renders the route
table. Hosting, SEO, a client portal, and the rest of the truthful-content pass are being
added incrementally, one phase per branch — see
[docs/ROADMAP.md](docs/ROADMAP.md) for the phase table and
[docs/superpowers/specs/2026-07-30-end-to-end-platform-design.md](docs/superpowers/specs/2026-07-30-end-to-end-platform-design.md)
for the full design and rationale behind that ordering.

## Before changing anything

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (render flow, state ownership, styling
approach) and [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md) (every open issue, its severity, and
the phase it is planned to close in) before making changes. Known issues are scheduled
deliberately — a `PS-###` row is not an invitation to fix it early. If a task requires touching
code near a known issue outside its planned phase, say so explicitly (in the commit message or
task notes) rather than silently fixing or silently working around it.

## Conventions

- Plain JavaScript with `.jsx` for components. No TypeScript, and none is planned — it is on
  the spec's explicit out-of-scope list.
- Style with Tailwind utility classes written inline on JSX elements. Only add to
  `src/index.css` for what utilities genuinely cannot express (keyframe animations, the
  paper-grain overlay, scrollbar styling, and similar). Don't reach for `src/index.css` for
  anything a utility class already covers.
- Use the existing palette tokens from `tailwind.config.js` (`offwhite`, `pitch`, `charcoal`,
  `gold` families) — never introduce a new raw hex value in a component. As of Phase 3b no
  public component violates this: the one standing violation (`SectionDivider`'s raw hex
  props, `PS-020`) was closed when the redesign deleted that component. `gold-*` and
  `font-cinzel` are now admin-only (`src/admin/`) — do not reintroduce either into
  `src/components/` or `src/pages/`; the public type roles are `font-garamond` (headings),
  `font-script` (the Home quote only), and `font-sans` (body).
- Components stay presentational. Session and modal-visibility state lives in `src/App.jsx` and
  is passed down as props; a component's own local state should never need to escape that
  component (e.g. `Navbar`'s `scrolled`, `AuthModal`'s form fields).
- **Components never import the Supabase client.** Components call hooks, hooks call functions
  in `src/lib/queries/`, and only `src/lib/supabase.js` constructs a client. Keep data access
  out of component bodies. This is what confines a future API or framework change to one layer.
- **Schema changes go only in `supabase/migrations/`.** Never edit a running database to fix a
  migration — `npm run db:reset` replaying from empty is what proves the migration is complete,
  and it is the only thing keeping local and hosted reproducible from the same files.
- Content sections must tolerate an empty list. `Testimonials` indexes rather than maps, so an
  empty array once threw and the root `ErrorBoundary` blanked the whole page; it now guards.
  Any new section that indexes into its data needs the same guard, because once content is
  database-driven an unpublished collection is a normal state, not an impossible one.

## Commands

- `npm run dev` — Vite dev server at `http://localhost:3000`.
- `npm run build` — production build into `dist/`. `dist/` is untracked and gitignored as of
  Phase 4 (`PS-019`, resolved — Cloudflare Pages builds from source), so a build leaves the
  working tree clean and needs no cleanup afterwards.
- `npm run check:docs` — verifies required docs exist, every component in `src/components` is
  documented in `docs/COMPONENTS.md`, every `src/...` path cited in a doc actually exists, and
  every relative markdown link resolves. Run this after any change that touches components or
  docs.
- `npm run lint` — runs ESLint (`eslint .`), including `eslint-plugin-react-hooks`. Treat a clean
  run as a real style and correctness check; it exits non-zero on any error. The two current
  `react-hooks/exhaustive-deps` warnings in `src/hooks/useScrollReveal.js` are tracked as
  `PS-021` (planned Phase 3) and do not fail the run — do not silence them with a rule
  disable to make the output look cleaner.
- `npm test` — runs the Vitest suite once (`vitest run`); this is what CI runs. Use
  `npm run test:watch` (`vitest`) for local development.

## Documentation duties

`npm run check:docs` enforces documentation accuracy mechanically and runs in CI on every push
and pull request, alongside `npm run lint`, `npm test`, and `npm run build` — see
[.github/workflows/ci.yml](.github/workflows/ci.yml). Any change that adds, removes, or renames a
component in `src/components` must update [docs/COMPONENTS.md](docs/COMPONENTS.md) in the same
change — the harness fails the build otherwise. The same check also fails on a source path cited
in a doc that no longer exists, or a relative markdown link that no longer resolves, so update the
relevant doc whenever a change moves or removes something another doc points at.

## Git

- Conventional Commits for every commit message (`feat:`, `fix:`, `docs:`, `chore:`, etc.).
- One branch per phase, named `phase-N/<slug>` (e.g. `phase-0/documentation-baseline`,
  `phase-1/backend-foundation`). Never commit to `main` directly.
- Tag at phase completion using the version from the roadmap table (`v0.1`, `v0.2`, ... `v1.0`).

## Content integrity

Standing rule, not phase-scoped: never add fabricated press credentials, awards, statistics, or
testimonials attributed to real people, anywhere in this codebase. This exists because the
seeded template shipped exactly that — an "AS FEATURED IN" press strip naming Vogue,
Harper's Bazaar, Filmfare, and WedMeGood, a "Vogue Fine Art Choice" badge, invented "1,000+
weddings / 40+ destinations" statistics, and a testimonial attributed to "Deepika & Ranveer"
(the real names of a real married Bollywood couple) — none of it sourced or substantiated
anywhere in the repo. On a live commercial site this is a legal exposure (false endorsement /
false advertising), not a cosmetic issue. Phase 3b's redesign removed everything that
*rendered* those claims, at the owner's direction; what remains of `PS-002` (see
[docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md)) is the celebrity testimonial in
`src/data/weddingData.js`'s outage fallback and in the seeded database row, scheduled for
Phase 7's truthful-content pass. Do not add anything resembling any of it in the meantime.
