# Multi-Page Redesign (Phase 3b, v0.4b) — Design

**Date:** 2026-08-03
**Phase:** 3b — Multi-page redesign · branch `phase-3b/multi-page-redesign` · tag `v0.4b`
**Status:** Approved in conversation; this document records the decisions.

## 1. What and why

The public site today is one scrollable page: every navbar option is an anchor link into the
same document. The studio owner wants two things at once:

1. **Separate pages.** Each navbar option becomes its own page at its own URL.
2. **A new visual identity.** The owner supplied a screenshot of the Home page they want.
   It is the design authority for this phase: a centered serif wordmark with the nav row
   beneath it, a full-bleed hero image, a script-lettered quote, a video block, a photo grid,
   a "Brand Story" section with deep-maroon headings, a closing image, and a footer with the
   studio's real Lucknow contact details. The whole site adopts this style, not just Home.

The admin (`admin.html`) is untouched by this phase.

### Confirmed by the owner

- The screenshot **is** the Home page design, and its text is **real content to use verbatim**:
  the quote credited to "abhinav", the Brand Story paragraphs, and the contact details —
  **2/231 Vastu Khand, Gomtinagar, Lucknow, UP · peakstorystudio@gmail.com · +91 8881621021**.
  This resolves `PS-028`: the studio is in Lucknow; the Mumbai details were template
  placeholders and are removed everywhere.
- All **images** in the screenshot are placeholders. The owner supplies real images after this
  phase; the design must make the slots obvious and swappable without touching component code.
- Page architecture: **React Router** (owner chose it over separate HTML files and hash URLs).
- Sign In and Book Date survive the redesign as header controls.

### Relation to the roadmap

This phase was not in the original table. It slots between Phase 3 and Phase 4 using the same
a/b convention as Phase 1, and deliberately pulls two scheduled items forward:

- **Routing** was Phase 5 scope. The mechanism (React Router, real URLs) lands now; Phase 5
  keeps its remaining scope: per-wedding URLs, prerendering, sitemap, OG images, structured
  data.
- **Part of the truthful-content pass** was Phase 7 scope (`PS-002`). The redesigned Home has
  no "AS FEATURED IN" press strip and no "Vogue Fine Art Choice" badge, so those fabricated
  claims leave the codebase now, and the fabricated Mumbai contact details are replaced with
  real ones. This is an early *partial* close of `PS-002`, done knowingly at the owner's
  direction — the remaining `PS-002` item is the seeded "Deepika & Ranveer" testimonial row in
  the database, which the About page will still render until the owner replaces it in the
  admin. `docs/KNOWN-ISSUES.md` is updated accordingly.

## 2. Information architecture

Six routes, one shared frame, plus a catch-all:

| URL | Page component | Content |
| --- | --- | --- |
| `/` | `HomePage` | The screenshot, section for section (§5) |
| `/gallery` | `GalleryPage` | Full published photo grid + lightbox |
| `/films` | `FilmsPage` | All published films, playable in the video modal |
| `/stories` | `StoriesPage` | Featured weddings grid + story detail view |
| `/about` | `AboutPage` | Brand Story expanded + testimonials |
| `/contact` | `ContactPage` | Booking form (unchanged pipeline) + real contact details |
| anything else | `NotFoundPage` | Small, same-style "page not found" with a link home |

- `react-router-dom` v6 (latest 6.x at install time, saved exact in `package.json` — v6, not
  v7, to match React 18 and the plain-JS setup). This is the project's first router; update
  the "no router" language in `CLAUDE.md` and `docs/ARCHITECTURE.md`.
- `BrowserRouter` wraps the app in `src/main.jsx`. A `ScrollToTop` component (listening to
  `useLocation`) scrolls to the top on every route change. Browser back/forward work natively.
- The navbar label "Featured Stories" becomes **Stories**, matching the screenshot. Nav order
  is the screenshot's: Home, Gallery, Films, Stories, About, Contact.
- Vite dev serves unknown paths as `index.html` (SPA default), so `/gallery` works under
  `npm run dev`; the multi-entry `admin.html` is still reached explicitly by filename. A
  `public/_redirects` file (`/* /index.html 200`) is added now so the Phase 4 Cloudflare Pages
  deploy serves deep links correctly; static assets (including `admin.html`) take precedence
  over redirects on Pages, so the admin is unaffected.

## 3. Shared frame

### Header (all pages)

Per the screenshot: **"Peak Story Studio"** as a centered wordmark in Cormorant Garamond,
with the six nav links in a centered row beneath it. Additions the screenshot doesn't show but
the owner asked to keep:

- **Sign In** (opens the existing `AuthModal`) and **Book Date** (navigates to `/contact`) as
  quiet, small controls in the top-right corner, so the centered composition stays clean.
  When a user is signed in, the existing badge/logout affordances replace Sign In, restyled to
  the new quiet language.
- The active page's nav link is visually marked (`NavLink` active state — an underline in the
  current text color; no new colors).
- Mobile: centered wordmark, hamburger at the right; the drawer holds the six links, Sign In,
  and Book Date. The `scrolled` condensing behavior is dropped — the header is a calm block at
  the top of each page, scrolling away normally.

### Footer (all pages)

Per the screenshot, three zones plus a social row:

- Left: "Peak Story Studio" wordmark.
- Center: the real contact block — `2/231 Vastu Khand, Gomtinagar,` / `Lucknow, UP` /
  `Email: peakstorystudio@gmail.com` / `Phone: +91 8881621021` — sourced from
  `src/data/contact.js`, never hardcoded in the component.
- Right: three small labeled marks — Wedding Films, Professional Photography, Online Delivery.
- Below: Instagram, YouTube, WhatsApp icons. WhatsApp links to `wa.me/918881621021` (the
  confirmed number). Instagram and YouTube URLs are **not yet known** — the icons render
  without links (plain spans, not dead `href="#"` anchors) until the owner supplies them;
  `src/data/contact.js` holds empty `STUDIO_INSTAGRAM_URL` / `STUDIO_YOUTUBE_URL` constants
  with a comment, and each icon renders as a link only when its URL is non-empty.

### `src/data/contact.js` after this phase

```js
export const STUDIO_PHONE = '+91 8881621021';
export const STUDIO_EMAIL = 'peakstorystudio@gmail.com';
export const STUDIO_ADDRESS = '2/231 Vastu Khand, Gomtinagar, Lucknow, UP';
export const WHATSAPP_NUMBER = '918881621021'; // digits only, country code first
export const STUDIO_INSTAGRAM_URL = ''; // owner to supply; empty = icon renders unlinked
export const STUDIO_YOUTUBE_URL = '';   // owner to supply; empty = icon renders unlinked
```

`WHATSAPP_NUMBER` stops being env-driven — the number is confirmed real, so it is a constant
like the others. The `PS-028` comment block is replaced with a note that these were confirmed
by the owner on 2026-08-03.

## 4. Visual language

- **Display face:** Cormorant Garamond (already loaded and in `tailwind.config.js` as
  `font-garamond`) for the wordmark and all headings.
- **Script face:** Great Vibes (new; added to the existing Google Fonts `<link>` in
  `index.html` — public entry only, the admin does not load it) exposed as `font-script` in
  `tailwind.config.js`. Used only for the Home quote.
- **Body face:** Plus Jakarta Sans (current `font-sans`), unchanged.
- **Cinzel retires from the public site.** The token stays in `tailwind.config.js` (removing
  it is not worth auditing the admin for stragglers this phase) but no public component uses it.
- **Palette: no new colors.** The screenshot's cream is `offwhite-100`/`offwhite-50`; its
  near-black text is `charcoal-900`/`pitch-900`; its deep-maroon headings are the existing
  `pitch-600`/`pitch-700` (`#7A1C3C`/`#5C162E`). The `gold` family retires from public
  components. No raw hex anywhere in components, per the standing rule.
- **Removed flourishes** (owner saw the list and did not veto): `SplashScreen`,
  `CustomCursor`, `ScrollProgressBar`, `SectionDivider` (closing `PS-020` by deletion — the
  component that received raw hex props no longer exists), `FilmStrip`, `ColorGradingSlider`,
  `HorizontalGallery`, the old `Hero`, and `AboutSection` — the last because it renders the
  fabricated "1,000+ weddings / 40+ destinations" statistics, which leave with the rest of the
  early `PS-002` close (§1). The site opens directly onto the Home header and hero image.
  Scroll-reveal animation (`useScrollReveal`) may be kept where it already exists if it
  survives restyling naturally; it must not be extended to new sections this phase.

## 5. Home page, section by section

Top to bottom, matching the screenshot:

1. **Header** (§3).
2. **Hero image.** Full-bleed landscape image slot.
3. **Quote.** In `font-script`, centered, on cream: *"Every journey builds toward a single,
   breathless moment. We are here to capture the story when it reaches its absolute peak."*
   with the credit line *by abhinav* beneath it, exactly as the screenshot cases it.
4. **Video block.** A wide 16:9 area. If at least one published film exists (`useFilms`), the
   first film by sort order embeds here, playable. If none exists, a quiet placeholder block
   reading "Video to be added" — which is literally what the screenshot shows.
5. **Images grid.** Heading "Images". The first 18 published gallery photos (`useGalleryPhotos`)
   in a responsive grid (6 columns on desktop, per the screenshot's 3×6). Clicking opens the
   existing `LightboxModal` over the full photo list. Zero photos → the section renders its
   heading with a quiet empty note, never throws (standing empty-list rule).
6. **The Brand Story.** Portrait image slot on the left; on the right the heading
   "The Brand Story" in `pitch-700` Cormorant Garamond and the two confirmed paragraphs
   verbatim:
   > At Peak Story Studio, we believe that life's most profound moments are not just lived—they
   > unfold like a masterpiece. Whether it is the quiet, nervous anticipation right before a
   > wedding ceremony or the soaring crescendo of a cinematic short film, every narrative has a
   > summit.
   >
   > Our passion lies in recognizing that exact heartbeat. We don't just record events; we wait
   > for the emotion, the light, and the connection to converge at their highest point. By
   > freezing time at the peak of your story, we turn fleeting chapters into timeless memories
   > that you can relive forever.
7. **Closing image.** Full-bleed dark landscape slot.
8. **Footer** (§3).

### Image slots

The hero, Brand Story portrait, and closing image are page furniture, not database content.
They live in one data module, `src/data/homeContent.js`, exporting the quote text, Brand Story
text, and the three image paths. The paths point at `public/images/home/hero.jpg`,
`brand-story.jpg`, and `closing.jpg`; those three files are committed as placeholders (the
same Unsplash imagery the site already displays, downloaded once — Unsplash's license permits
this) so nothing renders broken. **The owner swaps images by overwriting those three files —
no code edit.** This is documented in the
module's header comment and in `docs/ARCHITECTURE.md`.

## 6. The other pages

Each page reuses the existing section component, restyled to the new language. All keep their
current data hooks and their empty-list tolerance.

- **Gallery** — `PhotoGallery` as the page body: the full published grid with `LightboxModal`
  on click; its existing internal behavior is preserved, only restyled.
- **Films** — `FilmsGallery` as the page body; each film opens the existing video modal.
- **Stories** — `FeaturedStories` grid with `StoryDetailModal` for the detail view.
- **About** — the Brand Story portrait and text (reusing `homeContent.js`, not duplicating
  prose), then `Testimonials` (which keeps its shrinking-list guard). The old `AboutSection`
  is deleted, not reused — its statistics are fabricated (§4).
- **Contact** — the existing `BookingForm` mounted unchanged (the inquiry pipeline is
  working, verified end to end, and is not modified this phase), plus the real contact block
  and the WhatsApp link.
- **NotFound** — wordmark, one line ("This page does not exist."), link to `/`.

## 7. State and data flow

Unchanged in principle, relocated in practice:

- `src/App.jsx` remains the only stateful component of consequence: session (`peak_story_user`
  localStorage), lightbox state, video modal, auth modal, client gallery modal. It renders the
  route table and passes state down as props to page elements — components stay presentational,
  no context provider is introduced, and no component imports the Supabase client.
- The shared frame is a `Layout` component (header + `<Outlet />` + footer) used as a layout
  route, receiving its props (user, sign-in/out handlers) from `App`.
- Pages fetch their own content through the existing hooks (`useWeddings`,
  `useGalleryPhotos`, `useFilms`, `useTestimonials`); the hooks' error fallback to
  `weddingData.js` behaves as today. No query-layer changes.
- "Book Date" and any in-page booking CTAs navigate to `/contact` (replacing today's
  `scrollToBooking` anchor scroll).

## 8. Testing

The Vitest suite is adapted, not rebuilt. New or reworked coverage:

- **Routing:** rendering `App` inside `MemoryRouter` at each of the six paths shows that
  page's distinguishing content; an unknown path shows NotFound; clicking a nav link switches
  pages. (`BrowserRouter` moves to `main.jsx` precisely so tests can wrap `App` in
  `MemoryRouter`.)
- **Shared frame:** footer renders the real Lucknow details from `contact.js`; social icons
  are unlinked while their URLs are empty; Book Date lands on `/contact`.
- **Home:** video block shows "Video to be added" with zero films and an embed with one;
  images grid tolerates zero photos; quote and Brand Story text render verbatim.
- **Deleted components:** their test files are deleted with them.
- **Untouched:** all inquiry-pipeline and admin tests stay green as-is; `verify:inquiry` and
  `verify:admin` still pass (nothing behind them changes).

## 9. Documentation updates (same phase, enforced by `check:docs`)

- `docs/COMPONENTS.md` — pages added, deleted components removed.
- `docs/ARCHITECTURE.md` — routing section replaces the anchor-scroll description; image-slot
  convention documented.
- `CLAUDE.md` — "no router" project description updated; `PS-020` paragraph updated (closed by
  deletion, stated explicitly); content-integrity section updated to reflect the press strip
  and badge being gone, with the testimonial row remaining.
- `docs/ROADMAP.md` — Phase 3b row (`v0.4b`) added; "Current position" updated; notes on what
  was pulled forward from Phases 5 and 7.
- `docs/KNOWN-ISSUES.md` — `PS-020` closed (component deleted), `PS-028` closed (details
  confirmed and applied), `PS-002` updated to its remaining scope (database testimonial row).

## 10. Out of scope

- Per-wedding URLs, prerendering, sitemap, OG images, structured data (Phase 5).
- Deploy configuration beyond the `_redirects` file (Phase 4).
- Admin changes of any kind, including admin restyling.
- Uploading the home image slots through the admin (static files this phase).
- The remaining `PS-002` item (seeded testimonial row) — the owner replaces it via the admin.
- TypeScript (permanently out of scope per project convention).

## 11. Open items owed by the owner

- Instagram and YouTube URLs (icons render unlinked until then).
- Real images for the three Home slots and the database-driven photo content.
