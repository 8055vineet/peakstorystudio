# Deployment Runbook — Phase 4, first deploy (`v0.5`)

This is the owner-facing runbook for taking Peak Story Studio from "runs on the studio
laptop" to a live site on the internet. It lists, in order: **what you (the owner) provide**,
**what happens with it**, and **how we prove the deployed site actually works**. Phase 4 still
gets its own design spec when it starts (the project convention); this document is the
stable checklist that spec will bind to, written so the account setup can begin now.

**What Phase 4 delivers** (from [ROADMAP.md](ROADMAP.md)): hosted Supabase project,
Cloudflare Pages deploy, CI/CD with preview deploys — site reachable on a private
`*.pages.dev` URL, hidden from search (`noindex`), redeploying automatically on every merge.
**What it deliberately does not do:** attach the real domain (Phase 7), SEO (Phase 5), the
client portal (Phase 6).

**Cost:** every service below has a free tier that fits this site. The only unavoidable
spend in the whole roadmap is the domain (~₹1,000/year), and that is Phase 7, not now.
One caveat: **Cloudflare R2 requires a payment method on file even inside its free
allowance.** If that is unacceptable, Supabase Storage is the fallback — the upload code
speaks plain S3 to either, so the swap is environment variables, not code.

---

## The shape of what we're deploying

| Piece | Service | Why this one |
| --- | --- | --- |
| Website (public + admin) | **Cloudflare Pages** | Free tier permits commercial use with unlimited bandwidth (Vercel's free tier forbids commercial use; Netlify caps bandwidth) — see `docs/adr/0003-cloudflare-pages-hosting.md` |
| Database, login, functions | **Supabase (hosted)** | Same product the site already runs on locally; migrations replay identically |
| Photograph storage | **Cloudflare R2** (or Supabase Storage) | Zero egress fees at any traffic volume; image-heavy site |
| Inquiry emails | **Resend** | Already what the inquiry function speaks |
| Spam protection | **Cloudflare Turnstile** | Already wired in; local dev runs on its published test keys |

Passwords are never stored by us in any file: Supabase Auth keeps only a bcrypt hash
(`auth.users.encrypted_password`), and the production admin password will be a fresh,
strong one you choose — the local `admin@example.test` account and its documented example
password stay on your laptop and never go to production.

---

## Stage 0 — What you provide

### 0.1 Create three accounts (~20 minutes, all free to open)

- [ ] **Supabase** — <https://supabase.com> → *Start your project* → sign in with your
      GitHub account (the one that owns `8055vineet/peakstorystudio`). Stop after the
      account exists — do **not** create a project yet; that happens in Stage 2 so the
      region and settings are right the first time.
- [ ] **Cloudflare** — <https://dash.cloudflare.com/sign-up>. One account covers Pages
      (hosting), R2 (images), and Turnstile (spam). No domain needed yet.
- [ ] **Resend** — <https://resend.com/signup>. Sign up with
      `peakstorystudio@gmail.com` — this matters: until a real domain is verified
      (Phase 7), Resend can only deliver to the account owner's own address, so using the
      studio Gmail is what lets "new inquiry" notifications reach you from day one.

### 0.2 Make two decisions

- [ ] **Images: R2 or Supabase Storage?** R2 is the plan (better free tier where it
      matters — egress) but needs a card on file. Say "R2" and add the card, or say
      "Supabase Storage" and we configure that instead. Either answer works.
- [ ] **Pages project name** — becomes the private URL, e.g. `peakstorystudio.pages.dev`.
      Recommendation: `peakstorystudio`.

### 0.3 Choose the production admin login (hand over privately)

- [ ] **Admin email** — a real mailbox you control (the studio Gmail is fine).
- [ ] **Admin password** — a long (16+ characters), generated password saved in a
      password manager. It is set at seed time from a terminal environment variable,
      stored only as a bcrypt hash, and never written to any file in this repository.
      Do not reuse the local `local-dev-password` — that string is public documentation.

### 0.4 Optional content (can come later, admin-editable)

- [ ] Instagram URL and YouTube URL (footer icons stay unlinked until set — Settings tab).
- [ ] WhatsApp number confirmation (already in Settings; drives the chat button).
- [ ] The pre-wedding films (the Aastha/Preet/Pritam mp4 files) if you want them hosted.

### 0.5 Hand-off

Once the accounts exist, say so. For each dashboard step you can either do the clicks
yourself with exact guidance, or share the resulting keys for the engineering side to
configure. The keys that will come out of Stages 2–5 and where each one is allowed to
live are listed in the reference table at the bottom — the short version: **four values
are genuinely secret** (Supabase service-role key, Turnstile secret key, R2/S3 secret
key, Resend API key) and belong only in dashboards, never in git.

---

## Stage 1 — Repo preparation (engineering)

Branch `phase-4/first-deploy`, with its own spec first, per convention. The code changes
Phase 4 owns, all small:

1. **Stop tracking `dist/`** — closes `PS-019` in [KNOWN-ISSUES.md](KNOWN-ISSUES.md);
   Pages builds from source, so committed build output loses its last reason to exist.
2. **`noindex` for the whole `pages.dev` site** — a `public/_headers` file sending
   `X-Robots-Tag: noindex` (Phase 7 removes it at domain cutover; `admin.html` keeps its
   own permanent `noindex` meta regardless).
3. **Empty-image guards** (`PS-036`) — `FeaturedStories`, `PhotoGallery`,
   `StoryDetailModal`, `FilmsGallery` get a guard so an unresolvable photograph renders
   nothing instead of a broken-image box.
4. **`/admin` redirect + navbar admin link** (`PS-030`) — a hosting-layer redirect from
   `/admin` to `/admin.html`, and the admin badge in `src/components/Navbar.jsx` finally
   links somewhere.
5. CI stays as is — it self-provisions a local Supabase and uses **no GitHub secrets**;
   deployment adds no CI burden because Pages does its own build on push.

## Stage 2 — Hosted Supabase project (engineering, with your login)

1. Create the project: name `peak-story-studio`, Postgres **17** (matches
   `supabase/config.toml`). The dashboard generates a database password — store it in
   the password manager; it is rarely needed but must not be lost.
   **As built (2026-08-12): project ref `qymhftesjzqrhwbinttx`, region `ap-northeast-2`
   (Seoul), Postgres 17.6.1.** Mumbai (`ap-south-1`) was the intended region — the
   dashboard's Region control reads "Asia-Pacific" and defaulted to Seoul rather than
   prompting for a city. The owner was shown the trade-off (roughly 100 ms of extra
   latency per page load for Indian visitors, images unaffected because they are served
   from a CDN) while the project was still empty, and chose to keep Seoul rather than
   recreate. Region cannot be changed after creation; revisiting it means a new project
   and a re-push of everything in this runbook.
2. Link and push the schema: `supabase link --project-ref <ref>` then
   `supabase db push` — replays every file in `supabase/migrations/` onto the empty
   hosted database. (The local "never `db:reset`" rule protects your real local data;
   a brand-new hosted project replaying from empty is exactly what migrations are for.)
3. Mirror the auth settings the repo already mandates: **signups disabled**
   (`enable_signup = false` locally — hosted equivalent is *Allow new users to sign up*
   → off), site URL = the `pages.dev` address.
4. Create the private storage bucket `media` (locally this is created outside
   migrations; hosted needs the same one-time step).
5. Seed the production admin — `scripts/seed-admin.mjs` pointed at the hosted project,
   with your Stage 0.3 email/password in shell variables. The script is idempotent and
   refuses to create a *second* admin by typo.
6. Deploy the two Edge Functions (`supabase functions deploy submit-inquiry sign-upload`)
   and set their secrets (reference table below). Two need generating fresh:
   `RATE_LIMIT_SALT` (a long random string — unset would make the rate-limiter's IP
   hashes trivially reversible) and the real Turnstile secret from Stage 4.

**A truthful-content bonus:** the hosted database starts **empty** of content — the
local seed data (including the `PS-002` celebrity testimonial) is a local-only script
and never reaches production. Films and testimonials on the live site will only ever be
what you add through the admin.

## Stage 3 — Photograph storage (engineering)

**If R2:** create bucket `media`; generate an S3 API token (that's `S3_ACCESS_KEY_ID` /
`S3_SECRET_ACCESS_KEY`, endpoint `https://<account-id>.r2.cloudflarestorage.com`, region
`auto`); add a CORS rule allowing `PUT` with `Content-Type` from the Pages origin (the
admin browser uploads straight to the bucket); enable public read via the bucket's
`r2.dev` development URL for now (fine behind `noindex`; Phase 7 puts the real domain in
front). `VITE_MEDIA_BASE_URL` = that public base URL.

**If Supabase Storage:** the `media` bucket from Stage 2 is made publicly readable;
`S3_ENDPOINT` = `https://<ref>.supabase.co/storage/v1/s3` with keys from Storage → S3
access keys; `VITE_MEDIA_BASE_URL` = `https://<ref>.supabase.co/storage/v1/object/public/media`.

Either way this closes `PS-033` — the "uploaded photo doesn't display" gap that has been
open by design since Phase 3.

## Stage 4 — Turnstile, for real (engineering)

Create a Turnstile widget in the Cloudflare dashboard with the `pages.dev` hostname.
That yields the real **site key** (goes in the frontend build env, replacing the
published always-pass test key) and **secret key** (goes in Edge Function secrets). The
inquiry function fails *closed* without a valid secret — the booking form will not accept
submissions until this is right, which is the correct failure direction.

## Stage 5 — Email (engineering; one honest limitation)

Set `RESEND_API_KEY` (from your Resend dashboard), `RESEND_FROM = onboarding@resend.dev`
(Resend's sandbox sender), `STUDIO_NOTIFY_EMAIL = peakstorystudio@gmail.com`.

- **Works from day one:** the "new inquiry" notification **to you** — because Resend's
  sandbox delivers to the account owner's address, which is why Stage 0.1 says to sign
  up with the studio Gmail.
- **Cannot work until Phase 7:** the acknowledgement email **to the couple** — sending
  to arbitrary addresses requires a verified sender domain, which requires the domain.
  The pipeline already handles this gracefully: the lead is stored regardless, the couple
  sees the on-screen success message, and the send outcome is recorded per-inquiry in
  the database (`notification_status`). No lead is ever lost to an email failure.

**Owner decision (2026-08-11): the domain stays deferred.** The site goes live on the
`pages.dev` URL first and is judged working there; the domain (and with it couple
acknowledgement emails, a verified sender, and search indexing) is the final step
afterwards. Phase 4 therefore ships with the sandbox sender and studio-only notification
described above — a deliberate, recorded trade, not an oversight.

## Stage 6 — Cloudflare Pages (engineering)

Connect the GitHub repo to a new Pages project: production branch `main`, build command
`npm run build`, output directory `dist`, Node 22. Set the five build-time variables
(reference table below). From then on: **every merge to `main` deploys automatically**,
and every PR gets its own preview URL. One known nuance: the Edge Functions' CORS
allowlist (`ALLOWED_ORIGINS`) matches origins exactly, so the booking form is pinned to
the production URL — on per-PR preview URLs it will be browser-blocked, which is
acceptable (previews are for reviewing pages, not taking bookings; CORS is a courtesy
here, not the security control — Turnstile and auth are).

## Stage 7 — Content on the hosted site

1. Re-run `scripts/load-real-content.mjs` against the hosted project **immediately after
   Stage 2, before any admin editing** — it is destructive to weddings/gallery rows (it
   rebuilds them from the real-photo file list), which is harmless on a fresh database
   and dangerous later. It gives the hosted site the same 64 real photographs, the
   Pragya wedding, and the Home image slots the local site has.
2. You then work only in the live admin (`<project>.pages.dev/admin.html`, your Stage
   0.3 login): add films and testimonials (remember: the live DB starts with none — no
   fabricated content exists to remove), fix "Pragya's Wedding" names/dates/venues,
   upload new photographs (which now display publicly — `PS-033` is closed).

## Stage 8 — Proving it works

- The full local gate suite stays green (`lint`, `test`, `check:docs`, `build` — CI).
- **Live inquiry test:** a real booking submission on the `pages.dev` URL with real
  Turnstile, verified to land in the hosted `inquiries` table and to email the studio
  Gmail, then marked and archived from the admin.
- **Live publish test:** upload a photograph in the live admin, publish it, and see it
  render on the public site — the end-to-end proof local development could never give.
- **Rollback safety:** Pages keeps every deployment; rolling back is one click in the
  dashboard. The database is separate from deploys — a bad frontend deploy cannot touch
  data.

**Definition of done** (roadmap `v0.5`): site reachable on `*.pages.dev`, `noindex` set,
deploys on merge, preview deploys per PR — plus, from the issues register: `PS-019`,
`PS-030`, `PS-033`, `PS-036` closed; `PS-027`/`PS-031` re-checked in their deployed context.

---

## Reference — every variable and where it lives

### Cloudflare Pages, build-time (visible in the shipped site — none are secrets)

| Variable | Value | Note |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Public by design; RLS is the guard |
| `VITE_SUPABASE_ANON_KEY` | hosted anon key | Public by design |
| `VITE_TURNSTILE_SITE_KEY` | real site key (Stage 4) | Replaces the published test key |
| `VITE_MEDIA_BASE_URL` | public media base (Stage 3) | What makes uploads display |
| `VITE_WHATSAPP_NUMBER` | leave blank | Superseded by the admin Settings value |

### Supabase Edge Function secrets (dashboard/CLI only — never in git)

| Secret | Value | Behaviour if wrong/missing |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | real secret key (Stage 4) | Form fails closed (500) — no silent spam hole |
| `RATE_LIMIT_SALT` | long random string, generated once | Unset: rate limiting still runs but IP hashes are unsalted |
| `RESEND_API_KEY` | from Resend | Missing: inquiry stored, email skipped + recorded |
| `RESEND_FROM` | `onboarding@resend.dev` until Phase 7 | Then an address on the verified domain |
| `STUDIO_NOTIFY_EMAIL` | `peakstorystudio@gmail.com` | Where "new inquiry" lands |
| `ALLOWED_ORIGINS` | `https://<project>.pages.dev` | Comma-append the real domain in Phase 7 |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | from Stage 3 | Upload signing fails closed (500) if incomplete |
| `INQUIRY_RATE_LIMIT` / `INQUIRY_RATE_WINDOW_MINUTES` / `MAX_UPLOAD_BYTES` | optional | Sensible defaults (5/hour; 15 MiB) |

(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected into
functions by the platform itself — never set manually.)

### Used once, at seeding time, in a terminal only

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Point `seed-admin.mjs` / `load-real-content.mjs` at the hosted project |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Your Stage 0.3 choice — becomes a bcrypt hash, then discarded |

### The four true secrets — dashboards and password manager only

Supabase **service-role key** · Turnstile **secret key** · storage **S3 secret key** ·
**Resend API key**. If any of these ever leaks (pasted somewhere public, committed by
accident), it gets rotated in its dashboard — say something immediately rather than
hoping it's fine.
