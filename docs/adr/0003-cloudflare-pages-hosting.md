# 0003. Cloudflare Pages hosting

## Status

Accepted

## Context

Peak Story Studio is a commercial site — a photography studio taking paid bookings, not a
portfolio or hobby project — and the stated budget is effectively zero: only the domain itself
is expected to cost money (see the constraints table in
[the end-to-end platform design spec](../superpowers/specs/2026-07-30-end-to-end-platform-design.md#1-context)).
A hosting choice has to hold up under real commercial use while staying on a free tier.

## Decision

Cloudflare Pages is the hosting platform.

**The deciding fact: Vercel's Hobby tier prohibits commercial use, so a studio taking bookings
would need Vercel Pro at about 20 USD per month** to use Vercel within its terms of service. That
turns what looked like a free option into a recurring cost the project explicitly does not want
to carry.

Alternatives considered and rejected:

- **Vercel Hobby.** Free, but its terms of service exclude commercial use. Deploying a business
  that takes bookings on it would be a terms violation, not a cost trade-off.
- **Vercel Pro.** Permits commercial use, but at roughly 20 USD/month it is an unnecessary
  recurring cost for a low-traffic site that a free-tier host can serve just as well.
- **Netlify.** Its free tier does permit commercial use, so it was the closest competitor, but it
  caps monthly bandwidth where Cloudflare Pages does not. For an image- and video-heavy wedding
  photography site, that bandwidth cap is a real functional difference, not a minor one — it is
  the resource this site consumes the most of.

## Consequences

Deploys are git-push based, with automatic preview URLs per branch/PR, which fits the phased,
reviewed workflow already in use for this project. Cloudflare Pages also pairs naturally with
other Cloudflare products chosen or likely to be chosen later: Cloudflare R2 as the leading
candidate for the Phase 3 media storage decision, and Cloudflare Turnstile for spam protection on
the booking form in Phase 2 — both usable independently of where the site is hosted, but simpler
to reason about as one vendor.

The owner originally expected the site would deploy to Vercel, since that is the default
assumption for a Vite/React project. This ADR records that expectation being overturned
deliberately, for the commercial-use reason above, rather than by drift or oversight.
