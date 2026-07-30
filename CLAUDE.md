# CLAUDE.md

Conventions for any agent session working on Peak Story Studio. Read this before touching code.

## Project

Peak Story Studio is a commercial wedding-photography studio site — a business taking paid
bookings, not a portfolio or demo. Today it is a Vite + React 18 + Tailwind CSS single-page
app with no router, no backend, and no database: all content is static data imported from
`src/data/weddingData.js`, and `src/App.jsx` is the only stateful component of consequence. A
Supabase backend, real inquiries, admin tooling, hosting, SEO, a client portal, and a truthful-
content pass are being added incrementally, one phase per branch — see
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
  `gold` families) — never introduce a new raw hex value in a component. This rule is already
  broken once, and it's a known issue, not a pattern to copy: `SectionDivider` receives
  `color`/`bgColor` as raw hex strings (`#faf9f6`, `#ffffff`) from `src/App.jsx` instead of
  Tailwind classes, even though both values exactly duplicate existing tokens
  (`offwhite-100`, `offwhite-50`). It is tracked as `PS-020` in
  [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md), planned for Phase 3. Do not extend this pattern
  to new call sites, and do not fix it early outside that phase without saying so (per
  "Before changing anything" above) — the same scheduling rule applies to this issue as to
  every other row in that register.
- Components stay presentational. All cross-cutting state (content, session, modal visibility)
  lives in `src/App.jsx` and is passed down as props; a component's own local state should never
  need to escape that component (e.g. `Navbar`'s `scrolled`, `AuthModal`'s form fields). This
  holds until Phase 1 introduces `src/lib/queries/` as the new home for data.
- From Phase 1 onward: components never import the Supabase client directly. Components call
  hooks, hooks call functions in `src/lib/queries/`. Keep data access out of component bodies.

## Commands

- `npm run dev` — Vite dev server at `http://localhost:3000`.
- `npm run build` — production build into `dist/`. **Note:** `dist/` is both committed to git
  and listed in `.gitignore` (`PS-019` in [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md)), so this
  leaves tracked files modified and untracked ignored files behind; clean up with
  `git checkout -- dist/` then `git clean -fx dist/`.
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
seeded template already shipped exactly that — an "AS FEATURED IN" press strip naming Vogue,
Harper's Bazaar, Filmfare, and WedMeGood, a "Vogue Fine Art Choice" badge, and a testimonial
attributed to "Deepika & Ranveer" (the real names of a real married Bollywood couple) — none of
it sourced or substantiated anywhere in the repo. On a live commercial site this is a legal
exposure (false endorsement / false advertising), not a cosmetic issue. It is tracked as
`PS-002` in [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md) and scheduled for removal in Phase 7's
truthful-content pass — do not remove it early outside that phase without saying so (per
"Before changing anything" above), and do not add anything resembling it in the meantime.
