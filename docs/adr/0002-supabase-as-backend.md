# 0002. Supabase as backend

## Status

Accepted

## Context

Peak Story Studio has no backend today. Wedding stories, photos, films, and testimonials are
hardcoded in `src/data/weddingData.js`; the "client portal" accepts any four-digit PIN and shows
every photo to whoever enters it; and the booking form discards every submission it receives
(see [KNOWN-ISSUES.md](../KNOWN-ISSUES.md)). This is a real business taking real bookings, so it
needs genuine persistence for content, genuine authentication for the admin and, later, for
clients, private storage for client media that strangers cannot browse, and backups — all at low
ongoing operational cost, because the project is maintained by one person with no ops team and
no budget for one.

## Decision

Supabase is the backend platform: managed Postgres for content and inquiries, Supabase Auth for
the admin account and later client sign-in, Supabase Storage for media, and Row Level Security
(RLS) enforced in the database for every access rule.

Alternatives considered and rejected:

- **Firebase.** Its document model fits this content poorly — weddings, their photos, and their
  ordering are inherently relational, and modeling that in a document store means either deep
  nesting or manual denormalization that Postgres gives for free with foreign keys and joins.
  Firebase also locks queries into its own client SDK query language rather than SQL, which
  makes the data layer harder to reason about and harder to move away from later.
- **Hand-rolled Express and Postgres.** This would give full control but shifts every operational
  concern onto the owner: standing up and patching a server, implementing authentication and
  session handling correctly, writing and running migrations, and managing backups. For a
  one-person team, that ops burden is exactly what a managed platform exists to remove.

## Consequences

Content and inquiries live in Postgres with RLS enabled on every table. Because RLS is enforced
by the database itself rather than trusted to application code, the anonymous (`anon`) key can
be shipped in the browser bundle safely: it only grants what the RLS policies allow — reading
published content, nothing else — and the `inquiries` table grants the anon key no access at
all, so the key alone cannot be used to scrape leads or write spam rows. The service-role key,
which bypasses RLS, is confined to server-side Edge Functions and never reaches the browser (see
[the end-to-end platform design spec, section 2](../superpowers/specs/2026-07-30-end-to-end-platform-design.md#2-decisions)).

The free tier caps Storage at 1 GB, which is not enough for high-resolution client wedding
galleries. That cap is what forces the Phase 3 media storage decision (deferred deliberately,
not decided here, per the same spec) rather than settling it now. The free tier also pauses
projects after a period of inactivity, which means the site's content can fail to load if the
project sits unused for too long once real backups and monitoring matter; this is accepted for
now and revisited when the site goes live and monitoring is added in Phase 7.
