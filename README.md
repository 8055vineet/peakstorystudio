# Peak Story Studio

Cinematic wedding films and fine-art photography studio website.

## Status

Phase 0 (v0.1) — documentation baseline. This repository is currently a frontend-only static
site: there is no backend, no database, and no server-side code of any kind. See
[docs/ROADMAP.md](docs/ROADMAP.md) for the full phase and version plan.

## Quickstart

```bash
npm install
npm run dev      # http://localhost:3000, opens automatically
```

Requires **Node 20.11 or newer** — `scripts/check-docs.mjs` uses `import.meta.dirname`, which
was added in that Node release, so an older Node will fail on `npm run check:docs`.

## Scripts

| Script | Command | What it does |
| --- | --- | --- |
| `npm run dev` | `vite` | Starts the Vite dev server at `http://localhost:3000` with hot reload. |
| `npm run build` | `vite build` | Produces a production build in `dist/`. **Note:** `dist/` is both committed to git and listed in `.gitignore` (`PS-019` in [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md)), so running this leaves tracked files modified and untracked ignored files behind; clean up with `git checkout -- dist/` then `git clean -fx dist/`. |
| `npm run preview` | `vite preview` | Serves the built `dist/` output locally to sanity-check a production build. |
| `npm run lint` | `eslint .` | Runs ESLint, including `eslint-plugin-react-hooks`, over the codebase. Exits non-zero on any error; the two current `react-hooks/exhaustive-deps` warnings (tracked as `PS-021`) do not fail the run. |
| `npm test` | `vitest run` | Runs the Vitest suite once and exits. This is what CI runs. |
| `npm run test:watch` | `vitest` | Runs the Vitest suite in watch mode for local development. |
| `npm run check:docs` | `node scripts/check-docs.mjs` | Verifies the docs stay consistent with the codebase: required docs exist, every component is documented, cited source paths exist, and every relative markdown link resolves. |

## Project layout

```
.
├── src/
│   ├── components/     # All React UI components (Hero, Navbar, galleries, modals, forms, ...)
│   ├── data/
│   │   └── weddingData.js   # Static content: photos, films, testimonials, stories
│   ├── hooks/
│   │   └── useScrollReveal.js
│   ├── App.jsx          # Single stateful shell; owns content, session, and modal state
│   ├── main.jsx         # Vite entry point; mounts <App /> into #root
│   └── index.css        # Global styles and Tailwind layer
├── public/
│   └── images/          # Static image assets served as-is
├── docs/                # Architecture, component, data-model, design-system, roadmap,
│                         # known-issues docs, ADRs, and specs (see Documentation below)
└── scripts/
    └── check-docs.mjs   # Documentation consistency checker (see Scripts above)
```

There is no router — the entire site is one page, and "navigation" is anchor-link scrolling
within it. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full render flow and state
ownership.

## Tech stack

- **React 18.2** — component tree, all state owned by `src/App.jsx`
- **Vite 5** — dev server and build tooling
- **Tailwind CSS 3.4** — styling, configured in `tailwind.config.js`
- **lucide-react** — icon set used throughout the UI
- **canvas-confetti** — fires a confetti effect on booking form submission
- **Google Fonts** — Cinzel, Cormorant Garamond, and Plus Jakarta Sans, loaded via `<link>` tags
  in `index.html`

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — render flow, state ownership, how the app is put together
- [docs/COMPONENTS.md](docs/COMPONENTS.md) — every component, its props, and its responsibilities
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — shape of the static content in `src/data/weddingData.js`
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) — palette, type scale, and dead-style inventory
- [docs/ROADMAP.md](docs/ROADMAP.md) — phase and version plan from v0.1 through v1.0
- [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md) — open issue register, including legal-risk and
  security items and the phase each is planned to close in
- [docs/adr/](docs/adr/) — architecture decision records (backend, hosting, framework, client
  state choices)
- [docs/superpowers/specs/2026-07-30-end-to-end-platform-design.md](docs/superpowers/specs/2026-07-30-end-to-end-platform-design.md) —
  the end-to-end platform design spec that the roadmap and ADRs are drawn from

## Environment

Copy `.env.example` to `.env.local` and fill in values there:

```bash
cp .env.example .env.local
```

Never commit `.env.local` — it is gitignored. The variables it defines (Supabase project
credentials and a data-source switch) are unused by the app until Phase 1; today the app reads
all content from `src/data/weddingData.js` regardless of what `.env.local` contains.

## Deployment

Not yet deployed. Per [docs/ROADMAP.md](docs/ROADMAP.md), the site first deploys to
**Cloudflare Pages** in Phase 4, and moves to a custom studio domain in Phase 7. The choice of
host was deliberate, not a default — see
[docs/adr/0003-cloudflare-pages-hosting.md](docs/adr/0003-cloudflare-pages-hosting.md) for the
full comparison against the alternatives that were considered and rejected.
