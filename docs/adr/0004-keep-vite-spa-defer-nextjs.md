# 0004. Keep the Vite SPA, defer Next.js

## Status

Accepted

## Context

The stated priority is a working, live site that can take real inquiries — not a rebuild. The
existing app is a Vite + React 18 + Tailwind single-page application of roughly 3,200 lines
across 23 components, and it already renders the full site correctly; the gap is entirely
missing backend behavior (persistence, real auth, real inquiry handling), not the frontend
framework.

## Decision

Add the backend (Supabase, per [ADR 0002](0002-supabase-as-backend.md)) additively on top of the
current app, and keep the Vite SPA as-is rather than rebuilding on Next.js now.

Alternative considered and rejected: **migrating all 23 components to Next.js now.** This would
delay the stated priority — working inquiries and a live site — behind a framework rewrite, and
it is not a mechanical port. Several pieces that existed at the time of this decision read
`window`/`document` directly and assumed a browser-only render: the splash screen and the
custom cursor (both components have since been deleted by Phase 3b's redesign) and the
scroll-reveal hook (`src/hooks/useScrollReveal.js`, still present). Each of these needed
SSR-safe rework — guarding browser-only APIs, or opting the affected components out of server
rendering — before a Next.js migration could even match current behavior, let alone improve on
it.

## Consequences

Because the SPA renders entirely client-side, there is no server rendering, which leaves search
engine visibility weak until the roadmap's Phase 5 (SEO and shareable pages; see
[ROADMAP.md](../ROADMAP.md)) adds routing and prerendering. Secrets introduced by the backend
(the Supabase service-role key, the Resend API key) must live in server-side Edge Functions rather
than anywhere in the SPA bundle, since the SPA itself has no server-side layer to hide them in.
The admin tooling (login, content manager) must be lazy-loaded so that code is not shipped to
every visitor who is not the studio's admin — today it ships to everyone, because the app has no
code-splitting boundary between visitor-facing and admin-only UI.

Phase 5 is where this decision gets reassessed, once the site is live and its actual search
performance is measurable; static prerendering via `vite-react-ssg` is the lighter candidate
there, since it can add prerendered HTML without requiring the SSR-safety rework a full Next.js
migration would demand.
