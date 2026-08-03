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
(`CustomCursor` later returned in a rebuilt, quieter form at the owner's request — see its
row below; the old label-reading implementation stayed deleted.)

## Component inventory

| Component | Purpose | Props | Local state | Notable dependencies |
| --- | --- | --- | --- | --- |
| `AuthModal` | Sign-in modal with two tabs — Client Gallery PIN login and Studio admin login — each of which fakes a network delay before calling `onLoginSuccess`. | `isOpen`, `onClose`, `onLoginSuccess` | `activeTab` ('client'\|'admin'), `coupleName`, `clientPin`, `adminEmail`, `adminPassword`, `errorMsg`, `successMsg` (7 `useState`) | `lucide-react` icons (`X`, `Lock`, `Camera`, `Heart`); no real auth backend — `handleAdminLogin`/`handleClientLogin` only check that fields are non-empty (admin password ≥ 6 chars), then `setTimeout(…, 1000)` into `onLoginSuccess` with a hardcoded role object. |
| `BookingForm` | Wedding-inquiry form section. Validates client-side with the shared `validateInquiry` rules, submits through `useInquirySubmission` (backed by the `submit-inquiry` Edge Function) with a Cloudflare Turnstile token from `useTurnstile`, and fires a `canvas-confetti` burst only once the inquiry is confirmed stored. | none | `formData` (object: `name`, `email`, `phone`, `weddingDate`, `venue`, `services[]`, `message`, plus the honeypot field named by the shared `HONEYPOT_FIELD` constant — `preferred_contact_window`, deliberately meaningless to autofill after a password manager filled the old `website` field and cost a real lead), `clientErrors` (object, from client-side `validateInquiry`) | `ScrollReveal`; `canvas-confetti`; `WhatsAppButton` (left contact column with the default message, and again in the failure panel with a message prefilled from whatever the couple had already typed); `useInquirySubmission`/`useTurnstile` drive `status` (`idle`\|`pending`\|`success`\|`error`), server `fieldErrors`, and `retryAfterSeconds`; `isInquiryBackendConfigured`/`TURNSTILE_SITE_KEY` (`src/lib/queries/inquiries.js`) gate whether the Turnstile widget mounts; contact details come from `src/data/contact.js` — the left column renders the studio phone and email as `tel:`/`mailto:` links (since Phase 3b) and the address as text. The `<form>` carries `noValidate`, so `validateInquiry` is the single source of truth for validity. The honeypot input is off-screen with zero opacity (not `display:none`, which some bots skip), `aria-hidden` on input and wrapper, `autoComplete` poisoned; a trip is logged server-side and the lead stored anyway. The error panel carries `role="alert"` and always offers a mailto fallback. Every visible input has `id`/`htmlFor` pairing plus `aria-invalid`/`aria-describedby`. |
| `ClientGalleryModal` | Private client-facing proofing gallery with an all/favorites filter and a photobook-selection progress meter capped at 20. | `isOpen`, `onClose`, `user`, `photos` | `favorites` (array of photo ids, lazily seeded from `photos.slice(0, 3)`), `activeFilter` ('all'\|'favorites') | `lucide-react` icons; "Download ZIP" only calls `alert(...)`, there is no real export. |
| `CustomCursor` | The site's pointer: a small maroon dot riding the pointer exactly, plus a thin ring trailing on a gentle lag that swells over anything interactive. Active only for fine pointers at desktop widths; touch devices and `prefers-reduced-motion` visitors keep the untouched native cursor (the `cursor: none` override applies only while the component is mounted and active). | none | `enabled` (from two `matchMedia` queries) | `.cursor-dot`/`.cursor-ring` styles in `src/index.css`; a `requestAnimationFrame` lerp loop; mounted once by `Layout`. |
| `ErrorBoundary` | Catches render-time errors anywhere below it and shows a recovery screen (heading, explanation, reload button, the studio email from `src/data/contact.js`) instead of unmounting the tree to a blank page (PS-010). | `children` | `hasError` (boolean, set via `getDerivedStateFromError`) | The codebase's only class component; wraps `<App />` in `src/main.jsx`, outside `BrowserRouter`. |
| `FeaturedStories` | Grid of wedding-story cards; clicking a card opens `StoryDetailModal` for that story. | `stories`, `onOpenLightbox`, `onOpenVideo` | `selectedStory` (null or a story object) | `ScrollReveal` (staggers each card by `index * 150ms`); `StoryDetailModal` (mounted conditionally once a card is selected); tolerates an empty `stories` array. Carries a vestigial `data-cursor` attribute from the deleted `CustomCursor` — inert, cleanup falls under PS-016's Phase 7 pass. |
| `FilmsGallery` | 3-column grid of wedding-film thumbnails; clicking one calls `onOpenVideoModal` with that film's embed URL. | `films`, `onOpenVideoModal` | none | `ScrollReveal`; tolerates an empty `films` array; vestigial `data-cursor` (see `FeaturedStories`). |
| `Footer` | The shared page footer, per the owner's approved design: the wordmark left, the studio's real contact details center (from `src/data/contact.js`, with `mailto:`/`tel:` links), three service marks right (Wedding Films / Professional Photography / Online Delivery), then a social row. | none | none | `lucide-react` icons; Instagram/YouTube icons render as plain spans until `STUDIO_INSTAGRAM_URL`/`STUDIO_YOUTUBE_URL` are supplied — never a dead `href="#"`; WhatsApp links to `wa.me` with the confirmed number. Rendered by `Layout` on every page. |
| `Layout` | The frame every public page shares: `PetalsBackground` at `z-0`, `CustomCursor`, then a `z-10` wrapper holding `ScrollToTop`, `Navbar`, a `<main>` with the routed page via `<Outlet />`, and `Footer`. | `user`, `onOpenAuthModal`, `onOpenClientGallery`, `onLogout` (all forwarded to `Navbar`) | none | `react-router-dom`'s `Outlet`; used as the layout route in `src/App.jsx`'s route table. |
| `LightboxModal` | Fullscreen image viewer with prev/next navigation, `Escape`/arrow-key support, and a zoom toggle. | `activeImage`, `activeIndex`, `imagesList`, `onClose` | `currentIndex` (seeded from `activeIndex`), `isZoomed` | A `window` `keydown` listener; both `useState` calls run unconditionally before the `if (!activeImage) return null;` guard (PS-006, resolved). |
| `Navbar` | The shared page header, per the owner's approved design: the "Peak Story Studio" wordmark centered, the six page links beneath it (`NavLink`, active page underlined), Sign In / Book Date quiet in the top-right corner, and a mobile hamburger drawer. Not fixed; no scroll listener (the old scroll-condensing behavior went with the redesign). | `user`, `onOpenAuthModal`, `onOpenClientGallery`, `onLogout` | `mobileMenuOpen` (boolean) | `react-router-dom` (`Link`, `NavLink`, `useNavigate` — Book Date navigates to `/contact`); renders a quiet admin badge or the client's name when `user` is present; real content management lives in the separate admin app under `src/admin/`. |
| `PageHeader` | The quiet page-title block every inner page opens with — a Cormorant Garamond heading over a thin rule, matching Home's "Images" heading treatment. | `title` | none | None beyond React. |
| `PetalsBackground` | Rose petals drifting down in 3D behind the page content — the owner-approved background animation. Fixed `z-0` layer under Layout's `z-10` content wrapper: petals show through open cream areas, never over a photograph, never intercept a click. Hidden entirely for reduced-motion visitors (CSS). | none | none directly — 20 petals randomized once per mount via `useMemo` | `.petal` styling and `petalFall` keyframes in `src/index.css`; mounted once by `Layout`. |
| `PhotoGallery` | The gallery as ceremony sections, per the owner's reference layout: a quiet uppercase label per category (Pre-Wedding, Wedding, Engagement, Haldi & Mehendi — unknown categories append rather than vanish), then the photographs two-up in their natural uploaded orientation, sharp corners, no filter buttons. Clicking opens the lightbox at that photo's index in the full list. | `photos`, `onOpenLightbox` | none | `ScrollReveal` (section labels); tolerates an empty `photos` array (quiet empty line). |
| `ScrollReveal` | Generic fade/slide-in wrapper that animates its `children` into view once, based on the shared reveal hook. | `children`, `delay = 0`, `direction = 'up'`, `className = ''` | none directly — consumes `{ ref, isVisible }` from `useScrollReveal` | `src/hooks/useScrollReveal.js`. |
| `ScrollToTop` | Scrolls the window to the top on every route change — browsers only do that for full document loads, not client-side navigations. Renders nothing. | none | none | `react-router-dom`'s `useLocation`; mounted once inside `Layout`. |
| `StoryDetailModal` | Full story-album modal (opened from `FeaturedStories`): summary text, one large active image, and a thumbnail grid to page through `story.fullGallery`. | `story`, `onClose`, `onSelectImage`, `onOpenVideo` | `activeImageIndex` | Rendered by `FeaturedStories`; its `useState` runs before the `if (!story) return null;` guard (PS-006, resolved); `onSelectImage` forwards the clicked thumbnail URL up so the parent can open `LightboxModal`. |
| `Testimonials` | Auto-rotating (5s interval) testimonial carousel with dot navigation, swipe support, and a pause-on-hover progress bar. Guards against a shrinking list (`safeIdx`), so unpublishing testimonials mid-view cannot blank the page. | `testimonials` | `activeIdx`, `isHovered`, `touchStart`, `touchEnd` (4 `useState`) | A `setInterval` auto-advance timer (paused while `isHovered`); swipe detection; injects a `<style>` tag defining its `@keyframes`. |
| `WhatsAppButton` | Renders a "Chat on WhatsApp" link to `wa.me` with a prefilled, URL-encoded message. The number is the studio's confirmed one (a constant in `src/data/contact.js` since Phase 3b); the render-nothing-when-unset guard remains as cheap defence. | `message = DEFAULT_MESSAGE` (string), `className = ''` (string) | none | `WHATSAPP_NUMBER` (`src/data/contact.js`); `lucide-react`'s `MessageCircle`; used by `BookingForm` in both the left contact column and the failure panel. |

## Pages (`src/pages/`)

Each page is a thin composition mounted by the route table in `src/App.jsx`; data arrives as
props from `App`'s hooks, never fetched in the page itself.

| Page | Route | Composition |
| --- | --- | --- |
| `HomePage` | `/` | The owner's approved screenshot, top to bottom: hero image → script-face quote (`HOME_QUOTE`) → video block (first published film, playable; "Video to be added" when none) → "Images" grid (first 18 published photos, opens `LightboxModal`) → The Brand Story (`BRAND_STORY`) → closing image. Static image slots come from `src/data/homeContent.js` and are owner-swappable files in `public/images/home/`. |
| `GalleryPage` | `/gallery` | `PageHeader` + `PhotoGallery`. |
| `FilmsPage` | `/films` | `PageHeader` + `FilmsGallery`. |
| `StoriesPage` | `/stories` | `PageHeader` + `FeaturedStories`. |
| `AboutPage` | `/about` | `PageHeader` + the Brand Story block (reusing `homeContent.js`, not a copy) + `Testimonials`. |
| `ContactPage` | `/contact` | `PageHeader` + `BookingForm` (whose own left column carries the studio's contact details and WhatsApp button — no duplicate block). |
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
