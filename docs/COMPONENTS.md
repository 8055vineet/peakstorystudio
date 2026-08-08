# Components

This is an inventory of every file in `src/components/`, plus the page components in
`src/pages/`. It complements [docs/ARCHITECTURE.md](./ARCHITECTURE.md), which describes how
these components are wired together from `src/App.jsx`; this document describes each component
in isolation — its props, its own local state, and what it pulls in.

Every component is a plain function component (`export default function Name(...)`), with one
exception: `ErrorBoundary` is a class component, because `getDerivedStateFromError` and
`componentDidCatch` have no hook equivalent. None use `React.memo`.

Phase 3b (the multi-page redesign) deleted ten components that only made sense on the old
single scrolling page: `SplashScreen`, `CustomCursor`, `ScrollProgressBar`, `SectionDivider`,
`FilmStrip`, `ColorGradingSlider`, `HorizontalGallery`, `Hero`, `AboutSection`, and
`AnimatedCounter`. If a document or commit references one of them, it predates `v0.4b`.
(`CustomCursor` returned briefly in a rebuilt, quieter form, then was removed again for good in
Phase 3g (`v0.4g`) at the owner's request — the site uses the native pointer everywhere.)

## Component inventory

| Component | Purpose | Props | Local state | Notable dependencies |
| --- | --- | --- | --- | --- |
| `AuthModal` | Sign-in modal with two tabs — Client Gallery PIN login and Studio admin login — each of which fakes a network delay before calling `onLoginSuccess`. | `isOpen`, `onClose`, `onLoginSuccess` | `activeTab` ('client'\|'admin'), `coupleName`, `clientPin`, `adminEmail`, `adminPassword`, `errorMsg`, `successMsg` (7 `useState`) | `lucide-react` icons (`X`, `Lock`, `Camera`, `Heart`); no real auth backend — `handleAdminLogin`/`handleClientLogin` only check that fields are non-empty (admin password ≥ 6 chars), then `setTimeout(…, 1000)` into `onLoginSuccess` with a hardcoded role object. |
| `BookingForm` | Wedding-inquiry form section. Validates client-side with the shared `validateInquiry` rules (services by shape, not allowlist, since Phase 3e), submits through `useInquirySubmission` (backed by the `submit-inquiry` Edge Function) with a Cloudflare Turnstile token from `useTurnstile`, and fires a `canvas-confetti` burst only once the inquiry is confirmed stored. | `services = SERVICES` (the admin-managed list via `useBookingServices`, threaded through `ContactPage`) | `formData` (object: `name`, `email`, `phone`, `weddingDate`, `venue`, `services[]`, `message`, plus the honeypot field named by the shared `HONEYPOT_FIELD` constant — `preferred_contact_window`, deliberately meaningless to autofill after a password manager filled the old `website` field and cost a real lead), `clientErrors` (object, from client-side `validateInquiry`) | `ScrollReveal`; `canvas-confetti`; `WhatsAppButton` (left contact column with the default message, and again in the failure panel with a message prefilled from whatever the couple had already typed); `useInquirySubmission`/`useTurnstile` drive `status` (`idle`\|`pending`\|`success`\|`error`), server `fieldErrors`, and `retryAfterSeconds`; `isInquiryBackendConfigured`/`TURNSTILE_SITE_KEY` (`src/lib/queries/inquiries.js`) gate whether the Turnstile widget mounts; contact details arrive as the `contact` prop (default `SITE_SETTINGS_FALLBACK.contact`; live values flow from `useSiteSettings` through `ContactPage`) — the left column renders the phone and email as `tel:`/`mailto:` links and the address as text, and both embedded `WhatsAppButton`s receive `number={contact.whatsappNumber}`. The `<form>` carries `noValidate`, so `validateInquiry` is the single source of truth for validity. The honeypot input is off-screen with zero opacity (not `display:none`, which some bots skip), `aria-hidden` on input and wrapper, `autoComplete` poisoned; a trip is logged server-side and the lead stored anyway. The error panel carries `role="alert"` and always offers a mailto fallback. Every visible input has `id`/`htmlFor` pairing plus `aria-invalid`/`aria-describedby`. |
| `ClientGalleryModal` | Private client-facing proofing gallery with an all/favorites filter and a photobook-selection progress meter capped at 20. | `isOpen`, `onClose`, `user`, `photos` | `favorites` (array of photo ids, lazily seeded from `photos.slice(0, 3)`), `activeFilter` ('all'\|'favorites') | `lucide-react` icons; "Download ZIP" only calls `alert(...)`, there is no real export. |
| `ErrorBoundary` | Catches render-time errors anywhere below it and shows a recovery screen (heading, explanation, reload button, the studio email from `src/data/contact.js`) instead of unmounting the tree to a blank page (PS-010). | `children` | `hasError` (boolean, set via `getDerivedStateFromError`) | The codebase's only class component; wraps `<App />` in `src/main.jsx`, outside `BrowserRouter`. |
| `FeaturedStories` | Grid of wedding-story cards; clicking a card opens `StoryDetailModal` for that story. | `stories`, `onOpenLightbox`, `onOpenVideo` | `selectedStory` (null or a story object) | `ScrollReveal` (staggers each card by `index * 150ms`); `StoryDetailModal` (mounted conditionally once a card is selected); tolerates an empty `stories` array. Carries a vestigial `data-cursor` attribute from the deleted `CustomCursor` — inert, cleanup falls under PS-016's Phase 7 pass. |
| `FilmsGallery` | 3-column grid of wedding-film thumbnails; clicking one calls `onOpenVideoModal` with that film's embed URL. | `films`, `onOpenVideoModal` | none | `ScrollReveal`; tolerates an empty `films` array; vestigial `data-cursor` (see `FeaturedStories`). |
| `HomeVideo` | The Home page's cinematic hero band: the first published film plays **muted, looping, chromeless** as a full-width ambient background (natural 16:9), dimmed by a gradient, with **PEAK STORY STUDIO** + a hand-drawn mountain-range SVG + **by abhinav** (Dancing Script) overlaid. When no film is published it shows the same branded band without the video. Home-only; the Films/Stories pages keep their click-to-play modal with sound. | `film` (the first published film, or null) | none | `youtubeEmbedUrl(url, { background: true })` (`src/lib/youtube.js`) builds the ambient loop embed URL. |
| `Footer` | The shared page footer, per the owner's approved design: the wordmark left, the studio's contact details center (with `mailto:`/`tel:` links), three service marks right (Wedding Films / Professional Photography / Online Delivery), then a social row. | `contact = SITE_SETTINGS_FALLBACK.contact` (address/email/phone/whatsappNumber/instagramUrl/youtubeUrl — live values arrive from `useSiteSettings` via `Layout`) | none | `lucide-react` icons; Instagram/YouTube icons render as plain spans until `STUDIO_INSTAGRAM_URL`/`STUDIO_YOUTUBE_URL` are supplied — never a dead `href="#"`; WhatsApp links to `wa.me` with the confirmed number. Rendered by `Layout` on every page. |
| `IntroSplash` | The Home page's first-load moment: the studio logo fills a warm cream screen, holds, then scales and glides into the navbar badge before unmounting. Plays **once per browser session** (`sessionStorage` key `peak_intro_played`), is **skippable** (a click / wheel / touch / key fast-forwards it), and renders nothing at all under `prefers-reduced-motion`, with no logo, or when already played. Measures the `[data-logo-badge]` element as its glide target, falling back to a plain fade when it can't be measured. Home-only by construction (`App` renders it only in the index route). | `logoUrl` (URL or null), `onDone` (optional callback) | `active`, `phase` ('in'\|'hold'\|'out'), `entered`, `target` (`{dx,dy,scale}`\|null) | Reads `window.matchMedia`/`sessionStorage`; times its own choreography with `setTimeout`; receives `settings.logo` from `App`. |
| `Layout` | The frame every public page shares: `PetalsBackground` at `z-0`, then a `z-10` wrapper holding `ScrollToTop`, `Navbar`, a `<main>` with the routed page via `<Outlet />`, and `Footer`. | `user`, `onOpenAuthModal`, `onOpenClientGallery`, `onLogout`, `morePages`, `logo` (forwarded to `Navbar`); `contact` (forwarded to `Footer`) | none | `react-router-dom`'s `Outlet`; used as the layout route in `src/App.jsx`'s route table. |
| `LightboxModal` | Fullscreen image viewer with prev/next navigation, `Escape`/arrow-key support, and a zoom toggle. | `activeImage`, `activeIndex`, `imagesList`, `onClose` | `currentIndex` (seeded from `activeIndex`), `isZoomed` | A `window` `keydown` listener; both `useState` calls run unconditionally before the `if (!activeImage) return null;` guard (PS-006, resolved). |
| `Navbar` | The shared page header, per the owner's approved design: the "Peak Story Studio" wordmark centered, the six page links beneath it (`NavLink`, active page underlined), a **More** dropdown after Contact listing the admin-created pages (`/more/<slug>`; renders only when `morePages` is non-empty; closes on selection, outside click, and Escape; a labelled group in the mobile drawer), Sign In / Book Date quiet in the top-right corner, and a mobile hamburger drawer. When a logo has been uploaded in the admin, it renders as a circular badge (`rounded-full`, hairline ring) immediately before the wordmark as a centered lockup. Not fixed; no scroll listener (the old scroll-condensing behavior went with the redesign). | `user`, `onOpenAuthModal`, `onOpenClientGallery`, `onLogout`, `morePages = []`, `logo = null` (URL or null) | `mobileMenuOpen`, `moreOpen` (booleans) | `react-router-dom` (`Link`, `NavLink`, `useNavigate` — Book Date navigates to `/contact`); renders a quiet admin badge or the client's name when `user` is present; real content management lives in the separate admin app under `src/admin/`. |
| `PageHeader` | The quiet page-title block every inner page opens with — a Cormorant Garamond heading over a thin rule, matching Home's "Images" heading treatment. | `title` | none | None beyond React. |
| `PetalsBackground` | Rose petals drifting down in 3D behind the page content — the owner-approved background animation. Fixed `z-0` layer under Layout's `z-10` content wrapper: petals show through open cream areas, never over a photograph, never intercept a click. Hidden entirely for reduced-motion visitors (CSS). | none | none directly — 20 petals randomized once per mount via `useMemo` | `.petal` styling and `petalFall` keyframes in `src/index.css`; mounted once by `Layout`. |
| `PhotoGallery` | The gallery as ceremony sections, per the owner's reference layout: a quiet uppercase label per category (Pre-Wedding, Wedding, Engagement, Haldi & Mehendi — unknown categories append rather than vanish), then the photographs two-up in their natural uploaded orientation, sharp corners, no filter buttons. Section order follows the admin-managed category list. Clicking opens the lightbox at that photo's index in the full list. | `photos`, `onOpenLightbox`, `categoryOrder = GALLERY_CATEGORY_FALLBACK` | none | `ScrollReveal` (section labels); tolerates an empty `photos` array (quiet empty line). |
| `ScrollReveal` | Generic fade/slide-in wrapper that animates its `children` into view once, based on the shared reveal hook. | `children`, `delay = 0`, `direction = 'up'`, `className = ''` | none directly — consumes `{ ref, isVisible }` from `useScrollReveal` | `src/hooks/useScrollReveal.js`. |
| `ScrollToTop` | Scrolls the window to the top on every route change — browsers only do that for full document loads, not client-side navigations. Renders nothing. | none | none | `react-router-dom`'s `useLocation`; mounted once inside `Layout`. |
| `StoryDetailModal` | Full story-album modal (opened from `FeaturedStories`): summary text, one large active image, and a thumbnail grid to page through `story.fullGallery`. | `story`, `onClose`, `onSelectImage`, `onOpenVideo` | `activeImageIndex` | Rendered by `FeaturedStories`; its `useState` runs before the `if (!story) return null;` guard (PS-006, resolved); `onSelectImage` forwards the clicked thumbnail URL up so the parent can open `LightboxModal`. |
| `Testimonials` | Auto-rotating (5s interval) testimonial carousel with dot navigation, swipe support, and a pause-on-hover progress bar. Guards against a shrinking list (`safeIdx`), so unpublishing testimonials mid-view cannot blank the page. | `testimonials` | `activeIdx`, `isHovered`, `touchStart`, `touchEnd` (4 `useState`) | A `setInterval` auto-advance timer (paused while `isHovered`); swipe detection; injects a `<style>` tag defining its `@keyframes`. |
| `WhatsAppButton` | Renders a "Chat on WhatsApp" link to `wa.me` with a prefilled, URL-encoded message. | `number = WHATSAPP_NUMBER` (string — empty renders nothing), `message = DEFAULT_MESSAGE` (string), `className = ''` (string) | none | `WHATSAPP_NUMBER` (`src/data/contact.js`); `lucide-react`'s `MessageCircle`; used by `BookingForm` in both the left contact column and the failure panel. |

## Pages (`src/pages/`)

Each page is a thin composition mounted by the route table in `src/App.jsx`; data arrives as
props from `App`'s hooks, never fetched in the page itself.

| Page | Route | Composition |
| --- | --- | --- |
| `HomePage` | `/` | The owner's approved screenshot, top to bottom: hero image → script-face quote → video block (`HomeVideo`: the first published film's YouTube embed, autoplaying muted on load, or "Video to be added" when none) → "Images" grid (first 18 published photos, opens `LightboxModal`) → The Brand Story → closing image. `quote`/`brandStory`/`images` arrive as props from `useSiteSettings` (defaults: the `homeContent.js` constants), so all of it is editable in the admin's Settings tab. |
| `GalleryPage` | `/gallery` | `PageHeader` + `PhotoGallery`. |
| `FilmsPage` | `/films` | `PageHeader` + `FilmsGallery`. |
| `StoriesPage` | `/stories` | `PageHeader` + `FeaturedStories`. |
| `AboutPage` | `/about` | `PageHeader` + the Brand Story block (`brandStory`/`portraitImage` props from `useSiteSettings`, constants as defaults) + `Testimonials`. |
| `ContactPage` | `/contact` | `PageHeader` + `BookingForm` (threading the `contact` settings prop; the form's own left column carries the details and WhatsApp button — no duplicate block). |
| `CollectionPage` | `/more/:slug` | An admin-created More page: `PageHeader` (title) + optional description + a Gallery-style square grid where photo items open the lightbox and video items (poster or quiet dark tile, play overlay, optional caption) open the video modal. Finds its collection by slug from the `collections` prop; renders nothing while `loading` and the slug is unknown (no NotFound flash on direct links), `NotFoundPage` once loading settles. |
| `NotFoundPage` | any unknown URL | One line and a link home. |

## Hooks

- **`src/hooks/useScrollReveal.js`** — `useScrollReveal(options = { threshold: 0.15, rootMargin: '0px 0px -50px 0px' })` returns `{ ref, isVisible }`. It creates an `IntersectionObserver` on mount, flips `isVisible` to `true` the first time the observed `ref` element intersects, and immediately `unobserve`s it — a one-shot reveal that never re-triggers. Consumed, wrapped, by `ScrollReveal`.

## Shared patterns

- **`ScrollReveal` wraps sections for entrance animation.** `BookingForm`, `FeaturedStories`, `FilmsGallery`, and `PhotoGallery` wrap their content in `<ScrollReveal>` instances (often staggered with an incrementing `delay`). Kept where it already existed; not extended to the new pages, per the Phase 3b spec.
- **Vestigial `data-cursor` attributes.** `FeaturedStories`, `FilmsGallery`, and `PhotoGallery` still set `data-cursor` attributes that the deleted `CustomCursor` used to read. They are inert; removing them falls under the PS-016 unused-cruft recount in Phase 7.

## Duplication to consolidate

Several components hand-roll near-identical class strings for what are effectively the same
two UI primitives — a pill-shaped button and a small uppercase badge/stamp — instead of sharing
one implementation:

- **Tab buttons.** `AuthModal` defines its own tab buttons using the
  `"pb-3 text-xs uppercase tracking-wider font-bold border-b-2 transition-all
  flex items-center space-x-2 ..."` class string, varying only which tab is "active."
- **Pill/toggle buttons.** `ClientGalleryModal`'s all/favorites filter toggle and `PhotoGallery`'s
  category-filter buttons repeat the same `rounded-full ... uppercase tracking-wider font-bold`
  shape with the same `bg-pitch-900 text-offwhite-50` (active) vs. `border-pitch-900/15`
  (inactive) toggle logic. `BookingForm`'s service-selection buttons follow the same pattern
  again with their own copy of the class string.
- **Small uppercase badges/stamps.** `FeaturedStories` (the date stamp) and `PhotoGallery` (the
  category stamp) repeat the same `text-[9px]`/`text-[10px] uppercase tracking-widest ...
  px-2.5 py-1 rounded(-full)` pill markup.

The fix is a shared `Button` component (variants for solid/outline/toggle states) and a shared
`Badge` component, so this styling lives in one place instead of being copy-pasted per
component. This item is tracked in `docs/KNOWN-ISSUES.md` (PS-014).
