# Peak Story Studio

Cinematic wedding films and fine-art photography studio website.

## Status

Phase 3 (v0.4) — admin: auth, CMS, media. The public site is a Vite + React single-page app whose
content is unconditionally read from a local Supabase (Postgres) database — see
[Local database](#local-database) below; the static `src/data/weddingData.js` module survives only
as the error fallback rendered when a query fails, not a second source anything can select. A
separate, sign-in-gated admin app (`admin.html`) manages that content and the studio's booking
inquiries — see [Running the admin locally](#running-the-admin-locally) below. See
[docs/ROADMAP.md](docs/ROADMAP.md) for the full phase and version plan.

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
| `npm run db:seed-admin` | `node scripts/seed-admin.mjs` | Creates (or repairs) the local studio admin account: an `auth.users` row and a `public.profiles` row with `role = 'admin'`, from `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Idempotent and safe to re-run after `npm run db:reset` — see [Running the admin locally](#running-the-admin-locally) below. |
| `npm run db:verify` | `node scripts/verify-db.mjs` | Asserts the Row Level Security policies actually behave. **Not part of `npm test`**, because CI has no Postgres. |
| `npm run db:functions` | `supabase functions serve --env-file supabase/functions/.env.local` | Serves Edge Functions locally, loading secrets from the git-ignored `supabase/functions/.env.local` (copy it from `supabase/functions/.env.example` first). The process never exits on its own — background it and poll, don't run it in the foreground. Restart it after editing a function or its `.env.local`; neither reliably hot-reloads. |
| `npm run verify:inquiry` | `node scripts/verify-inquiry.mjs` | End-to-end gate for the booking pipeline: posts real requests at the running `submit-inquiry` function and asserts against Postgres directly, because a 200 response is not evidence a row landed. Requires the database and the function server both running — see [Running the inquiry pipeline locally](#running-the-inquiry-pipeline-locally) below. |
| `npm run verify:admin` | `vite-node scripts/verify-admin.mjs` | End-to-end gate for the admin publishing pipeline: signs in, uploads a real file through `sign-upload`, creates and publishes a wedding, then reads it back through `src/lib/queries/weddings.js` — the exact module the public site calls — and asserts every field against Postgres directly. Requires the database, the Edge Functions, and the `media` storage bucket — see [Running the admin locally](#running-the-admin-locally) below. Runs under `vite-node`, not plain `node`, because it imports a module that reads `import.meta.env`. |

## Local database

As of Phase 3, the database is unconditionally authoritative — there is no more
`VITE_DATA_SOURCE` switch. An environment with no Supabase credentials configured still doesn't
crash: `src/hooks/useContent.js` renders the static `src/data/weddingData.js` module as an error
fallback when its query fails, the same way it does on any other database outage.

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

To point the site at the database, put the URL and anon key in `.env.local` (git-ignored).
See [.env.example](.env.example).

The anon key is meant to be public — it ships in the browser bundle. What constrains it is
Row Level Security in Postgres, which `npm run db:verify` exists to prove. The service-role
key is different: it bypasses RLS entirely and must never reach the browser or a committed file.

## Running the inquiry pipeline locally

Since Phase 2 (`v0.3`), the booking form on `#contact` is a real write path, not a static form.
Making a submission actually land in the database and, past this local setup, in an inbox
takes three processes and two environment files:

```bash
npm run db:start                                    # local Supabase, once per session
cp .env.example .env.local                           # browser: Supabase creds, Turnstile site key
cp supabase/functions/.env.example supabase/functions/.env.local   # function: Turnstile secret, rate-limit salt
```

Fill in `.env.local`'s `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from
`supabase status -o env` (see [Local database](#local-database) above). Both `.env.example`
files ship Cloudflare's published Turnstile test keys, so the captcha works out of the box with
no Cloudflare account.

In a second terminal, serve the Edge Function (it never exits on its own — background it):

```bash
npm run db:functions
```

Then, in a third terminal:

```bash
npm run dev
```

Open `http://localhost:3000/#contact` and submit the form. **Resend is unconfigured locally**
(`RESEND_API_KEY` is blank in `supabase/functions/.env.example`), so no email is actually sent;
the function detects this itself and records `notification_status='skipped'` on the row rather
than treating a missing mail provider as a failed inquiry — the lead is still saved either way.

To check the whole path end to end without a browser — the same check CI runs — with the
database and function server both up:

```bash
eval "$(supabase status -o env | sed 's/^/export /')"
export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
npm run verify:inquiry
```

## Running the admin locally

Since Phase 3 (`v0.4`), a separate admin app manages booking inquiries and every piece of site
content (weddings and their photographs, the standalone gallery, films, testimonials) — see
[The admin app](docs/ARCHITECTURE.md#the-admin-app) for how it's put together. It needs everything
[Running the inquiry pipeline locally](#running-the-inquiry-pipeline-locally) above sets up, plus
an admin account and a storage bucket for uploaded photographs.

```bash
npm run db:start                                                   # once per session
npm run db:reset                                                   # fresh schema — safe to skip if already reset
eval "$(supabase status -o env | sed 's/^/export /')"
export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
npm run db:seed
```

**Create the admin account.** `ADMIN_EMAIL`/`ADMIN_PASSWORD` are read only by
`scripts/seed-admin.mjs` itself — export them in the shell alongside the credentials above, never
write them to any file, committed or not (see the comment in [.env.example](.env.example)):

```bash
export ADMIN_EMAIL="admin@example.test" ADMIN_PASSWORD="local-dev-password"
npm run db:seed-admin
```

Idempotent, and safe to re-run after another `npm run db:reset` — a fresh schema always leaves an
admin behind rather than locking the next person out.

**Create the storage bucket.** `sign-upload` presigns uploads against a bucket named `media`,
which `supabase start` does not create for you:

```bash
curl -sf --max-time 10 -X POST "$API_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"media","name":"media","public":false}'
```

Private (`"public":false`) is deliberate — see
[The upload flow](docs/ARCHITECTURE.md#the-upload-flow) for why that means an uploaded photograph
does not yet render on the public site.

**Configure `sign-upload`'s storage secrets.** One code path signs against both local Supabase
storage and Cloudflare R2 (see
[One S3 code path](docs/ARCHITECTURE.md#one-s3-code-path-local-storage-and-cloudflare-r2-alike));
locally it points at the S3-compatible endpoint `supabase start` already exposes:

```bash
cp supabase/functions/.env.example supabase/functions/.env.local
```

Then fill in `supabase/functions/.env.local`'s `S3_ENDPOINT`/`S3_REGION`/`S3_ACCESS_KEY_ID`/
`S3_SECRET_ACCESS_KEY` from `supabase status -o env`'s `STORAGE_S3_URL`/`S3_PROTOCOL_REGION`/
`S3_PROTOCOL_ACCESS_KEY_ID`/`S3_PROTOCOL_ACCESS_KEY_SECRET` (exactly, not the container-internal
host — see that file's own comment for why), and set `S3_BUCKET=media`. The file's own comment
gives the exact mapping.

In a second terminal, serve the Edge Functions (never exits on its own — background it, and
restart it after any edit to a function or to `.env.local`, since neither reliably hot-reloads):

```bash
npm run db:functions
```

Then, in a third terminal:

```bash
npm run dev
```

**Sign in.** Open `http://localhost:3000/admin.html` and sign in with the `ADMIN_EMAIL`/
`ADMIN_PASSWORD` you seeded above. From there: the Leads tab works every booking inquiry
end to end (see [Running the inquiry pipeline locally](#running-the-inquiry-pipeline-locally)
above for how to create one to work); the Media Library, Weddings, Gallery, Films, and
Testimonials tabs manage content, with uploads going through the pipeline described in
[The upload flow](docs/ARCHITECTURE.md#the-upload-flow).

To check the whole publishing pipeline end to end without a browser — the same check CI
runs — with the database, the Edge Functions, and the storage bucket all up:

```bash
eval "$(supabase status -o env | sed 's/^/export /')"
export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export VITE_MEDIA_BASE_URL="$API_URL/storage/v1/object/public/media"
npm run verify:admin
```

`VITE_MEDIA_BASE_URL` is read by `src/lib/mediaUrl.js` — see
[Environment](#environment) below — and without it, `scripts/verify-admin.mjs`'s check that an
uploaded photo's `storage_path` resolves to a real URL passes vacuously (both the expected and
actual values collapse to the same empty string) instead of proving anything. The value above is
shaped like a real Supabase Storage public-object URL; it does not need to actually serve the
file, since the local bucket stays private (see [The upload flow](docs/ARCHITECTURE.md#the-upload-flow)) —
only the resolution logic is under test here.

## Project layout

```
.
├── admin.html           # Second Vite entry point — the studio admin (see src/admin/ below)
├── index.html           # Public-site Vite entry
├── src/
│   ├── components/     # All React UI components (Hero, Navbar, galleries, modals, forms, ...)
│   ├── admin/           # The admin app's own components (Phase 3) — never imported by src/components
│   │   └── resources/       # Per-content-type field configs (weddings, gallery, films, testimonials)
│   ├── data/
│   │   └── weddingData.js   # Static content: photos, films, testimonials, stories; also the
│   │                         # error fallback useContent.js renders on a failed query
│   ├── hooks/
│   │   ├── useContent.js       # Hooks components call for content (weddings, photos, films, testimonials)
│   │   ├── useSession.js        # Admin auth state: loading | anonymous | authenticated | forbidden
│   │   ├── useMediaUpload.js    # Drives the four-stage upload pipeline (resize/sign/PUT/record)
│   │   ├── useResource.js       # Generic list/mutate hook the admin's five content dashboards share
│   │   └── useScrollReveal.js
│   ├── lib/
│   │   ├── supabase.js         # The only module that constructs a Supabase client
│   │   ├── auth.js              # signIn/signOut/getSession/getProfile — no access decisions made here
│   │   └── queries/             # Query functions useContent.js's/the admin's hooks call
│   ├── App.jsx          # Public site's single stateful shell; owns content, session, and modal state
│   ├── main.jsx         # Public-site Vite entry point; mounts <App /> into #root
│   └── index.css        # Global styles and Tailwind layer, shared by both apps
├── supabase/
│   ├── migrations/     # Schema and Row Level Security, replayed by `npm run db:reset`
│   └── functions/      # Edge Functions: submit-inquiry, sign-upload, and _shared/ code both use
├── public/
│   └── images/          # Static image assets served as-is
├── docs/                # Architecture, component, data-model, design-system, roadmap,
│                         # known-issues docs, ADRs, and specs (see Documentation below)
└── scripts/
    ├── check-docs.mjs      # Documentation consistency checker (see Scripts above)
    ├── seed-db.mjs         # Copies src/data/weddingData.js into Postgres
    ├── seed-admin.mjs      # Creates/repairs the local admin account (see Scripts above)
    ├── verify-db.mjs       # Asserts the RLS policies actually behave
    ├── verify-inquiry.mjs  # End-to-end gate for the booking pipeline (see Scripts above)
    └── verify-admin.mjs    # End-to-end gate for the admin publishing pipeline (see Scripts above)
```

There is no router on the public site — it is one page, and "navigation" is anchor-link scrolling
within it. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full render flow and state
ownership.

## Tech stack

- **React 18.2** — component tree; `src/App.jsx` owns the public site's state, `src/admin/App.jsx`
  owns the admin's
- **Vite 5** — dev server and build tooling; two entries (`index.html`, `admin.html`) build two
  separate bundles — see [The admin app](docs/ARCHITECTURE.md#the-admin-app)
- **Tailwind CSS 3.4** — styling, configured in `tailwind.config.js`, shared by both apps
- **lucide-react** — icon set used throughout the UI
- **canvas-confetti** — fires a confetti effect on booking form submission
- **Google Fonts** — Cinzel, Cormorant Garamond, and Plus Jakarta Sans, loaded via `<link>` tags
  in `index.html`
- **Supabase** (`@supabase/supabase-js`) — Postgres, Row Level Security, Auth (admin sign-in,
  public signup disabled), and Edge Functions; the database is unconditionally authoritative for
  content as of Phase 3 — see [Local database](#local-database) above. The static
  `src/data/weddingData.js` module survives only as `useContent`'s error fallback.
- **aws4fetch** — signs presigned S3 `PUT` URLs in the `sign-upload` Edge Function; the same code
  path targets local Supabase Storage in development and is intended for Cloudflare R2 in
  production (Phase 4) — see
  [One S3 code path](docs/ARCHITECTURE.md#one-s3-code-path-local-storage-and-cloudflare-r2-alike).

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — render flow, state ownership, how the app is put together
- [docs/COMPONENTS.md](docs/COMPONENTS.md) — every component, its props, and its responsibilities
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — the database schema, how content and media get into
  it, and the static content in `src/data/weddingData.js` that survives only as an error fallback
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
credentials, Cloudflare Turnstile keys, the WhatsApp click-to-chat number, and (optionally)
`VITE_MEDIA_BASE_URL` — read by `src/lib/mediaUrl.js` for both the admin's own media previews
*and* the public site's own query layer, which is what this variable's blast radius actually is
once it's set; see
[Running the admin locally](#running-the-admin-locally) above and
[The upload flow](docs/ARCHITECTURE.md#the-upload-flow). There is no data-source switch to set: an environment
with no Supabase credentials configured still renders the static `src/data/weddingData.js`
module, but only as the error fallback `src/hooks/useContent.js` falls back to when its query to
an unconfigured client fails, not as a second mode a variable selects.

**Two more credentials are deliberately *not* set in any file, including `.env.local`:**
`ADMIN_EMAIL`/`ADMIN_PASSWORD` (read only by `scripts/seed-admin.mjs`) and
`SUPABASE_SERVICE_ROLE_KEY` (read by that script and by `sign-upload`'s server-side environment,
never by the browser). Both are exported directly in the shell before running the script that
needs them — see [Running the admin locally](#running-the-admin-locally) above and the comment in
[.env.example](.env.example) — because a service-role key bypasses Row Level Security entirely and
must never reach a committed file or a `VITE_`-prefixed variable, which ships in the browser
bundle.

## Deployment

Not yet deployed. Per [docs/ROADMAP.md](docs/ROADMAP.md), the site first deploys to
**Cloudflare Pages** in Phase 4, and moves to a custom studio domain in Phase 7. The choice of
host was deliberate, not a default — see
[docs/adr/0003-cloudflare-pages-hosting.md](docs/adr/0003-cloudflare-pages-hosting.md) for the
full comparison against the alternatives that were considered and rejected.
