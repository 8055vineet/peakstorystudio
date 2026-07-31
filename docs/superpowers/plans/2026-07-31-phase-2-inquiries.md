# Phase 2 (v0.3) — Real Booking Inquiries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A booking inquiry submitted on the site is stored in Postgres, emailed to the studio, acknowledged to the couple, and never silently lost.

**Architecture:** The browser posts to a single Supabase Edge Function, `submit-inquiry`, which is the only write path to the `inquiries` table. The function re-validates the payload server-side, checks a Cloudflare Turnstile token, consumes a per-submitter rate limit held in Postgres, inserts the row with the service-role key, then attempts two Resend emails and records the outcome on the row. Validation rules live in one shared module that both the function and the browser import, so the inline message a couple sees cannot contradict what the server accepts.

**Tech Stack:** Supabase Edge Functions (Deno runtime, plain JavaScript entrypoint), Postgres, Cloudflare Turnstile, Resend, React 18, Vitest.

## Global Constraints

Every task's requirements implicitly include this section.

- **Plain JavaScript only. No TypeScript anywhere, including the Edge Function.** The function is registered in `supabase/config.toml` with an explicit `entrypoint` pointing at `index.js`. This was verified working against edge-runtime v1.74.2 before this plan was written.
- **Components never import the Supabase client.** Components call hooks, hooks call `src/lib/queries/`, and only `src/lib/supabase.js` constructs a client.
- **Schema changes go only in `supabase/migrations/`.** Never edit a running database to fix a migration. `npm run db:reset` replaying from empty is what proves a migration is complete.
- **Never introduce a raw hex colour in a component.** Use the palette tokens in `tailwind.config.js` (`offwhite`, `pitch`, `charcoal`, `gold`). Do not extend the `SectionDivider` raw-hex pattern (`PS-020`).
- **Style with Tailwind utilities inline on JSX.** Only touch `src/index.css` for what utilities genuinely cannot express.
- **Never add fabricated press credentials, awards, statistics, or testimonials attributed to real people.** Standing rule, not phase-scoped.
- **Do not fix known issues outside their planned phase** without saying so explicitly in the commit message. `PS-002` (fabricated content), `PS-019` (`dist/`), `PS-020` (`SectionDivider` hex), `PS-021` (`useScrollReveal` deps) are all out of scope here.
- **No unconfirmed contact detail may be hard-coded into new code.** The studio has not yet confirmed the phone number, email address, or postal address already on the site. New code reads them from one module; the WhatsApp number comes from an environment variable and its button does not render when unset.
- **Rate limiting fails open, the captcha fails closed.** An undeterminable client IP skips the rate-limit check and logs it. A missing `TURNSTILE_SECRET_KEY` is a 500, never a bypass.
- **A saved lead is never turned into an error.** Email is attempted after the insert; any email failure is recorded on the row and the couple still sees success.
- **Every task ends green on `npm run lint` (max 2 warnings), `npm test`, and `npm run check:docs`.** The two existing `react-hooks/exhaustive-deps` warnings in `src/hooks/useScrollReveal.js` are `PS-021` and are expected; do not silence them with a rule disable.
- **Conventional Commits** for every commit message. The branch is `phase-2/inquiries`; never commit to `main`.
- **Any change that adds, removes, or renames a component in `src/components` must update `docs/COMPONENTS.md` in the same change.** `npm run check:docs` fails the build otherwise.

### Environment variables introduced by this phase

Browser (`.env.local`, prefixed `VITE_`):

| Name | Purpose | Unset behaviour |
| --- | --- | --- |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile widget site key | Inquiry backend reported unconfigured; form offers direct contact instead |
| `VITE_WHATSAPP_NUMBER` | Digits only, country code first, e.g. `919820037027` | WhatsApp button does not render |

Edge Function (`supabase/functions/.env.local`, never committed):

| Name | Purpose | Unset behaviour |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | Turnstile server secret | Function returns 500 `CAPTCHA_NOT_CONFIGURED` |
| `RATE_LIMIT_SALT` | Salt for the IP hash | Empty salt; hashing still applied |
| `INQUIRY_RATE_LIMIT` | Max inquiries per window per IP | Defaults to `5` |
| `INQUIRY_RATE_WINDOW_MINUTES` | Window length | Defaults to `60` |
| `RESEND_API_KEY` | Resend API key | Email skipped; row saved with `notification_status='skipped'` |
| `RESEND_FROM` | Verified sender address | Email skipped |
| `STUDIO_NOTIFY_EMAIL` | Where studio notifications go | Email skipped |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist | `*` (local development) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into the function automatically by the platform. Do not set them yourself and never place a service-role key in any `VITE_`-prefixed variable or committed file.

Cloudflare publishes Turnstile test keys that require no account and are safe to commit to `.env.example`: site key `1x00000000000000000000AA` and secret key `1x0000000000000000000000000000000AA` (both always pass); site key `2x00000000000000000000AB` always blocks.

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/20260731090000_inquiry_pipeline.sql` | `notification_status` column, `inquiry_rate_limits` table, `consume_inquiry_rate_limit()` |
| `supabase/functions/_shared/inquiry-validation.js` | The one definition of a valid inquiry. No Deno or browser globals. |
| `supabase/functions/_shared/turnstile.js` | Turnstile siteverify call, injectable `fetch` |
| `supabase/functions/_shared/email.js` | Resend notification and acknowledgement, injectable `fetch` |
| `supabase/functions/_shared/__tests__/inquiry-validation.test.js` | Field rules |
| `supabase/functions/_shared/__tests__/turnstile.test.js` | Verify outcomes |
| `supabase/functions/_shared/__tests__/email.test.js` | Send outcomes and degradation |
| `supabase/functions/submit-inquiry/index.js` | The only write path to `inquiries` |
| `supabase/functions/.env.example` | Function secret template |
| `src/data/contact.js` | The single home for studio contact details |
| `src/lib/queries/inquiries.js` | `submitInquiry`, `InquiryError`, configuration flag |
| `src/hooks/useInquirySubmission.js` | idle / pending / success / error state machine |
| `src/hooks/useTurnstile.js` | Widget lifecycle and token |
| `src/components/WhatsAppButton.jsx` | `wa.me` click-to-chat, hidden when unconfigured |
| `src/lib/queries/__tests__/inquiries.test.js` | Query-layer contract |
| `src/hooks/__tests__/useInquirySubmission.test.jsx` | State machine |
| `src/components/__tests__/BookingForm.test.jsx` | Validation, pending, success, failure |
| `src/components/__tests__/WhatsAppButton.test.jsx` | Renders only when configured |
| `scripts/verify-inquiry.mjs` | End-to-end gate against the running stack |

**Modified:**

| Path | Change |
| --- | --- |
| `supabase/config.toml` | Register `[functions.submit-inquiry]` with a `.js` entrypoint |
| `eslint.config.js` | A rules block giving `supabase/functions/**` the `Deno` global |
| `vite.config.js` | `@shared` alias |
| `package.json` | `db:functions` and `verify:inquiry` scripts |
| `src/components/BookingForm.jsx` | Real submission, inline validation, pending and error states |
| `.env.example` | New browser variables |
| `.github/workflows/ci.yml` | End-to-end inquiry job |
| `docs/DATA-MODEL.md`, `docs/ARCHITECTURE.md`, `docs/COMPONENTS.md`, `docs/ROADMAP.md`, `docs/KNOWN-ISSUES.md`, `README.md` | Documentation duties |

---

## Task 1: Database — rate-limit ledger and notification status

**Files:**
- Create: `supabase/migrations/20260731090000_inquiry_pipeline.sql`
- Modify: `docs/DATA-MODEL.md`

**Interfaces:**
- Consumes: the `public.inquiries` table and `public.is_admin()` from the Phase 1b migrations.
- Produces: column `public.inquiries.notification_status`; table `public.inquiry_rate_limits`; function `public.consume_inquiry_rate_limit(p_ip_hash text, p_max_requests integer, p_window interval)` returning one row `(allowed boolean, retry_after_seconds integer)`. Task 4 calls this function by RPC.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260731090000_inquiry_pipeline.sql` with exactly this content:

```sql
-- Phase 2 — the inquiry write path.
--
-- Phase 1b created public.inquiries and locked anon out of it entirely. Three
-- things the Edge Function needs that it did not provide:
--   1. somewhere to record whether the studio was actually told about a lead,
--   2. a ledger to rate-limit submissions per visitor,
--   3. an atomic way to consume one unit of that limit.

alter table public.inquiries
  add column notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'failed', 'skipped'));

comment on column public.inquiries.notification_status is
  'Whether the studio notification email went out. ''skipped'' means email was
   never configured, ''failed'' means Resend rejected it. The row is saved
   either way — a lead is never lost because email broke. Without this column a
   silent Resend outage is indistinguishable from a week with no inquiries.';

-- Keyed by a salted SHA-256 of the submitter's IP, never the address itself,
-- so this table holds nothing that identifies a person on its own.
create table public.inquiry_rate_limits (
  ip_hash           text primary key,
  window_started_at timestamptz not null default now(),
  request_count     integer     not null default 0
);

comment on table public.inquiry_rate_limits is
  'Per-visitor inquiry counter, written only by the submit-inquiry Edge
   Function via consume_inquiry_rate_limit(). Not readable by anon at all.';

create index inquiry_rate_limits_window_idx
  on public.inquiry_rate_limits (window_started_at);

alter table public.inquiry_rate_limits enable row level security;

-- No policies at all: anon and authenticated get nothing. The Edge Function
-- reaches this table with the service-role key, which bypasses RLS. Base
-- grants are still required for service_role, because Postgres checks table
-- privileges before it ever evaluates a policy.
grant select, insert, update, delete
  on public.inquiry_rate_limits
  to service_role;

-- One statement does the window roll, the increment, and the read, so two
-- simultaneous requests cannot both pass a limit that admits only one.
create or replace function public.consume_inquiry_rate_limit(
  p_ip_hash      text,
  p_max_requests integer,
  p_window       interval
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_started_at timestamptz;
  v_request_count     integer;
begin
  -- Opportunistic prune. At this traffic the table never exceeds a few
  -- thousand rows, and this keeps it from growing without bound.
  --
  -- greatest() so the prune can never delete a row that is still inside the
  -- caller's window. A bare '1 day' would silently defeat any window of a day
  -- or more: the counter row would be deleted before the upsert reads it, and
  -- the limit would reset every call with no error anywhere.
  delete from public.inquiry_rate_limits
   where window_started_at < now() - greatest(p_window, interval '1 day');

  insert into public.inquiry_rate_limits as l (ip_hash, window_started_at, request_count)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update
     set window_started_at = case
           when l.window_started_at < now() - p_window then now()
           else l.window_started_at
         end,
         request_count = case
           when l.window_started_at < now() - p_window then 1
           else l.request_count + 1
         end
  returning l.window_started_at, l.request_count
    into v_window_started_at, v_request_count;

  if v_request_count > p_max_requests then
    return query
      select false,
             greatest(
               1,
               ceil(extract(epoch from (v_window_started_at + p_window - now())))::integer
             );
    -- RETURN QUERY appends rows; it does not exit. Without this bare return,
    -- a blocked call falls through and appends a second, contradictory
    -- allowed=true row, and the caller's .single() gets the wrong answer.
    return;
  end if;

  return query select true, 0;
end;
$$;

comment on function public.consume_inquiry_rate_limit(text, integer, interval) is
  'Records one inquiry attempt for p_ip_hash and reports whether it is within
   p_max_requests per p_window. Rolls the window when the current one has
   expired. Callable only by service_role.';

revoke all on function public.consume_inquiry_rate_limit(text, integer, interval) from public;
grant execute on function public.consume_inquiry_rate_limit(text, integer, interval) to service_role;
```

- [ ] **Step 2: Replay the migrations from empty**

```bash
npm run db:reset
```

Expected: completes without error. If it fails, fix the migration file — never patch the running database.

- [ ] **Step 3: Prove the schema landed**

`psql` is not installed on this machine. Query through the container:

```bash
DB=$(docker ps --format '{{.Names}}' | grep supabase_db)
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "select column_name, column_default from information_schema.columns
    where table_name = 'inquiries' and column_name = 'notification_status';"
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "select proname from pg_proc where proname = 'consume_inquiry_rate_limit';"
```

Expected: one column row defaulting to `'pending'::text`, and one function row.

- [ ] **Step 4: Prove the rate limiter actually limits, and that the window rolls**

```bash
DB=$(docker ps --format '{{.Names}}' | grep supabase_db)
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "select * from public.consume_inquiry_rate_limit('probe', 2, interval '1 hour');
   select * from public.consume_inquiry_rate_limit('probe', 2, interval '1 hour');
   select * from public.consume_inquiry_rate_limit('probe', 2, interval '1 hour');"
```

Expected: `t | 0`, then `t | 0`, then `f` with a positive `retry_after_seconds` near 3600.

Then prove the window rolls rather than blocking forever:

```bash
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "update public.inquiry_rate_limits
      set window_started_at = now() - interval '2 hours'
    where ip_hash = 'probe';
   select * from public.consume_inquiry_rate_limit('probe', 2, interval '1 hour');
   delete from public.inquiry_rate_limits where ip_hash = 'probe';"
```

Expected: `t | 0` — the expired window resets the count rather than staying blocked.

- [ ] **Step 5: Prove anon cannot read the ledger**

Seed a row first, so that a passing check cannot be passing merely because the table is empty — an empty-table assertion proves nothing.

```bash
eval "$(supabase status -o env | sed 's/^/export /')"
DB=$(docker ps --format '{{.Names}}' | grep supabase_db)
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "insert into public.inquiry_rate_limits (ip_hash, request_count) values ('probe-anon', 3);"
curl -s "$API_URL/rest/v1/inquiry_rate_limits?select=*" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "delete from public.inquiry_rate_limits where ip_hash = 'probe-anon';"
```

Expected: a permission-denied error or `[]` — and specifically **not** the seeded row. If `probe-anon` comes back, the grants are wrong; stop and fix the migration.

- [ ] **Step 6: Document the schema**

In `docs/DATA-MODEL.md`, add `notification_status` to the `inquiries` table description (values `pending`, `sent`, `failed`, `skipped`, and what each means), and add a section for `inquiry_rate_limits` and `consume_inquiry_rate_limit()`. State plainly that the table stores a salted hash of the IP and never the address.

- [ ] **Step 7: Verify and commit**

```bash
npm run check:docs
git add supabase/migrations/20260731090000_inquiry_pipeline.sql docs/DATA-MODEL.md
git commit -m "feat: add the inquiry rate-limit ledger and notification status"
```

---

## Task 2: The shared validation module

**Files:**
- Create: `supabase/functions/_shared/inquiry-validation.js`
- Create: `supabase/functions/_shared/__tests__/inquiry-validation.test.js`
- Modify: `eslint.config.js`, `vite.config.js`

**Interfaces:**
- Produces: `SERVICES` (array of the four offered services), `FIELD_LIMITS`, `MAX_YEARS_AHEAD`, and `validateInquiry(input, { today })` returning `{ valid: boolean, fields: Record<string,string>, value: object }`. The `value` object carries trimmed `name`, `email`, `phone`, `weddingDate`, `venue`, `services` (array), `message` (string or `null`). Task 3 calls this in the Edge Function; Task 7 calls it in the browser.
- The `today` option is an ISO `YYYY-MM-DD` string. When it is absent or malformed, the past/too-far-ahead checks are skipped and everything else still runs. It is an injected parameter so tests are deterministic.

**Context:** required fields deliberately match what `BookingForm` already marks with an asterisk today — name, email, phone, wedding date, venue. Phase 2 changes how the form submits, not which fields it demands. Whether a couple who has not fixed a date or venue should be able to inquire at all is a product question; Task 8 files it as a known issue rather than deciding it here.

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/_shared/__tests__/inquiry-validation.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  validateInquiry,
  SERVICES,
  FIELD_LIMITS,
} from '../inquiry-validation.js';

const TODAY = '2026-07-31';

function valid(overrides = {}) {
  return {
    name: 'Ananya & Rohan',
    email: 'couple@example.com',
    phone: '+91 98200 00000',
    weddingDate: '2027-02-14',
    venue: 'Umaid Bhawan Palace, Jodhpur',
    services: ['Cinematic Film'],
    message: 'Three days, two venues.',
    ...overrides,
  };
}

describe('validateInquiry', () => {
  it('accepts a complete inquiry and returns trimmed values', () => {
    const result = validateInquiry(valid({ name: '  Ananya & Rohan  ' }), { today: TODAY });
    expect(result.valid).toBe(true);
    expect(result.fields).toEqual({});
    expect(result.value.name).toBe('Ananya & Rohan');
    expect(result.value.services).toEqual(['Cinematic Film']);
  });

  it('rejects a non-object payload without throwing', () => {
    const result = validateInquiry(null, { today: TODAY });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.fields).length).toBeGreaterThan(0);
  });

  it.each([
    ['name', ''],
    ['name', 'A'],
    ['email', ''],
    ['email', 'not-an-email'],
    ['email', 'missing@domain'],
    ['phone', ''],
    ['phone', 'call me'],
    ['venue', ''],
    ['weddingDate', ''],
    ['weddingDate', '14-02-2027'],
    ['weddingDate', '2027-02-30'],
  ])('rejects %s = %j', (field, value) => {
    const result = validateInquiry(valid({ [field]: value }), { today: TODAY });
    expect(result.valid).toBe(false);
    expect(result.fields[field]).toBeTruthy();
  });

  it('rejects a wedding date in the past', () => {
    const result = validateInquiry(valid({ weddingDate: '2026-07-30' }), { today: TODAY });
    expect(result.fields.weddingDate).toBeTruthy();
  });

  it('accepts a wedding date of today', () => {
    const result = validateInquiry(valid({ weddingDate: TODAY }), { today: TODAY });
    expect(result.valid).toBe(true);
  });

  it('rejects a wedding date more than five years ahead', () => {
    const result = validateInquiry(valid({ weddingDate: '2032-07-31' }), { today: TODAY });
    expect(result.fields.weddingDate).toBeTruthy();
  });

  it('skips date range checks when today is not supplied', () => {
    const result = validateInquiry(valid({ weddingDate: '1999-01-01' }));
    expect(result.valid).toBe(true);
  });

  it.each([
    ['name', FIELD_LIMITS.name],
    ['venue', FIELD_LIMITS.venue],
    ['message', FIELD_LIMITS.message],
  ])('rejects %s longer than its limit', (field, limit) => {
    const result = validateInquiry(valid({ [field]: 'x'.repeat(limit + 1) }), { today: TODAY });
    expect(result.fields[field]).toBeTruthy();
  });

  it('rejects a service that is not offered', () => {
    const result = validateInquiry(valid({ services: ['Skywriting'] }), { today: TODAY });
    expect(result.fields.services).toBeTruthy();
  });

  it('rejects services that is not an array', () => {
    const result = validateInquiry(valid({ services: 'Cinematic Film' }), { today: TODAY });
    expect(result.fields.services).toBeTruthy();
  });

  it('accepts every offered service at once and de-duplicates', () => {
    const result = validateInquiry(
      valid({ services: [...SERVICES, SERVICES[0]] }),
      { today: TODAY },
    );
    expect(result.valid).toBe(true);
    expect(result.value.services).toEqual(SERVICES);
  });

  it('treats services and message as optional', () => {
    const result = validateInquiry(
      valid({ services: undefined, message: undefined }),
      { today: TODAY },
    );
    expect(result.valid).toBe(true);
    expect(result.value.services).toEqual([]);
    expect(result.value.message).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run supabase/functions/_shared/__tests__/inquiry-validation.test.js
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the module**

Create `supabase/functions/_shared/inquiry-validation.js`:

```js
// The one definition of a valid booking inquiry.
//
// Imported by the submit-inquiry Edge Function (relatively) and by the browser
// (through the @shared Vite alias). Two copies of these rules would drift, and
// drift here means showing a couple an inline message the server contradicts.
// Keep this file free of Deno and browser globals so both runtimes can load it.

export const SERVICES = [
  'Cinematic Film',
  'Fine Art Photography',
  'Drone Aerials',
  'Pre-Wedding Shoot',
];

export const FIELD_LIMITS = {
  name: 100,
  email: 254,
  phone: 20,
  venue: 200,
  message: 2000,
};

export const MAX_YEARS_AHEAD = 5;

// Deliberately permissive. The address is confirmed by the acknowledgement
// email actually arriving, not by a regex trying to encode RFC 5322.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[+(\d][\d\s()+-]{6,19}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRealIsoDate(value) {
  // Date.parse rejects out-of-range components in ISO form, so 2027-02-30 is
  // NaN rather than rolling forward into March.
  return ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function validateInquiry(input, { today } = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const fields = {};

  const name = text(source.name);
  if (name.length < 2) {
    fields.name = 'Please tell us who we should address.';
  } else if (name.length > FIELD_LIMITS.name) {
    fields.name = `Please keep this under ${FIELD_LIMITS.name} characters.`;
  }

  const email = text(source.email);
  if (!email) {
    fields.email = 'We need an email address to reply to.';
  } else if (email.length > FIELD_LIMITS.email || !EMAIL_PATTERN.test(email)) {
    fields.email = 'That email address does not look right.';
  }

  const phone = text(source.phone);
  if (!phone) {
    fields.phone = 'We need a phone number.';
  } else if (!PHONE_PATTERN.test(phone)) {
    fields.phone = 'Use digits, spaces, and + ( ) - only.';
  }

  const weddingDate = text(source.weddingDate);
  const reference = isRealIsoDate(text(today)) ? text(today) : null;
  if (!weddingDate) {
    fields.weddingDate = 'Please give us your wedding date.';
  } else if (!isRealIsoDate(weddingDate)) {
    fields.weddingDate = 'Please give a valid date.';
  } else if (reference) {
    // ISO dates compare correctly as strings, which sidesteps every timezone
    // trap in doing this with Date objects.
    const latest = `${Number(reference.slice(0, 4)) + MAX_YEARS_AHEAD}${reference.slice(4)}`;
    if (weddingDate < reference) {
      fields.weddingDate = 'That date has already passed.';
    } else if (weddingDate > latest) {
      fields.weddingDate = `We take bookings up to ${MAX_YEARS_AHEAD} years ahead.`;
    }
  }

  const venue = text(source.venue);
  if (!venue) {
    fields.venue = 'Please tell us where the wedding is.';
  } else if (venue.length > FIELD_LIMITS.venue) {
    fields.venue = `Please keep this under ${FIELD_LIMITS.venue} characters.`;
  }

  let services = [];
  if (source.services === undefined || source.services === null) {
    services = [];
  } else if (!Array.isArray(source.services)) {
    fields.services = 'Please choose from the services offered.';
  } else {
    const chosen = source.services.map(text);
    if (chosen.some((service) => !SERVICES.includes(service))) {
      fields.services = 'Please choose from the services offered.';
    } else {
      services = SERVICES.filter((service) => chosen.includes(service));
    }
  }

  const message = text(source.message);
  if (message.length > FIELD_LIMITS.message) {
    fields.message = `Please keep this under ${FIELD_LIMITS.message} characters.`;
  }

  return {
    valid: Object.keys(fields).length === 0,
    fields,
    value: {
      name,
      email,
      phone,
      weddingDate,
      venue,
      services,
      message: message || null,
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run supabase/functions/_shared/__tests__/inquiry-validation.test.js
```

Expected: PASS, all cases.

- [ ] **Step 5: Teach ESLint about the Deno runtime**

`eslint.config.js` currently gives every `.js` file browser globals only, so `Deno.serve` would fail `no-undef`. Add this block to the exported array, after the existing Node-scripts block:

```js
  {
    // Supabase Edge Functions run on Deno. They get browser globals (fetch,
    // Response, crypto, TextEncoder are all present there) plus Deno itself.
    // _shared/ deliberately uses neither, so it can also run in the browser.
    files: ['supabase/functions/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, Deno: 'readonly' },
    },
  },
```

- [ ] **Step 6: Add the `@shared` alias so the browser can import the same module**

In `vite.config.js`, add the `node:url` import at the top and a `resolve` block. The full file becomes:

```js
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Validation rules are shared with the submit-inquiry Edge Function.
      // _shared/ is Supabase's convention for code a function depends on, so
      // pointing at it here costs nothing at deploy time and keeps one copy of
      // the rules instead of two that drift.
      '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    open: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})
```

- [ ] **Step 7: Verify the whole suite and lint, then commit**

```bash
npm run lint
npm test
```

Expected: lint exits 0 with at most the two known `useScrollReveal` warnings; the full suite passes including the new file.

```bash
git add supabase/functions/_shared eslint.config.js vite.config.js
git commit -m "feat: add the shared inquiry validation rules"
```

---

## Task 3: The Edge Function — validate, reject, insert

**Files:**
- Create: `supabase/functions/submit-inquiry/index.js`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `validateInquiry` from `../_shared/inquiry-validation.js`; the `public.inquiries` table.
- Produces: `POST /functions/v1/submit-inquiry`. Task 4 adds Turnstile and rate limiting to this same file; Task 5 adds email. Task 6 calls it from the browser.

**Request body** (JSON, camelCase): `name`, `email`, `phone`, `weddingDate`, `venue`, `services` (array of strings), `message`, `website` (honeypot, must be empty), `turnstileToken` (unused until Task 4).

**Response contract** — every response is JSON and carries CORS headers:

| Status | Body | Meaning |
| --- | --- | --- |
| 200 | `{ ok: true, id: "<uuid>" }` | Stored |
| 200 | `{ ok: true, id: null }` | Honeypot tripped; silently discarded |
| 400 | `{ ok: false, error: "MALFORMED_REQUEST" }` | Body was not JSON |
| 400 | `{ ok: false, error: "VALIDATION_FAILED", fields: { ... } }` | Per-field messages |
| 405 | `{ ok: false, error: "METHOD_NOT_ALLOWED" }` | Not POST |
| 500 | `{ ok: false, error: "SERVER_ERROR" }` | Insert failed |

- [ ] **Step 1: Write the function**

Create `supabase/functions/submit-inquiry/index.js`:

```js
// The only write path to public.inquiries.
//
// Anon has no insert privilege on that table (see the Phase 1b RLS migration),
// so this function — holding the service-role key, which bypasses RLS — is the
// single door. Client-side validation is a convenience, not a control; every
// rule is re-checked here.

import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import { validateInquiry } from '../_shared/inquiry-validation.js';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(requestOrigin) {
  // Unset means local development, where the dev server's origin varies.
  // Phase 4's deploy checklist sets ALLOWED_ORIGINS to the real domain.
  const allowOrigin = allowedOrigins.length === 0
    ? '*'
    : (allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0]);

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(status, body, requestOrigin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' },
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, origin);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false, error: 'MALFORMED_REQUEST' }, origin);
  }

  // Honeypot. A human never sees this field, so anything in it is a bot.
  // Answer 200 rather than an error: a rejection tells the bot what tripped it.
  if (typeof payload?.website === 'string' && payload.website.trim() !== '') {
    console.log('submit-inquiry: honeypot tripped, discarding');
    return json(200, { ok: true, id: null }, origin);
  }

  const { valid, fields, value } = validateInquiry(payload, { today: today() });
  if (!valid) {
    return json(400, { ok: false, error: 'VALIDATION_FAILED', fields }, origin);
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  );

  const { data, error } = await db
    .from('inquiries')
    .insert({
      name: value.name,
      email: value.email,
      phone: value.phone,
      wedding_date: value.weddingDate,
      venue: value.venue,
      services: value.services,
      message: value.message,
    })
    .select('id')
    .single();

  if (error) {
    // Log the reason for the operator, return a generic code to the browser —
    // database errors can carry schema detail that is not the public's to see.
    console.error('submit-inquiry: insert failed', error.message);
    return json(500, { ok: false, error: 'SERVER_ERROR' }, origin);
  }

  return json(200, { ok: true, id: data.id }, origin);
});
```

- [ ] **Step 2: Register the function with a JavaScript entrypoint**

Append to `supabase/config.toml`:

```toml
[functions.submit-inquiry]
# This project has no TypeScript, so the entrypoint is named explicitly rather
# than relying on the CLI's index.ts default.
entrypoint = "./functions/submit-inquiry/index.js"
verify_jwt = true
```

- [ ] **Step 3: Add the local serve script**

In `package.json`, add to `scripts`:

```json
    "db:functions": "supabase functions serve --env-file supabase/functions/.env.local",
```

- [ ] **Step 4: Create the function secrets template and a local copy**

Create `supabase/functions/.env.example`:

```bash
# Peak Story Studio — Edge Function secrets.
# Copy to supabase/functions/.env.local. That file is git-ignored; never commit it.
#
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
# Never add them here, and never put a service-role key in a VITE_ variable.

# Cloudflare Turnstile. These are Cloudflare's published test keys: they need no
# account and always pass, so local development runs with the captcha genuinely
# enabled. Replace both with real keys before deploying.
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

# Any non-empty string. Changing it invalidates existing rate-limit buckets.
RATE_LIMIT_SALT=local-development-salt
INQUIRY_RATE_LIMIT=5
INQUIRY_RATE_WINDOW_MINUTES=60

# Resend. Leave blank locally: the function then skips email and records
# notification_status='skipped' rather than failing the inquiry.
RESEND_API_KEY=
RESEND_FROM=
STUDIO_NOTIFY_EMAIL=

# Comma-separated CORS allowlist. Blank means allow any origin, which is fine
# locally. Phase 4 sets this to the real domain.
ALLOWED_ORIGINS=
```

Then create your own working copy — `.env*` is git-ignored, so this file will not be committed:

```bash
cp supabase/functions/.env.example supabase/functions/.env.local
```

Confirm it is ignored before going further:

```bash
git check-ignore -v supabase/functions/.env.local
```

Expected: a line naming the `.gitignore` rule. If the file is **not** ignored, stop and report it — do not commit it.

- [ ] **Step 5: Serve the function and prove a valid inquiry is stored**

The stack must be running (`npm run db:start`). Serve the function in the background — it never exits, so do not run it in the foreground:

```bash
nohup npm run db:functions > /tmp/fserve.log 2>&1 &
for i in $(seq 1 60); do
  curl -sf -o /dev/null http://127.0.0.1:54321/functions/v1/submit-inquiry -X OPTIONS && break
  sleep 1
done
```

Then submit:

```bash
eval "$(supabase status -o env | sed 's/^/export /')"
curl -s -w '\nHTTP %{http_code}\n' -X POST \
  "$API_URL/functions/v1/submit-inquiry" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ananya & Rohan","email":"couple@example.com","phone":"+91 98200 00000","weddingDate":"2027-02-14","venue":"Umaid Bhawan Palace","services":["Cinematic Film"],"message":"Three days."}'
```

Expected: `HTTP 200` and `{"ok":true,"id":"<uuid>"}`.

- [ ] **Step 6: Prove the row actually reached Postgres**

A 200 from the function is not evidence the row landed.

```bash
DB=$(docker ps --format '{{.Names}}' | grep supabase_db)
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "select name, email, wedding_date, venue, services, notification_status
     from public.inquiries where email = 'couple@example.com';"
```

Expected: exactly one row, `wedding_date` = `2027-02-14`, `services` = `{\"Cinematic Film\"}`, `notification_status` = `pending`.

- [ ] **Step 7: Prove the rejection paths**

```bash
eval "$(supabase status -o env | sed 's/^/export /')"
POST() { curl -s -w '\nHTTP %{http_code}\n' -X POST "$API_URL/functions/v1/submit-inquiry" \
  -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' -d "$1"; }

# Validation failure
POST '{"name":"A","email":"nope","phone":"","weddingDate":"","venue":""}'
# Honeypot
POST '{"name":"Bot","email":"bot@example.com","phone":"+911234567","weddingDate":"2027-02-14","venue":"X","website":"http://spam.example"}'
# Malformed body
curl -s -w '\nHTTP %{http_code}\n' -X POST "$API_URL/functions/v1/submit-inquiry" \
  -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' -d 'not json'
# Wrong method
curl -s -w '\nHTTP %{http_code}\n' "$API_URL/functions/v1/submit-inquiry" -H "Authorization: Bearer $ANON_KEY"
```

Expected in order: `HTTP 400` with `VALIDATION_FAILED` and a `fields` object naming `name`, `email`, `phone`, `weddingDate`, `venue`; `HTTP 200` with `"id":null`; `HTTP 400` with `MALFORMED_REQUEST`; `HTTP 405`.

Then confirm the honeypot submission wrote nothing:

```bash
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "select count(*) from public.inquiries where email = 'bot@example.com';"
```

Expected: `0`. Then clean up the probe row and stop the server:

```bash
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "delete from public.inquiries where email = 'couple@example.com';"
pkill -f 'supabase functions serve'
```

- [ ] **Step 8: Verify and commit**

```bash
npm run lint
npm test
```

Expected: both green.

```bash
git add supabase/functions/submit-inquiry supabase/functions/.env.example supabase/config.toml package.json
git commit -m "feat: add the submit-inquiry Edge Function"
```

---

## Task 4: Turnstile and rate limiting

**Files:**
- Create: `supabase/functions/_shared/turnstile.js`
- Create: `supabase/functions/_shared/__tests__/turnstile.test.js`
- Modify: `supabase/functions/submit-inquiry/index.js`

**Interfaces:**
- Consumes: `public.consume_inquiry_rate_limit(p_ip_hash, p_max_requests, p_window)` from Task 1; the function file from Task 3.
- Produces: `verifyTurnstile(token, remoteIp, { secret, fetchImpl })` returning `{ ok: true }` or `{ ok: false, reason }` where `reason` is one of `NOT_CONFIGURED`, `MISSING_TOKEN`, `VERIFY_UNAVAILABLE`, `REJECTED`.
- Adds two response codes to the contract: `403 { ok: false, error: "CAPTCHA_FAILED" }` and `429 { ok: false, error: "RATE_LIMITED", retryAfterSeconds: N }`, plus `500 { ok: false, error: "CAPTCHA_NOT_CONFIGURED" }`.

**Ordering inside the function:** honeypot, then Turnstile, then rate limit, then validation, then insert. Turnstile precedes the rate limit so that a flood of bot traffic is rejected before it can consume a real visitor's budget, and validation runs last so a spammer learns nothing about the field rules.

- [ ] **Step 1: Write the failing Turnstile tests**

Create `supabase/functions/_shared/__tests__/turnstile.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { verifyTurnstile, SITEVERIFY_URL } from '../turnstile.js';

function respondWith(body, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body });
}

describe('verifyTurnstile', () => {
  it('reports NOT_CONFIGURED when no secret is set, without calling out', async () => {
    const fetchImpl = respondWith({ success: true });
    const result = await verifyTurnstile('token', '1.2.3.4', { secret: '', fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'NOT_CONFIGURED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports MISSING_TOKEN when the browser sent none', async () => {
    const fetchImpl = respondWith({ success: true });
    const result = await verifyTurnstile('', '1.2.3.4', { secret: 's', fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'MISSING_TOKEN' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts the secret, token, and remote IP to Cloudflare', async () => {
    const fetchImpl = respondWith({ success: true });
    const result = await verifyTurnstile('tok', '1.2.3.4', { secret: 'sec', fetchImpl });
    expect(result).toEqual({ ok: true });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    expect(init.body.get('secret')).toBe('sec');
    expect(init.body.get('response')).toBe('tok');
    expect(init.body.get('remoteip')).toBe('1.2.3.4');
  });

  it('omits remoteip when the IP is unknown', async () => {
    const fetchImpl = respondWith({ success: true });
    await verifyTurnstile('tok', '', { secret: 'sec', fetchImpl });
    expect(fetchImpl.mock.calls[0][1].body.get('remoteip')).toBeNull();
  });

  it('reports REJECTED with the error codes when Cloudflare says no', async () => {
    const fetchImpl = respondWith({ success: false, 'error-codes': ['invalid-input-response'] });
    const result = await verifyTurnstile('tok', '', { secret: 'sec', fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('REJECTED');
    expect(result.codes).toEqual(['invalid-input-response']);
  });

  it('reports VERIFY_UNAVAILABLE on a non-2xx from Cloudflare', async () => {
    const fetchImpl = respondWith({}, false);
    const result = await verifyTurnstile('tok', '', { secret: 'sec', fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'VERIFY_UNAVAILABLE' });
  });

  it('reports VERIFY_UNAVAILABLE when the request throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await verifyTurnstile('tok', '', { secret: 'sec', fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'VERIFY_UNAVAILABLE' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run supabase/functions/_shared/__tests__/turnstile.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the Turnstile module**

Create `supabase/functions/_shared/turnstile.js`:

```js
// Cloudflare Turnstile server-side verification.
//
// fetch is injected so this can be tested without reaching the network. It is
// the only real spam control in the pipeline: the honeypot catches only naive
// bots, and the rate limit deliberately fails open.

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token, remoteIp, { secret, fetchImpl = fetch } = {}) {
  if (!secret) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (!token) return { ok: false, reason: 'MISSING_TOKEN' };

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);

  let response;
  try {
    response = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body });
  } catch {
    return { ok: false, reason: 'VERIFY_UNAVAILABLE' };
  }

  if (!response.ok) return { ok: false, reason: 'VERIFY_UNAVAILABLE' };

  const result = await response.json();
  if (result?.success) return { ok: true };

  return { ok: false, reason: 'REJECTED', codes: result?.['error-codes'] ?? [] };
}
```

- [ ] **Step 4: Run to verify the tests pass**

```bash
npx vitest run supabase/functions/_shared/__tests__/turnstile.test.js
```

Expected: PASS.

- [ ] **Step 5: Wire both controls into the function**

In `supabase/functions/submit-inquiry/index.js`, add to the imports:

```js
import { verifyTurnstile } from '../_shared/turnstile.js';
```

Add these helpers above `Deno.serve`:

```js
function clientIp(req) {
  // x-forwarded-for is a comma-separated chain; the first entry is the client.
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? '';
}

async function hashIp(ip) {
  const salt = Deno.env.get('RATE_LIMIT_SALT') ?? '';
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
```

Then insert this block into the handler, immediately after the honeypot check and before the `validateInquiry` call:

```js
  const ip = clientIp(req);

  const captcha = await verifyTurnstile(payload?.turnstileToken, ip, {
    secret: Deno.env.get('TURNSTILE_SECRET_KEY'),
  });
  if (!captcha.ok) {
    if (captcha.reason === 'NOT_CONFIGURED') {
      // Fail closed. An unconfigured captcha must never silently become an
      // open form; Cloudflare's published test keys make local setup free.
      console.error('submit-inquiry: TURNSTILE_SECRET_KEY is not set');
      return json(500, { ok: false, error: 'CAPTCHA_NOT_CONFIGURED' }, origin);
    }
    console.log('submit-inquiry: captcha rejected', captcha.reason);
    return json(403, { ok: false, error: 'CAPTCHA_FAILED' }, origin);
  }
```

And immediately after that, the rate-limit block. Note that `db` must now be constructed before this point — move the `createClient` call up so both the rate limit and the insert share one client:

```js
  const db = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  );

  // Fail open. With no readable IP, hashing a constant would drop every
  // visitor into one shared bucket and start turning paying customers away —
  // worse than admitting spam, which Turnstile has already filtered.
  if (ip) {
    const windowMinutes = Number(Deno.env.get('INQUIRY_RATE_WINDOW_MINUTES') ?? '60');
    const maxRequests = Number(Deno.env.get('INQUIRY_RATE_LIMIT') ?? '5');
    const { data: limit, error: limitError } = await db
      .rpc('consume_inquiry_rate_limit', {
        p_ip_hash: await hashIp(ip),
        p_max_requests: Number.isFinite(maxRequests) && maxRequests > 0 ? maxRequests : 5,
        p_window: `${Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : 60} minutes`,
      })
      .single();

    if (limitError) {
      console.error('submit-inquiry: rate limit check failed', limitError.message);
    } else if (limit && limit.allowed === false) {
      return json(
        429,
        { ok: false, error: 'RATE_LIMITED', retryAfterSeconds: limit.retry_after_seconds },
        origin,
      );
    }
  } else {
    console.warn('submit-inquiry: no client IP available, skipping rate limit');
  }
```

Delete the now-duplicated `createClient` call that Task 3 placed after validation.

- [ ] **Step 6: Prove the captcha is enforced**

Restart the function server so it picks up the changes, then:

```bash
eval "$(supabase status -o env | sed 's/^/export /')"
BODY='{"name":"Ananya & Rohan","email":"captcha@example.com","phone":"+91 98200 00000","weddingDate":"2027-02-14","venue":"Test"}'
POST() { curl -s -w '\nHTTP %{http_code}\n' -X POST "$API_URL/functions/v1/submit-inquiry" \
  -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' -d "$1"; }

# No token at all
POST "$BODY"
# With a token, against the always-pass test secret in .env.local
POST "$(printf '%s' "$BODY" | sed 's/}$/,"turnstileToken":"dummy"}/')"
```

Expected: the first returns `HTTP 403` with `CAPTCHA_FAILED`; the second returns `HTTP 200`.

Now prove it genuinely fails closed. Temporarily blank `TURNSTILE_SECRET_KEY` in `supabase/functions/.env.local`, restart the server, and repeat the second call.

Expected: `HTTP 500` with `CAPTCHA_NOT_CONFIGURED` — **not** a success. Restore the test secret and restart before continuing.

- [ ] **Step 7: Prove the rate limit trips and reports a retry window**

```bash
eval "$(supabase status -o env | sed 's/^/export /')"
for n in 1 2 3 4 5 6 7; do
  curl -s -o /dev/null -w "attempt $n: %{http_code}\n" -X POST \
    "$API_URL/functions/v1/submit-inquiry" \
    -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' \
    -d '{"name":"Rate Test","email":"rate@example.com","phone":"+91 98200 00000","weddingDate":"2027-02-14","venue":"Test","turnstileToken":"dummy"}'
done
```

Expected: the first five return `200`, then `429`. Confirm the body carries a usable retry window:

```bash
curl -s -X POST "$API_URL/functions/v1/submit-inquiry" \
  -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"name":"Rate Test","email":"rate@example.com","phone":"+91 98200 00000","weddingDate":"2027-02-14","venue":"Test","turnstileToken":"dummy"}'
```

Expected: `{"ok":false,"error":"RATE_LIMITED","retryAfterSeconds":<positive number>}`.

- [ ] **Step 8: Prove the ledger stores a hash, not an address**

```bash
DB=$(docker ps --format '{{.Names}}' | grep supabase_db)
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "select ip_hash, request_count from public.inquiry_rate_limits;"
```

Expected: `ip_hash` is a 64-character hex string containing no dots or colons. If anything resembling an IP address appears, stop — the hashing is not being applied.

Clean up:

```bash
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "delete from public.inquiries where email in ('captcha@example.com','rate@example.com');
   delete from public.inquiry_rate_limits;"
```

- [ ] **Step 9: Verify and commit**

```bash
npm run lint
npm test
```

```bash
git add supabase/functions
git commit -m "feat: enforce Turnstile and per-visitor rate limiting on inquiries"
```

---

## Task 5: Email — notify the studio, acknowledge the couple

**Files:**
- Create: `supabase/functions/_shared/email.js`
- Create: `supabase/functions/_shared/__tests__/email.test.js`
- Modify: `supabase/functions/submit-inquiry/index.js`

**Interfaces:**
- Consumes: the function file from Task 4; `public.inquiries.notification_status` from Task 1.
- Produces: `sendInquiryEmails(inquiry, { apiKey, fromAddress, studioEmail, fetchImpl })` returning `{ status }` where `status` is `'sent' | 'failed' | 'skipped'`. The `inquiry` argument is the validated `value` object plus an `id`.

**Rule:** the row is already saved before this runs. Nothing here may turn a saved lead into an error for the couple. The studio notification determines the recorded status; a failed acknowledgement to the couple is logged but does not mark the row failed, because the studio still has the lead.

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/_shared/__tests__/email.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { sendInquiryEmails, RESEND_URL } from '../email.js';

const INQUIRY = {
  id: '11111111-2222-3333-4444-555555555555',
  name: 'Ananya & Rohan',
  email: 'couple@example.com',
  phone: '+91 98200 00000',
  weddingDate: '2027-02-14',
  venue: 'Umaid Bhawan Palace',
  services: ['Cinematic Film'],
  message: 'Three days, two venues.',
};

const CONFIG = {
  apiKey: 'key',
  fromAddress: 'Studio <hello@example.com>',
  studioEmail: 'studio@example.com',
};

function okFetch() {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'sent' }) });
}

describe('sendInquiryEmails', () => {
  it.each([
    ['apiKey', { apiKey: '' }],
    ['fromAddress', { fromAddress: '' }],
    ['studioEmail', { studioEmail: '' }],
  ])('skips without sending when %s is missing', async (_name, override) => {
    const fetchImpl = okFetch();
    const result = await sendInquiryEmails(INQUIRY, { ...CONFIG, ...override, fetchImpl });
    expect(result.status).toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends the studio notification and the couple acknowledgement', async () => {
    const fetchImpl = okFetch();
    const result = await sendInquiryEmails(INQUIRY, { ...CONFIG, fetchImpl });
    expect(result.status).toBe('sent');
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const [studioUrl, studioInit] = fetchImpl.mock.calls[0];
    expect(studioUrl).toBe(RESEND_URL);
    expect(studioInit.headers.Authorization).toBe('Bearer key');
    const studioBody = JSON.parse(studioInit.body);
    expect(studioBody.to).toEqual(['studio@example.com']);
    expect(studioBody.reply_to).toBe('couple@example.com');
    expect(studioBody.html).toContain('Umaid Bhawan Palace');
    expect(studioBody.html).toContain('+91 98200 00000');

    const coupleBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(coupleBody.to).toEqual(['couple@example.com']);
  });

  it('escapes HTML in submitted values', async () => {
    const fetchImpl = okFetch();
    await sendInquiryEmails(
      { ...INQUIRY, venue: '<script>alert(1)</script>' },
      { ...CONFIG, fetchImpl },
    );
    const html = JSON.parse(fetchImpl.mock.calls[0][1].body).html;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('reports failed when the studio notification is rejected', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false, status: 422, text: async () => 'invalid from address',
    });
    const result = await sendInquiryEmails(INQUIRY, { ...CONFIG, fetchImpl });
    expect(result.status).toBe('failed');
  });

  it('reports failed rather than throwing when the request throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await sendInquiryEmails(INQUIRY, { ...CONFIG, fetchImpl });
    expect(result.status).toBe('failed');
  });

  it('still reports sent when only the couple acknowledgement fails', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'a' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' });
    const result = await sendInquiryEmails(INQUIRY, { ...CONFIG, fetchImpl });
    expect(result.status).toBe('sent');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run supabase/functions/_shared/__tests__/email.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the email module**

Create `supabase/functions/_shared/email.js`:

```js
// Resend transport for the two emails an inquiry generates.
//
// The inquiry row is already committed before this runs. Nothing in here may
// throw its way back to the couple: an email problem is the studio's problem,
// not a reason to tell someone their inquiry failed.

export const RESEND_URL = 'https://api.resend.com/emails';

const SEND_TIMEOUT_MS = 8000;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function row(label, value) {
  if (!value) return '';
  return `<tr><td style="padding:4px 12px 4px 0;font-weight:bold">${escapeHtml(label)}</td>` +
    `<td style="padding:4px 0">${escapeHtml(value)}</td></tr>`;
}

function studioHtml(inquiry) {
  return `<h2>New booking inquiry</h2><table>${
    row('Name', inquiry.name)
  }${row('Email', inquiry.email)
  }${row('Phone', inquiry.phone)
  }${row('Wedding date', inquiry.weddingDate)
  }${row('Venue', inquiry.venue)
  }${row('Services', (inquiry.services ?? []).join(', '))
  }</table><h3>Message</h3><p>${escapeHtml(inquiry.message || '(none)')}</p>` +
    `<p style="color:#666;font-size:12px">Inquiry ${escapeHtml(inquiry.id)}</p>`;
}

function coupleHtml(inquiry) {
  return `<p>Dear ${escapeHtml(inquiry.name)},</p>` +
    '<p>Thank you for your inquiry. We have it, and someone from the studio will reply ' +
    'personally within two working days.</p>' +
    `<p>For reference, you told us your wedding is on ${escapeHtml(inquiry.weddingDate)} ` +
    `at ${escapeHtml(inquiry.venue)}. If anything there is wrong, simply reply to this email.</p>` +
    '<p>— Peak Story Studio</p>';
}

async function send(payload, { apiKey, fetchImpl }) {
  const response = await fetchImpl(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend responded ${response.status}: ${detail}`);
  }

  return response.json();
}

export async function sendInquiryEmails(
  inquiry,
  { apiKey, fromAddress, studioEmail, fetchImpl = fetch } = {},
) {
  if (!apiKey || !fromAddress || !studioEmail) {
    console.warn('submit-inquiry: email not configured, skipping send');
    return { status: 'skipped' };
  }

  try {
    await send({
      from: fromAddress,
      to: [studioEmail],
      reply_to: inquiry.email,
      subject: `New inquiry — ${inquiry.name}, ${inquiry.weddingDate}`,
      html: studioHtml(inquiry),
    }, { apiKey, fetchImpl });
  } catch (error) {
    console.error('submit-inquiry: studio notification failed', error.message);
    return { status: 'failed' };
  }

  try {
    await send({
      from: fromAddress,
      to: [inquiry.email],
      reply_to: studioEmail,
      subject: 'We have your wedding inquiry',
      html: coupleHtml(inquiry),
    }, { apiKey, fetchImpl });
  } catch (error) {
    // The studio has the lead. Not acknowledging the couple is worth logging,
    // not worth marking the inquiry as un-notified.
    console.error('submit-inquiry: couple acknowledgement failed', error.message);
  }

  return { status: 'sent' };
}
```

- [ ] **Step 4: Run to verify the tests pass**

```bash
npx vitest run supabase/functions/_shared/__tests__/email.test.js
```

Expected: PASS.

- [ ] **Step 5: Wire email into the function**

In `supabase/functions/submit-inquiry/index.js`, add to the imports:

```js
import { sendInquiryEmails } from '../_shared/email.js';
```

Replace the final `return json(200, { ok: true, id: data.id }, origin);` with:

```js
  const { status } = await sendInquiryEmails(
    { ...value, id: data.id },
    {
      apiKey: Deno.env.get('RESEND_API_KEY'),
      fromAddress: Deno.env.get('RESEND_FROM'),
      studioEmail: Deno.env.get('STUDIO_NOTIFY_EMAIL'),
    },
  );

  const { error: statusError } = await db
    .from('inquiries')
    .update({ notification_status: status })
    .eq('id', data.id);

  if (statusError) {
    console.error('submit-inquiry: could not record notification status', statusError.message);
  }

  // The row is saved. Whatever happened to the email, this inquiry succeeded.
  return json(200, { ok: true, id: data.id }, origin);
```

- [ ] **Step 6: Prove the unconfigured path saves the lead and records it**

`RESEND_API_KEY` is blank in `.env.local`, so this is the degraded path. Restart the function server, then:

```bash
eval "$(supabase status -o env | sed 's/^/export /')"
curl -s -w '\nHTTP %{http_code}\n' -X POST "$API_URL/functions/v1/submit-inquiry" \
  -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"name":"Email Test","email":"email-test@example.com","phone":"+91 98200 00000","weddingDate":"2027-02-14","venue":"Test","turnstileToken":"dummy"}'

DB=$(docker ps --format '{{.Names}}' | grep supabase_db)
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "select notification_status from public.inquiries where email = 'email-test@example.com';"
```

Expected: `HTTP 200`, and `notification_status` = `skipped` — the lead is saved and the record shows the studio was never told.

Clean up:

```bash
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "delete from public.inquiries where email = 'email-test@example.com';
   delete from public.inquiry_rate_limits;"
pkill -f 'supabase functions serve'
```

- [ ] **Step 7: Verify and commit**

```bash
npm run lint
npm test
```

```bash
git add supabase/functions
git commit -m "feat: email the studio and acknowledge the couple on a new inquiry"
```

---

## Task 6: The client data-access layer

**Files:**
- Create: `src/lib/queries/inquiries.js`
- Create: `src/hooks/useInquirySubmission.js`
- Create: `src/hooks/useTurnstile.js`
- Create: `src/lib/queries/__tests__/inquiries.test.js`
- Create: `src/hooks/__tests__/useInquirySubmission.test.jsx`

**Interfaces:**
- Consumes: `supabase` and `isSupabaseConfigured` from `src/lib/supabase.js`; the Edge Function response contract from Tasks 3–5.
- Produces:
  - `src/lib/queries/inquiries.js` — `submitInquiry(payload)` resolving to `{ id }` or throwing `InquiryError`; `class InquiryError extends Error` with `code` and `fields`; `TURNSTILE_SITE_KEY`; `isInquiryBackendConfigured` (boolean).
  - `src/hooks/useInquirySubmission.js` — `useInquirySubmission()` returning `{ status, errorCode, fieldErrors, submit, reset }` where `status` is `'idle' | 'pending' | 'success' | 'error'`.
  - `src/hooks/useTurnstile.js` — `useTurnstile(siteKey)` returning `{ containerRef, token, ready, error, reset }`.
- Task 7 consumes all three.

**Constraint reminder:** components never import the Supabase client. This task is the only place that talks to it.

- [ ] **Step 1: Write the failing query-layer tests**

Create `src/lib/queries/__tests__/inquiries.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();

vi.mock('../../supabase', () => ({
  supabase: { functions: { invoke: (...args) => invoke(...args) } },
  isSupabaseConfigured: true,
}));

const PAYLOAD = {
  name: 'Ananya & Rohan',
  email: 'couple@example.com',
  phone: '+91 98200 00000',
  weddingDate: '2027-02-14',
  venue: 'Umaid Bhawan Palace',
  services: ['Cinematic Film'],
  message: '',
  website: '',
  turnstileToken: 'tok',
};

describe('submitInquiry', () => {
  beforeEach(() => {
    invoke.mockReset();
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    vi.resetModules();
  });

  it('invokes the submit-inquiry function with the payload', async () => {
    invoke.mockResolvedValue({ data: { ok: true, id: 'abc' }, error: null });
    const { submitInquiry } = await import('../inquiries.js');

    const result = await submitInquiry(PAYLOAD);

    expect(invoke).toHaveBeenCalledWith('submit-inquiry', { body: PAYLOAD });
    expect(result).toEqual({ id: 'abc' });
  });

  it('surfaces field errors from a 400 response', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          json: async () => ({ ok: false, error: 'VALIDATION_FAILED', fields: { email: 'bad' } }),
        },
      },
    });
    const { submitInquiry, InquiryError } = await import('../inquiries.js');

    const failure = await submitInquiry(PAYLOAD).catch((error) => error);

    expect(failure).toBeInstanceOf(InquiryError);
    expect(failure.code).toBe('VALIDATION_FAILED');
    expect(failure.fields).toEqual({ email: 'bad' });
  });

  it('falls back to NETWORK_ERROR when the error carries no readable body', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('failed to fetch') });
    const { submitInquiry } = await import('../inquiries.js');

    const failure = await submitInquiry(PAYLOAD).catch((error) => error);

    expect(failure.code).toBe('NETWORK_ERROR');
    expect(failure.fields).toEqual({});
  });

  it('throws SERVER_ERROR when the function answers 200 without ok', async () => {
    invoke.mockResolvedValue({ data: { ok: false }, error: null });
    const { submitInquiry } = await import('../inquiries.js');

    const failure = await submitInquiry(PAYLOAD).catch((error) => error);

    expect(failure.code).toBe('SERVER_ERROR');
  });

  it('reports the backend unconfigured when the Turnstile site key is missing', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    vi.resetModules();
    const { submitInquiry, isInquiryBackendConfigured } = await import('../inquiries.js');

    expect(isInquiryBackendConfigured).toBe(false);
    const failure = await submitInquiry(PAYLOAD).catch((error) => error);
    expect(failure.code).toBe('BACKEND_UNCONFIGURED');
    expect(invoke).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run src/lib/queries/__tests__/inquiries.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the query module**

Create `src/lib/queries/inquiries.js`:

```js
import { supabase, isSupabaseConfigured } from '../supabase';

// The widget cannot render without a site key, and the function refuses any
// request without a token, so an inquiry backend without this key is not a
// working one. Treated as part of being configured rather than as a separate
// failure the form would have to explain.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';

export const isInquiryBackendConfigured = isSupabaseConfigured && Boolean(TURNSTILE_SITE_KEY);

export class InquiryError extends Error {
  constructor(code, fields) {
    super(code);
    this.name = 'InquiryError';
    this.code = code;
    this.fields = fields ?? {};
  }
}

async function readErrorBody(error) {
  // supabase-js wraps a non-2xx as FunctionsHttpError and hangs the original
  // Response off .context. Other failures (DNS, offline) have no context.
  try {
    return await error?.context?.json?.();
  } catch {
    return null;
  }
}

export async function submitInquiry(payload) {
  if (!isInquiryBackendConfigured) {
    throw new InquiryError('BACKEND_UNCONFIGURED');
  }

  const { data, error } = await supabase.functions.invoke('submit-inquiry', { body: payload });

  if (error) {
    const body = await readErrorBody(error);
    throw new InquiryError(body?.error ?? 'NETWORK_ERROR', body?.fields);
  }

  if (!data?.ok) {
    throw new InquiryError(data?.error ?? 'SERVER_ERROR', data?.fields);
  }

  return { id: data.id ?? null };
}
```

- [ ] **Step 4: Run to verify the tests pass**

```bash
npx vitest run src/lib/queries/__tests__/inquiries.test.js
```

Expected: PASS.

- [ ] **Step 5: Write the failing submission-hook tests**

Create `src/hooks/__tests__/useInquirySubmission.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const submitInquiry = vi.fn();

vi.mock('../../lib/queries/inquiries', async () => {
  const actual = await vi.importActual('../../lib/queries/inquiries');
  return { ...actual, submitInquiry: (...args) => submitInquiry(...args) };
});

const { useInquirySubmission } = await import('../useInquirySubmission.js');
const { InquiryError } = await import('../../lib/queries/inquiries');

const PAYLOAD = { name: 'Ananya & Rohan', email: 'couple@example.com' };

describe('useInquirySubmission', () => {
  beforeEach(() => submitInquiry.mockReset());

  it('starts idle', () => {
    const { result } = renderHook(() => useInquirySubmission());
    expect(result.current.status).toBe('idle');
    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.errorCode).toBeNull();
  });

  it('goes pending then success', async () => {
    let resolve;
    submitInquiry.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useInquirySubmission());

    act(() => { result.current.submit(PAYLOAD); });
    await waitFor(() => expect(result.current.status).toBe('pending'));

    await act(async () => { resolve({ id: 'abc' }); });
    await waitFor(() => expect(result.current.status).toBe('success'));
  });

  it('captures the error code and field errors on failure', async () => {
    submitInquiry.mockRejectedValue(new InquiryError('VALIDATION_FAILED', { email: 'bad' }));
    const { result } = renderHook(() => useInquirySubmission());

    await act(async () => { await result.current.submit(PAYLOAD); });

    expect(result.current.status).toBe('error');
    expect(result.current.errorCode).toBe('VALIDATION_FAILED');
    expect(result.current.fieldErrors).toEqual({ email: 'bad' });
  });

  it('treats an unexpected throw as SERVER_ERROR rather than crashing', async () => {
    submitInquiry.mockRejectedValue(new TypeError('boom'));
    const { result } = renderHook(() => useInquirySubmission());

    await act(async () => { await result.current.submit(PAYLOAD); });

    expect(result.current.status).toBe('error');
    expect(result.current.errorCode).toBe('SERVER_ERROR');
  });

  it('returns true on success and false on failure', async () => {
    submitInquiry.mockResolvedValue({ id: 'abc' });
    const { result } = renderHook(() => useInquirySubmission());
    let outcome;
    await act(async () => { outcome = await result.current.submit(PAYLOAD); });
    expect(outcome).toBe(true);

    submitInquiry.mockRejectedValue(new InquiryError('RATE_LIMITED'));
    await act(async () => { outcome = await result.current.submit(PAYLOAD); });
    expect(outcome).toBe(false);
  });

  it('reset returns to idle and clears errors', async () => {
    submitInquiry.mockRejectedValue(new InquiryError('RATE_LIMITED'));
    const { result } = renderHook(() => useInquirySubmission());
    await act(async () => { await result.current.submit(PAYLOAD); });

    act(() => { result.current.reset(); });

    expect(result.current.status).toBe('idle');
    expect(result.current.errorCode).toBeNull();
    expect(result.current.fieldErrors).toEqual({});
  });
});
```

- [ ] **Step 6: Run to verify failure**

```bash
npx vitest run src/hooks/__tests__/useInquirySubmission.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 7: Write the submission hook**

Create `src/hooks/useInquirySubmission.js`:

```js
import { useCallback, useState } from 'react';
import { submitInquiry } from '../lib/queries/inquiries';

const IDLE = { status: 'idle', errorCode: null, fieldErrors: {} };

// Owns the whole lifecycle of one submission so BookingForm stays
// presentational. Returns true when the inquiry was stored, so the caller can
// decide what to celebrate without inspecting state that has not settled yet.
export function useInquirySubmission() {
  const [state, setState] = useState(IDLE);

  const submit = useCallback(async (payload) => {
    setState({ status: 'pending', errorCode: null, fieldErrors: {} });
    try {
      await submitInquiry(payload);
      setState({ status: 'success', errorCode: null, fieldErrors: {} });
      return true;
    } catch (error) {
      setState({
        status: 'error',
        errorCode: error?.code ?? 'SERVER_ERROR',
        fieldErrors: error?.fields ?? {},
      });
      return false;
    }
  }, []);

  const reset = useCallback(() => setState(IDLE), []);

  return { ...state, submit, reset };
}
```

- [ ] **Step 8: Run to verify the tests pass**

```bash
npx vitest run src/hooks/__tests__/useInquirySubmission.test.jsx
```

Expected: PASS.

- [ ] **Step 9: Write the Turnstile hook**

Create `src/hooks/useTurnstile.js`. There are no unit tests for this one: it is almost entirely an integration with a third-party script, and a test that mocks `window.turnstile` would assert only that the mock was called. Its real verification is Step 6 of Task 8.

```js
import { useCallback, useEffect, useRef, useState } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_ID = 'cf-turnstile-script';

function loadScript() {
  if (typeof document === 'undefined') return Promise.reject(new Error('no document'));

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) return existing.__loadPromise;

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  script.__loadPromise = new Promise((resolve, reject) => {
    script.addEventListener('load', resolve);
    script.addEventListener('error', () => reject(new Error('Turnstile script failed to load')));
  });
  document.head.appendChild(script);
  return script.__loadPromise;
}

// Renders the Turnstile widget into containerRef and hands back the token it
// produces. The token is single-use: Cloudflare rejects a replay, so the form
// resets the widget after every submission attempt.
export function useTurnstile(siteKey) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!siteKey) return undefined;

    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (value) => setToken(value),
          'expired-callback': () => setToken(''),
          'error-callback': () => {
            setToken('');
            setError('Verification is unavailable right now.');
          },
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError('Verification could not load.');
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  const reset = useCallback(() => {
    setToken('');
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  return { containerRef, token, ready, error, reset };
}
```

- [ ] **Step 10: Verify and commit**

```bash
npm run lint
npm test
```

Expected: green. `useTurnstile` reads `window.turnstile`, which ESLint knows through the browser globals already configured for `src/`.

```bash
git add src/lib/queries/inquiries.js src/hooks/useInquirySubmission.js src/hooks/useTurnstile.js src/lib/queries/__tests__ src/hooks/__tests__/useInquirySubmission.test.jsx
git commit -m "feat: add the inquiry submission data-access layer"
```

---

## Task 7: BookingForm and the WhatsApp button

**Files:**
- Create: `src/data/contact.js`
- Create: `src/components/WhatsAppButton.jsx`
- Create: `src/components/__tests__/WhatsAppButton.test.jsx`
- Create: `src/components/__tests__/BookingForm.test.jsx`
- Modify: `src/components/BookingForm.jsx`
- Modify: `docs/COMPONENTS.md`

**Interfaces:**
- Consumes: `useInquirySubmission`, `useTurnstile`, `isInquiryBackendConfigured`, `TURNSTILE_SITE_KEY`, and `validateInquiry` / `SERVICES` from `@shared/inquiry-validation.js`.
- Produces: `WhatsAppButton` (default export, props `message` optional).

**Behaviour required:**

1. Client-side validation runs through the shared `validateInquiry` on submit; per-field messages render inline beneath their input, and the invalid input gets `aria-invalid="true"` and `aria-describedby` pointing at its message.
2. While in flight the submit button is disabled and reads "Sending…".
3. Confetti fires **only** after the inquiry is confirmed stored.
4. On failure an error panel appears with copy chosen by error code, and it always offers the studio email address and, when configured, the WhatsApp button.
5. A honeypot input named `website` is present, visually hidden, `tabIndex={-1}`, `autoComplete="off"`, and `aria-hidden`.
6. When `isInquiryBackendConfigured` is false the form still validates but submitting shows the direct-contact panel rather than pretending to send.
7. The unused `guests` field is removed from form state — no control sets it and no column stores it.

- [ ] **Step 1: Create the contact module**

Create `src/data/contact.js`:

```js
// One home for the studio's contact details.
//
// None of these have been confirmed by the studio yet — they arrived with the
// seeded template. Centralising them means Phase 7's truthful-content pass has
// a single file to correct instead of a hunt through components. Tracked as
// PS-028 in docs/KNOWN-ISSUES.md.
export const STUDIO_PHONE = '+91 98200 37027';
export const STUDIO_EMAIL = 'inquiries@peakstorystudio.com';
export const STUDIO_ADDRESS = '241 Laxmi Plaza, Andheri (W), Mumbai, India';

// Digits only, country code first, e.g. 919820037027. Unset means the
// WhatsApp button does not render at all, so no unconfirmed number ships.
export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER ?? '';
```

`PS-028` does not exist yet — the highest identifier in the register today is `PS-025`. Task 8 Step 7 files it, along with `PS-026` and `PS-027`. Leave the comment as written.

- [ ] **Step 2: Write the failing WhatsAppButton test**

Create `src/components/__tests__/WhatsAppButton.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('WhatsAppButton', () => {
  beforeEach(() => vi.resetModules());

  it('renders nothing when no number is configured', async () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '');
    const { default: WhatsAppButton } = await import('../WhatsAppButton.jsx');
    const { container } = render(<WhatsAppButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('links to wa.me with the number and an encoded message', async () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '919820037027');
    const { default: WhatsAppButton } = await import('../WhatsAppButton.jsx');
    render(<WhatsAppButton message="Hello there" />);

    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('href', 'https://wa.me/919820037027?text=Hello%20there');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
```

- [ ] **Step 3: Run to verify failure, then write the component**

```bash
npx vitest run src/components/__tests__/WhatsAppButton.test.jsx
```

Expected: FAIL — module not found.

Create `src/components/WhatsAppButton.jsx`:

```jsx
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../data/contact';

const DEFAULT_MESSAGE = "Hello Peak Story Studio, I'd like to ask about wedding coverage.";

// wa.me needs no API, no approval, and no fee — the WhatsApp Business API is
// deliberately out of scope. Renders nothing when unconfigured, so the site
// never ships a number the studio has not confirmed.
export default function WhatsAppButton({ message = DEFAULT_MESSAGE, className = '' }) {
  if (!WHATSAPP_NUMBER) return null;

  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-full border border-pitch-900/20 bg-offwhite-50 text-pitch-900 text-xs uppercase tracking-widest font-semibold hover:bg-offwhite-100 transition-all ${className}`}
    >
      <MessageCircle className="w-4 h-4" />
      <span>Chat on WhatsApp</span>
    </a>
  );
}
```

Re-run the test. Expected: PASS.

- [ ] **Step 4: Write the failing BookingForm tests**

Create `src/components/__tests__/BookingForm.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const submit = vi.fn();
const reset = vi.fn();
let hookState = { status: 'idle', errorCode: null, fieldErrors: {} };

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('../../hooks/useInquirySubmission', () => ({
  useInquirySubmission: () => ({ ...hookState, submit, reset }),
}));

vi.mock('../../hooks/useTurnstile', () => ({
  useTurnstile: () => ({
    containerRef: { current: null },
    token: 'test-token',
    ready: true,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../../lib/queries/inquiries', () => ({
  isInquiryBackendConfigured: true,
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
}));

const { default: BookingForm } = await import('../BookingForm.jsx');

async function fillValidForm(user) {
  await user.type(screen.getByLabelText(/couple \/ contact name/i), 'Ananya & Rohan');
  await user.type(screen.getByLabelText(/email address/i), 'couple@example.com');
  await user.type(screen.getByLabelText(/phone number/i), '+91 98200 00000');
  // jsdom sanitises a date input's value on every keystroke, so typing an ISO
  // date one character at a time leaves it empty. Set it in one go.
  fireEvent.change(screen.getByLabelText(/wedding date/i), { target: { value: '2027-02-14' } });
  await user.type(screen.getByLabelText(/event location/i), 'Umaid Bhawan Palace');
}

describe('BookingForm', () => {
  beforeEach(async () => {
    submit.mockReset().mockResolvedValue(true);
    reset.mockReset();
    hookState = { status: 'idle', errorCode: null, fieldErrors: {} };
    // Shared across tests because the module is mocked once. Without this, a
    // later test asserting confetti has NOT fired sees an earlier test's call.
    const confetti = (await import('canvas-confetti')).default;
    confetti.mockClear();
  });

  it('shows inline validation and does not submit when fields are invalid', async () => {
    const user = userEvent.setup();
    render(<BookingForm />);

    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));

    expect(await screen.findByText(/we need an email address/i)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits a valid inquiry with the honeypot empty and the captcha token', async () => {
    const user = userEvent.setup();
    render(<BookingForm />);
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({
      name: 'Ananya & Rohan',
      email: 'couple@example.com',
      venue: 'Umaid Bhawan Palace',
      weddingDate: '2027-02-14',
      website: '',
      turnstileToken: 'test-token',
    });
  });

  it('disables the button and shows sending while in flight', () => {
    hookState = { status: 'pending', errorCode: null, fieldErrors: {} };
    render(<BookingForm />);

    const button = screen.getByRole('button', { name: /sending/i });
    expect(button).toBeDisabled();
  });

  it('fires confetti only after a confirmed submission', async () => {
    const confetti = (await import('canvas-confetti')).default;
    const user = userEvent.setup();
    render(<BookingForm />);
    await fillValidForm(user);

    expect(confetti).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));

    await waitFor(() => expect(confetti).toHaveBeenCalled());
  });

  it('does not fire confetti or show success when submission fails', async () => {
    const confetti = (await import('canvas-confetti')).default;
    submit.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<BookingForm />);
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(confetti).not.toHaveBeenCalled();
    expect(screen.queryByText(/inquiry received/i)).not.toBeInTheDocument();
  });

  it.each([
    ['RATE_LIMITED', /too many/i],
    ['CAPTCHA_FAILED', /verification/i],
    ['NETWORK_ERROR', /could not reach/i],
    ['BACKEND_UNCONFIGURED', /not accepting/i],
  ])('explains %s and always offers a way through', async (code, pattern) => {
    hookState = { status: 'error', errorCode: code, fieldErrors: {} };
    render(<BookingForm />);

    expect(screen.getByText(pattern)).toBeInTheDocument();
    // A mailto link, not just the address as text — the left-hand contact
    // column already renders it as plain text, so asserting on the text alone
    // would pass even with the error panel's fallback missing entirely.
    const mailto = screen.getByRole('link', { name: /inquiries@peakstorystudio\.com/i });
    expect(mailto).toHaveAttribute('href', 'mailto:inquiries@peakstorystudio.com');
  });

  it('renders server field errors returned by the function', () => {
    hookState = {
      status: 'error',
      errorCode: 'VALIDATION_FAILED',
      fieldErrors: { email: 'That email address does not look right.' },
    };
    render(<BookingForm />);

    expect(screen.getByText(/that email address does not look right/i)).toBeInTheDocument();
  });

  it('shows the success panel when the submission succeeded', () => {
    hookState = { status: 'success', errorCode: null, fieldErrors: {} };
    render(<BookingForm />);

    expect(screen.getByText(/inquiry received/i)).toBeInTheDocument();
  });

  it('keeps a hidden honeypot out of the tab order', () => {
    const { container } = render(<BookingForm />);
    const honeypot = container.querySelector('input[name="website"]');

    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot).toHaveAttribute('autocomplete', 'off');
  });
});
```

- [ ] **Step 5: Run to verify failure**

```bash
npx vitest run src/components/__tests__/BookingForm.test.jsx
```

Expected: FAIL — the current form has no labels wired to inputs, no honeypot, and submits unconditionally.

- [ ] **Step 6: Rewrite BookingForm**

Keep the existing section shell, headings, palette classes, and the left-hand contact column exactly as they are, except that the contact column now reads its values from `src/data/contact.js` instead of literal strings, and the WhatsApp button is added below the address block. Make these changes:

Replace the imports and the top of the component with:

```jsx
import React, { useState } from 'react';
import { Calendar, MapPin, Send, CheckCircle2, Phone, Mail, User, AlertTriangle, Loader2 } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import confetti from 'canvas-confetti';
import WhatsAppButton from './WhatsAppButton';
import { useInquirySubmission } from '../hooks/useInquirySubmission';
import { useTurnstile } from '../hooks/useTurnstile';
import { isInquiryBackendConfigured, TURNSTILE_SITE_KEY } from '../lib/queries/inquiries';
import { STUDIO_PHONE, STUDIO_EMAIL, STUDIO_ADDRESS } from '../data/contact';
import { validateInquiry, SERVICES } from '@shared/inquiry-validation.js';

const ERROR_COPY = {
  VALIDATION_FAILED: 'Some details need another look — see the notes above.',
  RATE_LIMITED: 'Too many inquiries from this connection just now. Please wait a few minutes, or reach us directly.',
  CAPTCHA_FAILED: 'The verification check did not pass. Please reload the page and try again.',
  CAPTCHA_NOT_CONFIGURED: 'The form is temporarily unavailable. Please reach us directly.',
  BACKEND_UNCONFIGURED: 'The form is not accepting inquiries at the moment. Please reach us directly.',
  NETWORK_ERROR: 'We could not reach the studio just now. Please check your connection, or reach us directly.',
  SERVER_ERROR: 'Something went wrong on our side. Please reach us directly and we will pick it up.',
};

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  weddingDate: '',
  venue: '',
  services: ['Cinematic Film', 'Fine Art Photography'],
  message: '',
  website: '',
};

export default function BookingForm() {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [clientErrors, setClientErrors] = useState({});
  const { status, errorCode, fieldErrors, submit, reset } = useInquirySubmission();
  const turnstile = useTurnstile(TURNSTILE_SITE_KEY);

  const errors = { ...clientErrors, ...fieldErrors };
  const isSending = status === 'pending';

  const handleServiceToggle = (service) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Same rules the Edge Function applies, from the same module, so an inline
    // message can never contradict what the server accepts.
    const { valid, fields } = validateInquiry(formData, {
      today: new Date().toISOString().slice(0, 10),
    });
    setClientErrors(fields);
    if (!valid) return;

    const stored = await submit({ ...formData, turnstileToken: turnstile.token });

    // The token is single-use; Cloudflare rejects a replay either way.
    turnstile.reset();

    if (stored) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#0a0a0a', '#262626', '#d5cfc2', '#ffffff'],
      });
    }
  };

  const startOver = () => {
    setFormData(EMPTY_FORM);
    setClientErrors({});
    reset();
  };
```

Add a small field-error renderer alongside the component (above `export default`):

```jsx
function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-xs font-semibold text-charcoal-700">
      {message}
    </p>
  );
}
```

In the JSX:

- Replace the three literal contact values in the left column with `{STUDIO_PHONE}`, `{STUDIO_EMAIL}`, and `{STUDIO_ADDRESS}`.
- Add `<WhatsAppButton className="mt-2" />` at the end of the left column's `space-y-6` block.
- Change the success condition from `submitted ?` to `status === 'success' ?`, and point the "Submit Another Inquiry" button's `onClick` at `startOver`. Change `{formData.name}` in the success copy to keep working — it does, because the form data is only cleared by `startOver`.
- Give every input an `id` and wire its `<label>` with `htmlFor`, since the tests (and screen readers) locate fields by label. Use `id="inquiry-name"`, `inquiry-email`, `inquiry-phone`, `inquiry-date`, `inquiry-venue`, `inquiry-message`.
- Rename `formData.date` to `formData.weddingDate` and `formData.location` to `formData.venue` throughout, to match the shared validator and the request contract.
- Replace the hard-coded services array in the `.map(...)` with `SERVICES`.
- On each input add `aria-invalid={Boolean(errors.<field>)}` and `aria-describedby={errors.<field> ? '<id>-error' : undefined}`, and render `<FieldError id="<id>-error" message={errors.<field>} />` directly beneath it.
- Add the honeypot immediately inside the `<form>`:

```jsx
                    {/* Not visible to people. Anything typed here came from a bot. */}
                    <div className="absolute w-px h-px -m-px overflow-hidden" aria-hidden="true">
                      <input
                        type="text"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      />
                    </div>
```

- Add the Turnstile widget mount point just above the submit button, rendered only when the backend is configured:

```jsx
                    {isInquiryBackendConfigured && (
                      <div>
                        <div ref={turnstile.containerRef} />
                        {turnstile.error && (
                          <p role="alert" className="mt-2 text-xs font-semibold text-charcoal-700">
                            {turnstile.error}
                          </p>
                        )}
                      </div>
                    )}
```

- Replace the submit button with a disabled-aware version:

```jsx
                    <button
                      type="submit"
                      disabled={isSending}
                      className="w-full py-4 rounded-xl bg-pitch-900 text-offwhite-50 font-extrabold uppercase tracking-[0.25em] text-xs hover:bg-pitch-800 hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending…</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Send Booking Inquiry</span>
                        </>
                      )}
                    </button>
```

- Add the failure panel directly below the submit button, inside the form:

```jsx
                    {status === 'error' && (
                      <div role="alert" className="rounded-xl border border-pitch-900/20 bg-offwhite-100 p-5 space-y-4">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-pitch-900 shrink-0 mt-0.5" />
                          <p className="text-sm text-pitch-900">
                            {ERROR_COPY[errorCode] ?? ERROR_COPY.SERVER_ERROR}
                          </p>
                        </div>
                        <p className="text-sm text-charcoal-700">
                          Email us at{' '}
                          <a href={`mailto:${STUDIO_EMAIL}`} className="font-bold text-pitch-900 underline">
                            {STUDIO_EMAIL}
                          </a>{' '}
                          and we will reply to your inquiry directly.
                        </p>
                        <WhatsAppButton />
                      </div>
                    )}
```

Note the `overflow-hidden` already on the outer `<section>`: the honeypot wrapper uses `absolute`, so give the `<form>` element `relative` alongside its existing `space-y-6` class.

- [ ] **Step 7: Run the form tests until they pass**

```bash
npx vitest run src/components/__tests__/BookingForm.test.jsx
```

Expected: PASS, all cases.

- [ ] **Step 8: Document the components**

In `docs/COMPONENTS.md`, add a `WhatsAppButton` entry (props, the env variable that controls it, the fact that it renders nothing when unset) and update the `BookingForm` entry to describe real submission, the pending and error states, the honeypot, and the Turnstile widget. `npm run check:docs` fails if `WhatsAppButton` is missing.

- [ ] **Step 9: Verify and commit**

```bash
npm run lint
npm test
npm run check:docs
```

```bash
git add src/components src/data/contact.js docs/COMPONENTS.md
git commit -m "feat: submit booking inquiries for real, with pending and failure states"
```

---

## Task 8: End-to-end gate, environment templates, CI, and documentation

**Files:**
- Create: `scripts/verify-inquiry.mjs`
- Modify: `package.json`, `.env.example`, `.github/workflows/ci.yml`, `README.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/KNOWN-ISSUES.md`

**Interfaces:**
- Consumes: everything built in Tasks 1–7.
- Produces: `npm run verify:inquiry`.

This is the highest-value check in the project: it exercises the one path where a failure costs the business money.

- [ ] **Step 1: Write the end-to-end verification script**

Create `scripts/verify-inquiry.mjs`:

```js
#!/usr/bin/env node
// End-to-end gate for the inquiry pipeline.
//
// Posts to the running submit-inquiry function and asserts against Postgres
// directly, because a 200 from the function is not evidence that a row landed.
// Requires the local stack (npm run db:start) and the function server
// (npm run db:functions) to be running.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error(
    'Missing credentials. supabase status names them API_URL/ANON_KEY/SERVICE_ROLE_KEY;\n' +
    'this script reads SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY. Map them:\n' +
    '  eval "$(supabase status -o env | sed \'s/^/export /\')"\n' +
    '  export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"',
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const endpoint = `${url}/functions/v1/submit-inquiry`;
const probeEmail = 'verify-inquiry-probe@example.invalid';

const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

function payload(overrides = {}) {
  return {
    name: 'Verify Probe',
    email: probeEmail,
    phone: '+91 98200 00000',
    weddingDate: '2027-02-14',
    venue: 'Verification Venue',
    services: ['Cinematic Film'],
    message: 'Automated end-to-end probe.',
    website: '',
    turnstileToken: 'verify-probe',
    ...overrides,
  };
}

async function post(body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  return { status: response.status, body: parsed };
}

async function clean() {
  await admin.from('inquiries').delete().eq('email', probeEmail);
  await admin.from('inquiries').delete().eq('email', `bot-${probeEmail}`);
  await admin.from('inquiry_rate_limits').delete().neq('ip_hash', '');
}

async function main() {
  console.log('verify:inquiry — end-to-end check of the booking pipeline\n');

  try {
    await fetch(endpoint, { method: 'OPTIONS' });
  } catch {
    console.error(`Cannot reach ${endpoint}. Is "npm run db:functions" running?`);
    process.exit(1);
  }

  await clean();

  console.log('a valid inquiry');
  const stored = await post(payload());
  check('returns HTTP 200', stored.status === 200, `got ${stored.status}`);
  check('reports ok with an id', Boolean(stored.body?.ok && stored.body?.id));

  const { data: rows, error } = await admin
    .from('inquiries')
    .select('name, email, phone, wedding_date, venue, services, message, status, notification_status')
    .eq('email', probeEmail);

  check('reached Postgres as exactly one row', !error && rows?.length === 1, error?.message ?? `${rows?.length} rows`);

  const row = rows?.[0];
  if (row) {
    check('stored the name', row.name === 'Verify Probe', row.name);
    check('stored the phone', row.phone === '+91 98200 00000', row.phone);
    check('stored the wedding date without a timezone shift', row.wedding_date === '2027-02-14', row.wedding_date);
    check('stored the venue', row.venue === 'Verification Venue', row.venue);
    check('stored the services array', JSON.stringify(row.services) === JSON.stringify(['Cinematic Film']), JSON.stringify(row.services));
    check('defaulted status to new', row.status === 'new', row.status);
    check(
      'recorded a notification outcome',
      ['sent', 'failed', 'skipped'].includes(row.notification_status),
      row.notification_status,
    );
  }

  console.log('\nan invalid inquiry');
  const invalid = await post(payload({ email: 'not-an-email', phone: '' }));
  check('returns HTTP 400', invalid.status === 400, `got ${invalid.status}`);
  check('names VALIDATION_FAILED', invalid.body?.error === 'VALIDATION_FAILED');
  check('reports the offending fields', Boolean(invalid.body?.fields?.email && invalid.body?.fields?.phone));

  console.log('\na bot filling the honeypot');
  const bot = await post(payload({ email: `bot-${probeEmail}`, website: 'http://spam.example' }));
  check('answers 200 so the bot learns nothing', bot.status === 200);
  check('stores no row', bot.body?.id === null);
  const { count } = await admin
    .from('inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('email', `bot-${probeEmail}`);
  check('really stored nothing', count === 0, `${count} rows`);

  console.log('\nrepeated submissions');
  await admin.from('inquiry_rate_limits').delete().neq('ip_hash', '');
  let limited = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await post(payload());
    if (response.status === 429) {
      limited = response;
      break;
    }
  }
  check('eventually returns HTTP 429', limited !== null);
  check('names RATE_LIMITED', limited?.body?.error === 'RATE_LIMITED');
  check(
    'tells the caller when to retry',
    Number.isFinite(limited?.body?.retryAfterSeconds) && limited.body.retryAfterSeconds > 0,
    String(limited?.body?.retryAfterSeconds),
  );

  await clean();

  console.log('');
  if (failures.length > 0) {
    console.error(`verify:inquiry FAILED — ${failures.length} check(s): ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('verify:inquiry passed — a booking inquiry reaches the database.');
}

main().catch(async (error) => {
  console.error('verify:inquiry crashed:', error.message);
  await clean().catch(() => {});
  process.exit(1);
});
```

- [ ] **Step 2: Add the script and run it**

In `package.json`, add to `scripts`:

```json
    "verify:inquiry": "node scripts/verify-inquiry.mjs",
```

With the stack and function server running:

```bash
eval "$(supabase status -o env | sed 's/^/export /')"
export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
npm run verify:inquiry
```

Expected: every check prints `ok` and the script exits 0.

- [ ] **Step 3: Prove the gate can actually fail**

A check that cannot fail is not a check. Temporarily break the insert — in `supabase/functions/submit-inquiry/index.js`, change the inserted `venue: value.venue` to `venue: 'WRONG'` — restart the function server, and re-run `npm run verify:inquiry`.

Expected: `FAIL  stored the venue` and a non-zero exit. **Restore the line and re-run to confirm green before continuing.**

- [ ] **Step 4: Update the browser environment template**

Add to `.env.example`:

```bash
# Phase 2 onward: Cloudflare Turnstile. This is Cloudflare's published test site
# key — it needs no account and always passes, so the form works locally out of
# the box. Replace with a real key before deploying.
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA

# Phase 2 onward: WhatsApp click-to-chat. Digits only, country code first
# (e.g. 919820037027). Leave blank and no WhatsApp button renders — which is
# the right default until the studio confirms its number.
VITE_WHATSAPP_NUMBER=
```

- [ ] **Step 5: Add the end-to-end job to CI**

Add a job to `.github/workflows/ci.yml`. Keep the existing self-diagnosing pattern — GitHub's log endpoint needs auth and returns 403, but check-run annotations are public, so every failure must be funnelled into a `::error::` annotation. Match the style of the jobs already in the file.

```yaml
  inquiry-e2e:
    name: Inquiry end-to-end
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - name: Start Supabase
        run: supabase start || { echo "::error::supabase start failed"; exit 1; }
      - name: Serve the Edge Function
        run: |
          cp supabase/functions/.env.example supabase/functions/.env.local
          nohup npm run db:functions > /tmp/functions.log 2>&1 &
          for i in $(seq 1 60); do
            curl -sf -o /dev/null -X OPTIONS \
              http://127.0.0.1:54321/functions/v1/submit-inquiry && exit 0
            sleep 2
          done
          echo "::error::Edge Function did not become ready in 120s"
          cat /tmp/functions.log
          exit 1
      - name: Verify a booking inquiry reaches the database
        run: |
          eval "$(supabase status -o env | sed 's/^/export /')"
          export SUPABASE_URL="$API_URL"
          export SUPABASE_ANON_KEY="$ANON_KEY"
          export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
          npm run verify:inquiry || {
            echo "::error::A booking inquiry did not reach the database"
            cat /tmp/functions.log
            exit 1
          }
```

- [ ] **Step 6: Verify the form by hand in a browser**

Automated tests mock Turnstile; nothing so far has proved the real widget renders and yields a token. Do this once:

```bash
cp .env.example .env.local
eval "$(supabase status -o env | sed 's/^/export /')"
printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_ANON_KEY=%s\n' "$API_URL" "$ANON_KEY" >> .env.local
nohup npm run dev > /tmp/dev.log 2>&1 &
until curl -sf http://localhost:3000 > /dev/null; do sleep 1; done
```

Open `http://localhost:3000/#contact`, fill the form, and submit. Confirm: the Turnstile widget appears, the button reads "Sending…" while in flight, confetti fires on success, and the row is in the database:

```bash
DB=$(docker ps --format '{{.Names}}' | grep supabase_db)
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "select name, email, venue, notification_status from public.inquiries order by created_at desc limit 3;"
```

Then submit again with a deliberately bad email to confirm the inline message appears and nothing is sent. Clean up:

```bash
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "delete from public.inquiries where created_at > now() - interval '1 hour';
   delete from public.inquiry_rate_limits;"
```

Report in the task report what you saw, including anything that looked wrong even if it did not fail a check.

- [ ] **Step 7: Update the documentation**

- `README.md` — a "Running the inquiry pipeline locally" section: `npm run db:start`, copy both env templates, `npm run db:functions` in a second terminal, `npm run dev`, and `npm run verify:inquiry` to check it end to end. State plainly that Resend is unconfigured locally, so no email is sent and inquiries are recorded `notification_status='skipped'`.
- `docs/ARCHITECTURE.md` — the inquiry write path (browser → Edge Function → Postgres → Resend), why the function is the only write path, and the `@shared` alias with the reason one validation module is shared by both sides.
- `docs/ROADMAP.md` — mark `v0.3` / Phase 2 delivered.
- `docs/KNOWN-ISSUES.md` — two changes.

  Move **`PS-003`** ("Booking form reports success unconditionally; submissions are discarded", High, planned phase 2) out of the open table and into the `## Resolved` section, matching the format the existing resolved entries use — a bolded identifier and title, then what actually changed and where. This phase is what closes it.

  Then add three new rows to the open table. `PS-025` is the highest identifier in the register today, so these take the next three:

  | ID | Issue | Severity | Location | Planned phase |
  | --- | --- | --- | --- | --- |
  | `PS-026` | The booking form requires a firm wedding date and venue, so a couple still choosing either cannot inquire at all | Medium | `supabase/functions/_shared/inquiry-validation.js`, `src/components/BookingForm.jsx` | 7 |
  | `PS-027` | `ALLOWED_ORIGINS` unset makes the `submit-inquiry` function accept any origin; harmless locally, must be set before the site is public | Low | `supabase/functions/submit-inquiry/index.js` | 4 |
  | `PS-028` | Studio phone, email, and postal address are unconfirmed, inherited from the seeded template | Medium | `src/data/contact.js` | 7 |

  Write the wording in the register's own voice rather than pasting these cells verbatim; what matters is that the identifiers, severities, locations, and planned phases match.

- [ ] **Step 8: Final verification and commit**

```bash
npm run lint
npm test
npm run check:docs
npm run build
```

Expected: all four green. Note that `npm run build` leaves `dist/` dirty because it is both committed and git-ignored (`PS-019`); clean up with `git checkout -- dist/` then `git clean -fx dist/` and do **not** commit `dist/` changes.

```bash
git add scripts/verify-inquiry.mjs package.json .env.example .github/workflows/ci.yml README.md docs/
git commit -m "feat: gate the inquiry pipeline end to end and document it"
```

---

## Notes for the reviewer

Areas worth particular attention:

- **The rate limiter must roll its window.** A limiter that blocks forever after five submissions is worse than none. Task 1 Step 4 proves the roll.
- **The captcha must fail closed and the rate limit must fail open.** These are deliberately opposite. Task 4 Step 6 proves the first by blanking the secret.
- **A saved lead must never surface as an error.** Email runs after the insert and its outcome only ever lands in `notification_status`.
- **The rate-limit ledger must never contain a raw IP.** Task 4 Step 8 inspects the stored value.
- **Confetti must not fire on failure.** The original form's defect was celebrating unconditionally; the test asserting this is the one that matters most.
- **`npm run verify:inquiry` must be capable of failing.** Task 8 Step 3 proves it by breaking the insert on purpose.
