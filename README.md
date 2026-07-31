# Peak Story Studio

Cinematic wedding films and fine-art photography studio website.

## Status

Phase 1b (v0.2b) — backend foundation. The site is a Vite + React single-page app that can read
its content from a local Supabase (Postgres) database — see [Local database](#local-database)
below — or fall back to the static `src/data/weddingData.js` module, which remains the default.
See [docs/ROADMAP.md](docs/ROADMAP.md) for the full phase and version plan.

## Quickstart

```bash
npm install
npm run dev      # http://localhost:3000, opens automatically
```

Requires **Node 20.11 or newer** — `scripts/check-docs.mjs` uses `import.meta.dirname`, which
landed in 20.11. CI runs Node 22.

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
| `npm run db:start` | `supabase start` | Starts the local Supabase stack in Docker. First run pulls several images and takes a few minutes. |
| `npm run db:stop` | `supabase stop` | Stops the local stack. |
| `npm run db:reset` | `supabase db reset` | Drops the local database and replays every migration from empty. This is how a migration is proven complete. |
| `npm run db:seed` | `node scripts/seed-db.mjs` | Copies `src/data/weddingData.js` into Postgres. Idempotent — clears content tables first, so re-running does not duplicate. |
| `npm run db:verify` | `node scripts/verify-db.mjs` | Asserts the Row Level Security policies actually behave. **Not part of `npm test`**, because CI has no Postgres. |
| `npm run db:functions` | `supabase functions serve --env-file supabase/functions/.env.local` | Serves Edge Functions locally, loading secrets from the git-ignored `supabase/functions/.env.local` (copy it from `supabase/functions/.env.example` first). The process never exits on its own — background it and poll, don't run it in the foreground. |

## Local database

Optional: the site runs without it. `VITE_DATA_SOURCE` defaults to `static`, and an
environment with no Supabase credentials stays static regardless.

Docker must be running. Then:

```bash
npm run db:start          # prints API URL, anon key, service_role key
eval "$(supabase status -o env | sed 's/^/export /')"
export SUPABASE_URL="$API_URL" \
       SUPABASE_ANON_KEY="$ANON_KEY" \
       SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
npm run db:seed
npm run db:verify
```

To point the site at the database, put the URL and anon key in `.env.local` (git-ignored)
along with `VITE_DATA_SOURCE=supabase`. See [.env.example](.env.example).

The anon key is meant to be public — it ships in the browser bundle. What constrains it is
Row Level Security in Postgres, which `npm run db:verify` exists to prove. The service-role
key is different: it bypasses RLS entirely and must never reach the browser or a committed file.

## Project layout

```
.
├── src/
│   ├── components/     # All React UI components (Hero, Navbar, galleries, modals, forms, ...)
│   ├── data/
│   │   └── weddingData.js   # Static content: photos, films, testimonials, stories
│   ├── hooks/
│   │   ├── useContent.js       # Hooks components call for content (weddings, photos, films, testimonials)
│   │   └── useScrollReveal.js
│   ├── lib/
│   │   ├── supabase.js         # The only module that constructs a Supabase client
│   │   ├── dataSource.js        # Resolves VITE_DATA_SOURCE to 'static' or 'supabase'
│   │   └── queries/             # Query functions useContent.js's hooks call
│   ├── App.jsx          # Single stateful shell; owns content, session, and modal state
│   ├── main.jsx         # Vite entry point; mounts <App /> into #root
│   └── index.css        # Global styles and Tailwind layer
├── supabase/
│   └── migrations/     # Schema and Row Level Security, replayed by `npm run db:reset`
├── public/
│   └── images/          # Static image assets served as-is
├── docs/                # Architecture, component, data-model, design-system, roadmap,
│                         # known-issues docs, ADRs, and specs (see Documentation below)
└── scripts/
    ├── check-docs.mjs   # Documentation consistency checker (see Scripts above)
    ├── seed-db.mjs      # Copies src/data/weddingData.js into Postgres
    └── verify-db.mjs    # Asserts the RLS policies actually behave
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
- **Supabase** (`@supabase/supabase-js`) — optional local Postgres backend and Row Level Security,
  added in Phase 1b; see [Local database](#local-database) above. The static
  `src/data/weddingData.js` module remains the default data source.

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

Never commit `.env.local` — it is gitignored. The variables it defines are Supabase project
credentials and `VITE_DATA_SOURCE`, the data-source switch described in
[Local database](#local-database) above. An environment with no Supabase credentials configured
stays on the static `src/data/weddingData.js` module regardless of what `VITE_DATA_SOURCE` says.

## Deployment

Not yet deployed. Per [docs/ROADMAP.md](docs/ROADMAP.md), the site first deploys to
**Cloudflare Pages** in Phase 4, and moves to a custom studio domain in Phase 7. The choice of
host was deliberate, not a default — see
[docs/adr/0003-cloudflare-pages-hosting.md](docs/adr/0003-cloudflare-pages-hosting.md) for the
full comparison against the alternatives that were considered and rejected.
