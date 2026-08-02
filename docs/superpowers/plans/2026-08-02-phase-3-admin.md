# Phase 3 (v0.4) — Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin signs in, works every booking inquiry, and publishes a wedding with uploaded photographs — with no code edit and nothing in `localStorage`.

**Architecture:** A second Vite entry point (`admin.html`) serves an admin app that never ships to public visitors. It authenticates through Supabase Auth and reaches Postgres through the existing hooks-and-queries layering. Image uploads go to S3-compatible storage — local Supabase in development, Cloudflare R2 in production — via a presigned `PUT` issued by an Edge Function that verifies the caller is an admin. Row Level Security, already built in Phase 1b, is the actual authorisation boundary throughout.

**Tech Stack:** Vite 5 multi-entry, React 18, Supabase Auth, Supabase Edge Functions (Deno, plain JavaScript), `aws4fetch` for S3 presigning, Vitest.

**Design:** [2026-08-02-phase-3-admin-design.md](../specs/2026-08-02-phase-3-admin-design.md). Read section 5.1 before writing any auth code.

## Global Constraints

- **Plain JavaScript only. No TypeScript**, including the Edge Function — it is registered with an explicit `entrypoint` in `supabase/config.toml`, exactly as `submit-inquiry` is.
- **Components never import the Supabase client.** Components call hooks, hooks call `src/lib/queries/` or `src/lib/auth.js`, and only `src/lib/supabase.js` constructs a client. This binds the admin exactly as it binds the public site.
- **The client-side admin gate is presentation, not protection.** RLS is the boundary. Say so in the code, so nobody later removes a check believing it to be load-bearing, or adds one believing it to be sufficient.
- **Schema changes go only in `supabase/migrations/`.** Never edit a running database to fix a migration; `npm run db:reset` replaying from empty is the proof.
- **Never introduce a raw hex colour.** Use the palette tokens in `tailwind.config.js` (`offwhite`, `pitch`, `charcoal`, `gold`). `SectionDivider` violates this as `PS-020` — do not copy it.
- **Style with Tailwind utilities inline on JSX.** Do not add to `src/index.css`.
- **The service-role key must never reach a `VITE_`-prefixed variable, the browser bundle, or a committed file.** S3 credentials live only in Edge Function secrets.
- **Never add fabricated press credentials, awards, statistics, or testimonials.** Standing rule.
- **No unconfirmed contact detail may be hard-coded anywhere new.** The studio's phone, email, and address live only in `src/data/contact.js`.
- **No optimistic UI.** A mutation reports success only after the database confirms it. This project already fixed exactly that defect in `BookingForm`; do not reintroduce it in the admin.
- **An empty list and a failed query must be visually distinct.** "No leads yet" and "could not load leads" are different facts.
- **Do not fix deferred issues.** `PS-009`, `PS-014`, `PS-016`, `PS-017`, `PS-018`, `PS-020`, `PS-021`, `PS-023` are explicitly out of scope (design §2).
- **Gates, every task:** `npm run lint` exits 0 (`--max-warnings=2`; the two allowed are pre-existing `PS-021` warnings in `src/hooks/useScrollReveal.js`), `npm test` passes in full, `npm run check:docs` passes.
- **Conventional Commits.** Branch `phase-3/admin`; never commit to `main`.
- Any change adding, removing, or renaming a component in `src/components` must update `docs/COMPONENTS.md` in the same change.

### Environment variables introduced

Browser (`.env.local`, and `.env.example`):

| Name | Purpose | Unset behaviour |
| --- | --- | --- |
| `VITE_MEDIA_BASE_URL` | Public base URL images are served from | Media renders a broken-image placeholder; the admin warns |

Edge Function (`supabase/functions/.env.local`, never committed):

| Name | Purpose |
| --- | --- |
| `S3_ENDPOINT` | `http://kong:8000/storage/v1/s3` locally; the R2 endpoint in production |
| `S3_REGION` | `local` locally; `auto` for R2 |
| `S3_BUCKET` | Bucket name |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | From `supabase status -o env` locally; an R2 API token in production |
| `MAX_UPLOAD_BYTES` | Ceiling enforced server-side. Defaults to `10485760` (10 MB) |

`supabase status -o env` emits these as `S3_PROTOCOL_ACCESS_KEY_ID`, `S3_PROTOCOL_ACCESS_KEY_SECRET`, `S3_PROTOCOL_REGION`, and `STORAGE_S3_URL` — map them.

### Environment facts that have destroyed agents on this project

- **`supabase functions serve` and `npm run dev` never exit.** Background them, poll for readiness, and kill them afterwards. Restart the function server after every edit — it does not reliably hot-reload.
- **Put `--max-time` on every curl.**
- **`psql` is not installed.** Use `docker exec -i "$(docker ps --format '{{.Names}}' | grep supabase_db)" psql -U postgres -d postgres -c "<sql>"`.
- The local stack is already running. Do not run `supabase start`.

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `admin.html` | Second Vite entry |
| `src/admin/main.jsx` | Admin React root |
| `src/admin/App.jsx` | Session gate and layout |
| `src/admin/SignInForm.jsx` | Email and password form |
| `src/admin/LeadsTable.jsx`, `LeadDetail.jsx` | Inquiries |
| `src/admin/ResourceList.jsx`, `ResourceForm.jsx` | The one CRUD pattern every content type uses |
| `src/admin/resources/*.js` | Per-entity configuration for that pattern |
| `src/admin/MediaPicker.jsx`, `UploadField.jsx` | Media |
| `src/lib/auth.js` | Sign in, sign out, session, profile |
| `src/lib/images.js` | Client-side resize, re-encode, dimensions |
| `src/lib/queries/adminInquiries.js`, `adminContent.js`, `media.js` | Admin data access |
| `src/hooks/useSession.js`, `useResource.js`, `useMediaUpload.js` | Admin hooks |
| `supabase/functions/sign-upload/index.js` | Presigned PUT, admin-gated |
| `scripts/seed-admin.mjs` | Idempotent local admin |
| `scripts/verify-admin.mjs` | End-to-end gate |

**Modified:** `vite.config.js`, `supabase/config.toml`, `package.json`, `src/App.jsx`, `src/hooks/useContent.js`, `.env.example`, `.github/workflows/ci.yml`, and the docs.

**Deleted:** `src/components/ContentManagerModal.jsx`, `src/lib/dataSource.js`.

---

## Task 1: Authentication foundation

**Files:**
- Create: `src/lib/auth.js`, `src/hooks/useSession.js`, `scripts/seed-admin.mjs`
- Create: `src/lib/__tests__/auth.test.js`, `src/hooks/__tests__/useSession.test.jsx`
- Modify: `supabase/config.toml`, `package.json`, `.env.example`

**Interfaces produced:**
- `signIn(email, password)` → resolves `{ session }`, throws `AuthError` with a `code` of `INVALID_CREDENTIALS`, `NOT_CONFIGURED`, or `NETWORK_ERROR`.
- `signOut()` → resolves.
- `getSession()` → `session | null`.
- `onAuthStateChange(handler)` → unsubscribe function.
- `getProfile(userId)` → `{ userId, role, displayName } | null`.
- `useSession()` → `{ status, session, profile, signIn, signOut, error }` where `status` is `loading | anonymous | authenticated | forbidden`.

Task 2 renders from `status`. Tasks 3–9 assume a signed-in admin.

- [ ] **Step 1: Disable public signup**

In `supabase/config.toml`, change the `[auth]` block's `enable_signup` (line ~176) from `true` to `false`, with a comment: the only accounts that exist are ones created deliberately, and a leaked anon key must not be usable to create one. Leave the `[auth.email]` and provider blocks alone.

- [ ] **Step 2: Write the failing auth tests**

Create `src/lib/__tests__/auth.test.js` covering, against a mocked `src/lib/supabase.js`:

- `signIn` returns the session on success and passes the exact credentials through.
- `signIn` throws `AuthError` with code `INVALID_CREDENTIALS` when Supabase reports invalid credentials.
- `signIn` throws `NETWORK_ERROR` when the call rejects.
- `signIn` throws `NOT_CONFIGURED` — without calling Supabase — when `isSupabaseConfigured` is false.
- `getProfile` returns `null` rather than throwing when no row exists.
- `getProfile` maps `user_id`/`display_name` to `userId`/`displayName`.
- `signOut` resolves even when Supabase reports an error, because a client that cannot reach the server must still be able to forget its session locally.

Run `npx vitest run src/lib/__tests__/auth.test.js` and confirm it fails with a module-not-found error before writing the module.

- [ ] **Step 3: Write `src/lib/auth.js`**

Mirror the shape of `src/lib/queries/inquiries.js`: a typed error class, a configuration guard, and no logging of credentials. Never log an email or password. `getProfile` reads `profiles` filtered by `user_id` and uses `maybeSingle()` so a missing row is `null` rather than an error.

- [ ] **Step 4: Write the failing `useSession` tests**

Create `src/hooks/__tests__/useSession.test.jsx` covering the four states:

- Starts `loading`, settles to `anonymous` with no session.
- With a session whose profile role is `admin`, settles to `authenticated`.
- With a session whose profile role is `client`, settles to **`forbidden`**, not `anonymous` — telling someone to sign in when they already are is a dead end.
- With a session but no profile row at all, settles to `forbidden`.
- `signIn` failing leaves `status` at `anonymous` and exposes the error code.
- Unsubscribes from auth changes on unmount, and does not set state after unmount.

- [ ] **Step 5: Write `src/hooks/useSession.js`**

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  signIn as signInRequest,
  signOut as signOutRequest,
  getSession,
  getProfile,
  onAuthStateChange,
} from '../lib/auth';

// status:
//   loading       — we do not yet know whether anyone is signed in
//   anonymous     — nobody is signed in
//   authenticated — signed in AND profiles.role = 'admin'
//   forbidden     — signed in, but not an admin
//
// `forbidden` is NOT a security decision. Row Level Security refuses every
// row and every write to a non-admin regardless of what this hook returns;
// see the Phase 1b policies. It exists so the UI can say something true —
// showing a sign-in form to someone who is already signed in is a dead end
// they cannot escape by doing what it asks.
export function useSession() {
  const [state, setState] = useState({ status: 'loading', session: null, profile: null });
  const [error, setError] = useState(null);
  const aliveRef = useRef(true);

  const resolve = useCallback(async (session) => {
    if (!session) {
      if (aliveRef.current) setState({ status: 'anonymous', session: null, profile: null });
      return;
    }
    let profile = null;
    try {
      profile = await getProfile(session.user.id);
    } catch {
      // A profile lookup that fails is indistinguishable, from here, from a
      // profile that says 'client'. Both must land on forbidden: assuming
      // admin on an error would hand the dashboard to a failed check.
      profile = null;
    }
    if (!aliveRef.current) return;
    setState({
      status: profile?.role === 'admin' ? 'authenticated' : 'forbidden',
      session,
      profile,
    });
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    getSession().then(resolve).catch(() => resolve(null));
    const unsubscribe = onAuthStateChange((session) => { resolve(session); });
    return () => {
      aliveRef.current = false;
      unsubscribe();
    };
  }, [resolve]);

  const signIn = useCallback(async (email, password) => {
    setError(null);
    try {
      const { session } = await signInRequest(email, password);
      await resolve(session);
      return true;
    } catch (err) {
      if (aliveRef.current) setError(err?.code ?? 'NETWORK_ERROR');
      return false;
    }
  }, [resolve]);

  const signOut = useCallback(async () => {
    await signOutRequest();
    if (aliveRef.current) setState({ status: 'anonymous', session: null, profile: null });
  }, []);

  return { ...state, error, signIn, signOut };
}
```

Note the `catch` around `getProfile`: a failed lookup must land on `forbidden`, never on `authenticated`. Defaulting to admin when a check errors is how a check becomes decoration.

- [ ] **Step 6: Write the idempotent admin seed**

Create `scripts/seed-admin.mjs`, reading `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` from the environment, and failing with the credential-mapping hint the other scripts print if any is missing.

It must: create the auth user if absent and update its password if present; upsert a `profiles` row with `role = 'admin'`; and print the email it configured. **Running it twice must succeed twice** — `npm run db:reset` wipes the database, and an unusable local admin is a dead end for the next person.

Add to `package.json`: `"db:seed-admin": "node scripts/seed-admin.mjs"`.

- [ ] **Step 7: Prove it end to end**

```bash
eval "$(supabase status -o env | sed 's/^/export /')"
export SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export ADMIN_EMAIL="admin@example.test" ADMIN_PASSWORD="local-dev-password"
npm run db:seed-admin
npm run db:seed-admin   # must succeed a second time
```

Then confirm the row and role through the container, and confirm the anon key **cannot** sign up now that signup is disabled:

```bash
curl -s --max-time 10 -X POST "$API_URL/auth/v1/signup" \
  -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"email":"intruder@example.test","password":"whatever123"}'
```

Expected: an error naming signups as disabled — **not** a created user. If a user is created, Step 1 did not take effect; restart the stack and re-check.

- [ ] **Step 8: Verify and commit**

`npm run lint`, `npm test`, `npm run check:docs`, then commit.

---

## Task 2: The admin entry point and session gate

**Files:**
- Create: `admin.html`, `src/admin/main.jsx`, `src/admin/App.jsx`, `src/admin/SignInForm.jsx`
- Create: `src/admin/__tests__/App.test.jsx`, `src/admin/__tests__/SignInForm.test.jsx`
- Modify: `vite.config.js`, `eslint.config.js` if `src/admin/**` needs a rules entry

**Interfaces produced:** an admin shell rendering a sign-in form, a refusal, or its children based on `useSession().status`. Tasks 3–9 mount their screens inside it.

**Consumes:** `useSession` from Task 1.

- [ ] **Step 1: Add the second Vite entry**

In `vite.config.js`, add `build.rollupOptions.input` mapping `main` to `index.html` and `admin` to `admin.html`, using `fileURLToPath(new URL(...))` as the existing `@shared` alias already does. Keep the `@shared` alias and the `test` block untouched.

- [ ] **Step 2: Create `admin.html`**

A minimal document mirroring `index.html`'s head — same charset, viewport, and stylesheet wiring — with `<title>Studio Admin — Peak Story Studio</title>`, a `<meta name="robots" content="noindex">` so an admin page is never indexed, and `<script type="module" src="/src/admin/main.jsx">`.

- [ ] **Step 3: Write the failing shell tests**

Create `src/admin/__tests__/App.test.jsx` with `useSession` mocked, asserting: `loading` renders a loading state and no form; `anonymous` renders the sign-in form; `forbidden` renders a refusal that names the account and offers sign-out, and **does not** render the sign-in form; `authenticated` renders its children and a sign-out control.

Create `src/admin/__tests__/SignInForm.test.jsx` asserting: labels are wired with `htmlFor`/`id`; submitting calls `signIn` with the entered values; the submit button is disabled while pending; a failed sign-in shows a message keyed by error code and does not clear the email field, because retyping an email after a typo'd password is a small cruelty.

- [ ] **Step 4: Write the components**

`main.jsx` mirrors `src/main.jsx`, including wrapping the app in the existing `ErrorBoundary`. `App.jsx` switches on `status`. `SignInForm.jsx` is presentational and receives `onSignIn`, `pending`, and `errorCode` as props.

Keep the admin visually plain — Tailwind utilities and palette tokens, no new design system. It is a tool, not a showcase.

- [ ] **Step 5: Prove the admin bundle is separate**

```bash
npm run build
ls -la dist/assets/ | head
```

Confirm `dist/admin.html` exists and that the admin chunk is distinct from the public entry's. Then confirm no admin code leaked into the public bundle:

```bash
grep -rl "SignInForm\|useSession" dist/assets/*.js || echo "no admin symbols in any chunk name"
```

Inspect which chunk the public `index.html` references and confirm the sign-in strings are not in it. Clean up with `git checkout -- dist/` then `git clean -fx dist/`; **never commit `dist/`** (`PS-019`).

- [ ] **Step 6: Verify and commit**

---

## Task 3: The leads dashboard

**Files:**
- Create: `src/lib/queries/adminInquiries.js`, `src/hooks/useResource.js`
- Create: `src/admin/LeadsTable.jsx`, `src/admin/LeadDetail.jsx`
- Create: tests for the query module, the hook, and both components
- Modify: `src/admin/App.jsx` to mount the dashboard

**Interfaces produced:**
- `listInquiries({ status })` → array of `{ id, name, email, phone, weddingDate, venue, services, message, status, notificationStatus, createdAt }`.
- `updateInquiryStatus(id, status)` → the updated row; rejects any status outside `new | contacted | booked | archived`.
- `useResource(queries)` → `{ items, status, error, reload, mutate }` where `status` is `loading | ready | error`.

  `queries` is an object of async functions. This task supplies `{ list, update }`; Task 7's `makeResourceQueries` supplies `{ list, create, update, remove, reorder }`. `mutate(name, ...args)` calls `queries[name]`, reloads on success, and rejects if the named query was not supplied — so the hook never needs to know which entity it is serving. **Tasks 7–9 reuse it unchanged**, so keep every trace of inquiries out of it.

- [ ] **Step 1: Write the failing query tests**

Cover: `listInquiries` selects the documented columns and orders newest first; a `status` filter is applied only when given; the returned objects use camelCase; a Postgres error throws rather than resolving to an empty array — an empty list and a failed query must never be confused. `updateInquiryStatus` rejects an unknown status **without** calling Supabase.

- [ ] **Step 2: Write the query module and the generic hook**

`useResource` owns `loading | ready | error`, exposes `reload`, and `mutate` which performs the update and reloads on success. No optimistic update: the table reflects what the database confirmed.

- [ ] **Step 3: Write the failing component tests**

`LeadsTable`: renders a row per inquiry with name, wedding date, venue, submitted date, and status; renders **`notification_status`** and marks `failed` or `skipped` visibly, because an inquiry the studio was never emailed about is the case this column exists for; filters by status; shows a distinct empty state and a distinct error state with a retry.

`LeadDetail`: shows the full message and services; offers the four status transitions; disables the controls while a change is in flight; surfaces a failed change rather than showing the new status.

No delete control anywhere — `archived` is the exit. Add a test asserting no delete affordance exists, so nobody adds one casually.

- [ ] **Step 4: Write the components, mount them, verify, commit**

Verify against real data by seeding an inquiry through the running function, signing in, and confirming it appears. Clean up the row afterwards.

---

## Task 4: `sign-upload` — the presigned upload endpoint

**Files:**
- Create: `supabase/functions/sign-upload/index.js`
- Create: `supabase/functions/_shared/s3-presign.js` and its tests
- Modify: `supabase/config.toml`, `supabase/functions/.env.example`

**Interfaces produced:** `POST /functions/v1/sign-upload` with `{ contentType, byteSize, fileName }` → `200 { ok: true, url, storagePath }`, or:

| Status | Body | Meaning |
| --- | --- | --- |
| 400 | `{ ok: false, error: "MALFORMED_REQUEST" }` | Body was not JSON, or fields missing |
| 401 | `{ ok: false, error: "UNAUTHENTICATED" }` | No or invalid JWT |
| 403 | `{ ok: false, error: "FORBIDDEN" }` | Signed in, but not an admin |
| 413 | `{ ok: false, error: "FILE_TOO_LARGE", maxBytes }` | Over `MAX_UPLOAD_BYTES` |
| 415 | `{ ok: false, error: "UNSUPPORTED_TYPE", allowed }` | Content type not in the allowlist |
| 500 | `{ ok: false, error: "STORAGE_NOT_CONFIGURED" }` | S3 settings missing — fail closed, never fall back to an unsigned URL |

**This function is the authorisation point for uploads.** Copy the hardening `submit-inquiry` already carries: the same CORS helper and its comment that CORS is not a write control, the same bounded body read, the same typed-error discipline, and a body-size guard first. Read `supabase/functions/submit-inquiry/index.js` before writing it.

- [ ] **Step 1: Write the failing presign tests**

`_shared/s3-presign.js` exports `presignPut({ endpoint, region, bucket, accessKeyId, secretAccessKey, key, contentType, expiresIn, now })`, returning a URL string. `now` is injected so tests are deterministic. Assert: the URL targets the bucket and key; it carries `X-Amz-Signature`, `X-Amz-Expires`, and `X-Amz-Credential` containing the region; two different keys produce different signatures; and the same inputs produce the same signature twice.

- [ ] **Step 2: Write `_shared/s3-presign.js` using `npm:aws4fetch`**

Confirm the `npm:` specifier resolves in the edge runtime — `@supabase/supabase-js` already does, so the mechanism works, but verify this package specifically before building on it.

```js
import { AwsClient } from 'npm:aws4fetch@1.0.20';

// Presigns a PUT so the browser can upload straight to storage without the
// bytes passing through this function, and without ever holding a credential.
//
// The same code serves local Supabase storage and Cloudflare R2: both speak
// S3, so only endpoint, region, and credentials differ between them. That is
// deliberate — a separate implementation per environment is how a bug hides
// until deployment.
export async function presignPut({
  endpoint,
  region,
  bucket,
  accessKeyId,
  secretAccessKey,
  key,
  contentType,
  expiresIn = 300,
}) {
  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region,
  });

  const url = new URL(`${endpoint.replace(/\/$/, '')}/${bucket}/${key}`);
  url.searchParams.set('X-Amz-Expires', String(expiresIn));

  const signed = await client.sign(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    aws: { signQuery: true },
  });

  return signed.url;
}
```

Because `signQuery` puts the signature in the query string, the browser's later `PUT` must send **the same `Content-Type`** it was signed with or the signature will not match. Say so in a comment — it is the most likely upload failure and the error S3 returns for it is opaque.

- [ ] **Step 3: Write the function**

Verify the JWT by creating a Supabase client with the caller's `Authorization` header and calling `getUser()`; then read that user's `profiles.role` **with the service-role key** and require `admin`. Do not trust any role claim in the token itself.

Generate the storage key server-side: a prefix, a UUID, and an extension derived from the allowlisted content type — never from the client's filename. A caller must not be able to choose the path, overwrite another object, or escape the prefix.

Allowlist `image/jpeg`, `image/png`, and `image/webp`. Presigned URLs expire in 300 seconds.

- [ ] **Step 4: Register it and prove every rejection**

Add `[functions.sign-upload]` with a `.js` entrypoint and `verify_jwt = true`. Then, with the function server running, prove: an anonymous call is refused; a signed-in non-admin gets 403; an admin gets a URL; a disallowed content type gets 415; an oversized declared size gets 413; and a path-traversal filename such as `../../evil.png` does **not** appear in the returned `storagePath`.

- [ ] **Step 5: Prove an upload actually lands**

Sign a URL as the admin, `PUT` a real image to it with curl, then confirm the object exists in local storage. A signed URL that does not accept an upload is not a working endpoint.

- [ ] **Step 6: Verify and commit**

---

## Task 5: The client upload pipeline

**Files:**
- Create: `src/lib/images.js`, `src/lib/queries/media.js`, `src/hooks/useMediaUpload.js`
- Create: tests for all three

**Interfaces produced:**
- `resizeImage(file, { maxEdge = 2000, type = 'image/webp', quality = 0.82 })` → `{ blob, width, height }`. An image already within `maxEdge` is re-encoded but **never upscaled**.
- `createMedia({ storagePath, width, height, altText })` → the inserted `media` row.
- `listMedia()`, `updateMediaAltText(id, altText)`.
- `useMediaUpload()` → `{ upload(file, { altText }), status, progress, error, reset }` with `status` in `idle | resizing | signing | uploading | recording | done | error`.

- [ ] **Step 1: Write the failing image tests**

jsdom has no real canvas encoder, so stub `HTMLCanvasElement.prototype.toBlob` and `createImageBitmap` in the test rather than pretending to encode. Assert: a 4000×3000 source becomes 2000×1500 — aspect ratio preserved; a 1200×800 source stays 1200×800; the reported dimensions match the blob produced; a non-image file rejects with a typed error.

- [ ] **Step 2: Write `src/lib/images.js`**

Keep it free of React and of the Supabase client — it is a pure browser utility, and Task 11's end-to-end gate reuses its dimension logic.

```js
export class ImageError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ImageError';
    this.code = code;
  }
}

// Scales the longest edge down to maxEdge, preserving aspect ratio, and
// NEVER scales up: enlarging a small photograph adds bytes and invents
// detail that was never there. An image already within the cap is still
// re-encoded, so the output format is predictable for every upload.
export function fitWithin(width, height, maxEdge) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function resizeImage(file, { maxEdge = 2000, type = 'image/webp', quality = 0.82 } = {}) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new ImageError('NOT_AN_IMAGE');
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // A file can claim image/png in its type and still be undecodable.
    throw new ImageError('DECODE_FAILED');
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new ImageError('ENCODE_FAILED');

  // Dimensions come from the canvas we actually drew, not from the source,
  // so what is recorded in `media` always matches the bytes uploaded.
  return { blob, width, height, type };
}
```

`fitWithin` is exported separately because it is pure and worth testing without stubbing a canvas — the upscale guard is the part most likely to regress.

- [ ] **Step 3: Write the failing upload-hook tests**

Assert the state machine advances through its stages; that a failure at **each** of the three points — signing, `PUT`, `media` insert — surfaces distinctly and leaves `status` at `error`; and that a failed `media` insert after a successful `PUT` reports that the upload did not complete rather than silently succeeding. Note in a comment that this leaves an orphaned object, which the design accepts as debt.

- [ ] **Step 4: Write the modules, verify, commit**

---

## Task 6: Media library UI

**Files:**
- Create: `src/admin/UploadField.jsx`, `src/admin/MediaPicker.jsx`, and their tests
- Modify: `src/admin/App.jsx`

**Interfaces produced:** `UploadField` — a file input plus alt-text field that performs one upload and calls `onUploaded(mediaRow)`. `MediaPicker` — lists existing media and calls `onSelect(mediaRow)`. Tasks 8 and 9 embed both.

- [ ] **Step 1: Write the failing tests**

Cover: choosing a file shows progress and disables the control; a failure shows the stage that failed and offers retry without re-choosing the file; alt text is submitted with the upload; media whose `alt_text` is empty is flagged in the list so it can be fixed; and the picker renders a distinct empty state versus a load error.

- [ ] **Step 2: Write the components**

Images render from `VITE_MEDIA_BASE_URL` joined to `storage_path`. When that variable is unset, render a labelled placeholder and a one-line explanation rather than a broken image — a fresh clone must not look broken for a reason nobody can see.

- [ ] **Step 3: Verify and commit**

---

## Task 7: The reusable resource pattern

**Files:**
- Create: `src/admin/ResourceList.jsx`, `src/admin/ResourceForm.jsx`, `src/lib/queries/adminContent.js`
- Create: tests for all three

**Why this exists:** five content types need the same list, create, edit, publish, reorder, and delete. Writing five near-identical screens would be five times the code and five times the surface for them to drift apart. This task builds the pattern once; Tasks 8 and 9 supply configuration only.

**Interfaces produced:**
- `adminContent.js` — `makeResourceQueries(table, columns)` returning `{ list, create, update, remove, reorder }`, each mapping snake_case to camelCase and throwing on error.
- `ResourceList({ config, items, status, error, onEdit, onCreate, onDelete, onToggleStatus, onReorder })`.
- `ResourceForm({ config, initial, onSubmit, onCancel, pending, error })`.
- A **resource config**. Tasks 8 and 9 write nothing but these, so the shape is a contract:

```js
// src/admin/resources/testimonials.js — the simplest one, shown in full so
// Tasks 8 and 9 have an exact template rather than a description.
import { makeResourceQueries } from '../../lib/queries/adminContent';

export const testimonialsResource = {
  key: 'testimonials',
  label: 'Testimonials',
  table: 'testimonials',
  // Columns fetched and written. camelCase in the app, snake_case in Postgres;
  // makeResourceQueries does the mapping in one place so no screen has to.
  columns: ['id', 'quote', 'couple', 'event', 'sort_order', 'status'],
  defaultSort: 'sort_order',
  // Which columns the list shows, in order.
  listColumns: [
    { name: 'couple', label: 'Couple' },
    { name: 'event', label: 'Event' },
    { name: 'status', label: 'Status' },
  ],
  fields: [
    {
      name: 'quote',
      label: 'Quote',
      type: 'textarea',
      required: true,
      help: 'Use only words someone actually gave you. Never attribute a quote to a real person who did not say it.',
    },
    { name: 'couple', label: 'Couple', type: 'text', required: true },
    { name: 'event', label: 'Event', type: 'text', required: false },
    { name: 'sortOrder', label: 'Order', type: 'number', required: false },
  ],
};

export const testimonialsQueries = makeResourceQueries(
  testimonialsResource.table,
  testimonialsResource.columns,
);
```

Field `type` is one of `text`, `textarea`, `date`, `number`, `select` (which also carries `options: [{ value, label }]`), or `media` (which renders `MediaPicker` and `UploadField` and stores a media id). `status` is not a field — every resource has it, and `ResourceList` renders the publish toggle from it.

- [ ] **Step 1: Write the failing tests**

Test the pattern generically against a small fixture config, not against a real entity — that is what proves it is reusable. Cover: the list renders one row per item using `listColumns`; the status toggle calls back with the opposite status; reorder calls back with the new order; delete asks for confirmation first and does nothing if declined; the form renders a control per field type; `required` fields block submission with an inline message; and a `date` field round-trips an ISO value without a timezone shift — this project has been bitten by that before.

- [ ] **Step 2: Write the modules**

`ResourceForm` must wire every label with `htmlFor`/`id` and set `aria-invalid` and `aria-describedby` on invalid fields, matching what `BookingForm` does. A `media` field embeds `MediaPicker` and `UploadField` from Task 6.

- [ ] **Step 3: Verify and commit**

---

## Task 8: Weddings and their photographs

**Files:**
- Create: `src/admin/resources/weddings.js`, `src/admin/WeddingPhotos.jsx`, and tests
- Modify: `src/admin/App.jsx`

**The complex one.** A wedding has a `date` (`PS-022`: a real date from a picker, never free text), a cover image, and an ordered set of `wedding_photos` rows joining it to `media`.

- [ ] **Step 1: Write the resource config**

Fields: title, couple, location, `date` as a `date` control, description, cover media, `sort_order`, `status`. The `date` control writes an ISO `YYYY-MM-DD` string straight through to the `date` column.

- [ ] **Step 2: Prove the date does not shift**

A test asserting that entering a date renders and stores the same calendar day, run under at least `Asia/Calcutta`, `America/Los_Angeles`, and `UTC` via `TZ=`. Phase 1b lost a day to exactly this bug; the guard is cheap and the regression is silent.

- [ ] **Step 3: Photo association UI**

`WeddingPhotos` lists a wedding's photos in `sort_order`, adds one from `MediaPicker` or a fresh `UploadField`, removes one, and reorders. Removing a `wedding_photos` row must not delete the underlying `media` row — the same image may be used elsewhere. Add a test for that specifically.

- [ ] **Step 4: Verify and commit**

---

## Task 9: Gallery, films, and testimonials

**Files:**
- Create: `src/admin/resources/gallery.js`, `films.js`, `testimonials.js`, and one test per config
- Modify: `src/admin/App.jsx` for navigation between resources

Each is configuration over Task 7's pattern. Where a field cannot be expressed by an existing `type`, extend `ResourceForm` with the new type and test it there — do not special-case a single entity inside the shared component.

Testimonials carry a standing constraint: the admin must not make it easy to attribute a quote to a real person who did not give it. Put a one-line note in the form's help text pointing at the content-integrity rule.

- [ ] **Step 1: Write the configs and their tests**
- [ ] **Step 2: Add resource navigation to the shell**
- [ ] **Step 3: Verify and commit**

---

## Task 10: Make the database authoritative

**Files:**
- Delete: `src/lib/dataSource.js`, `src/components/ContentManagerModal.jsx`
- Modify: `src/App.jsx`, `src/hooks/useContent.js`, `.env.example`, `docs/COMPONENTS.md`

This is what closes `PS-004`, `PS-005` and `PS-024`, and it must land **after** the admin works — never leave the site with no way to manage content.

- [ ] **Step 1: Remove the flag**

Delete `src/lib/dataSource.js`. In `src/hooks/useContent.js`, drop the `source` parameter and always query. **Keep the static module as the error fallback** — `useContent` already does this in its `catch`. Comment that this is resilience, not configuration: a stale site beats a blank one, and Phase 7 must still clean `weddingData.js` because it is what a visitor sees when the database is unreachable.

- [ ] **Step 2: Remove the Content Manager**

Delete the component. In `src/App.jsx` remove: the import, `localStories`/`localPhotos` state and their `localStorage` effects, `stories`/`setStories` and `photos`/`setPhotos`, `contentManagerOpen`, the `handleAddPhoto`/`handleAddStory` callbacks, the `<ContentManagerModal>` element, and all three `onOpenContentManager` props (lines ~159, ~197, ~213) along with the props themselves in `Navbar` and `Footer`.

Remove the `peak_story_stories` and `peak_story_photos` keys from `localStorage` usage entirely. Update `docs/COMPONENTS.md` in the same change or `check:docs` fails.

- [ ] **Step 3: Guard every content section**

Confirm each section tolerates an empty array now that an unpublished collection is normal. `Testimonials` already guards. Add a test per section that renders it with `[]` and asserts it does not throw — this project has already blanked its own homepage this way once.

- [ ] **Step 4: Prove the site still renders from the database**

With the stack running and content seeded, run the dev server in the background and confirm the public site renders content, then that it falls back rather than blanking when the database is unreachable.

- [ ] **Step 5: Verify and commit**

---

## Task 11: The end-to-end gate

**Files:**
- Create: `scripts/verify-admin.mjs`
- Modify: `package.json`, `.github/workflows/ci.yml`

Model it on `scripts/verify-inquiry.mjs`, which is the reference for tone, cleanup, and the `check()` helper.

- [ ] **Step 1: Write the script**

It must: seed an admin; sign in with the anon key and get a session; call `sign-upload` and `PUT` a small generated PNG; insert a `media` row; create a wedding, attach the photo, and publish it; then read it back **through the public query layer** and assert against Postgres that every field matches — including that the date did not shift. Then clean up every row and object it created.

It must also assert the refusals: an anonymous `sign-upload` is refused, and an anonymous read of `inquiries` returns nothing.

- [ ] **Step 2: Prove the gate can fail**

Break something deliberately — have the wedding insert drop the date, or `sign-upload` return an unsigned URL — and confirm the script reports it and exits non-zero. Restore and confirm green. A check that cannot fail manufactures confidence.

- [ ] **Step 3: Wire it into CI**

Add an `admin-e2e` job matching the existing `inquiry-e2e` job exactly — same action versions, same Node version, same `::error::` annotation pattern, because workflow logs need auth and return 403 while annotations are public.

- [ ] **Step 4: Verify and commit**

---

## Task 12: Documentation

**Files:** `docs/ARCHITECTURE.md`, `docs/COMPONENTS.md`, `docs/DATA-MODEL.md`, `docs/ROADMAP.md`, `docs/KNOWN-ISSUES.md`, `README.md`, `.env.example`

- [ ] **Step 1: Architecture** — the admin entry point and why it is not a route; the auth flow and the explicit statement that RLS is the boundary; the upload flow; and the S3 abstraction with the reason both environments share one code path.

- [ ] **Step 2: Data model** — how `media` is populated, that `blurhash` stays null deliberately, and how `wedding_photos` joins weddings to media.

- [ ] **Step 3: Known issues** — move `PS-004`, `PS-005`, `PS-022`, `PS-024` to Resolved, each saying what actually changed. Re-file the eight deferred issues (`PS-009`, `PS-014`, `PS-016`, `PS-017`, `PS-018`, `PS-020`, `PS-021`, `PS-023`) out of phase 3 into a later polish pass, so the register stops contradicting the design. Add any new issue this phase creates — orphaned storage objects when a `media` insert fails after a successful `PUT` is a known accepted gap and needs a row.

- [ ] **Step 4: README and roadmap** — how to run the admin locally end to end: `db:start`, `db:reset`, `db:seed-admin`, `db:functions`, `dev`, and where to find it. Mark `v0.4` delivered.

- [ ] **Step 5: Final gates**

`npm run lint`, `npm test`, `npm run check:docs`, `npm run build`, `npm run verify:inquiry`, `npm run verify:admin`. Clean `dist/` and do not commit it.

---

## Notes for the reviewer

- **The client-side admin gate must never be described, or relied upon, as the security boundary.** RLS is. Check the code says so.
- **`sign-upload` is the authorisation point for uploads.** The storage key must be server-generated; a client-supplied filename must not reach the path.
- **No optimistic UI.** Every mutation must confirm before it reports success.
- **An empty list and a failed query must look different** everywhere they can occur.
- **The date must not shift.** Task 8 Step 2 is the guard; this project has lost a day to it before.
- **`npm run verify:admin` must be capable of failing.** Task 11 Step 2 proves it.
- **Nothing may reintroduce `localStorage` as a content store**, and no `dist/` changes may be committed.
