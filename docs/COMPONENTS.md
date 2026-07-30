# Components

This is an inventory of every file in `src/components/`. It complements
[docs/ARCHITECTURE.md](./ARCHITECTURE.md), which describes how these components are wired
together from `src/App.jsx`; this document describes each component in isolation — its props,
its own local state, and what it pulls in.

Every component is a plain function component (`export default function Name(...)`), with one
exception: `ErrorBoundary` is a class component, because `getDerivedStateFromError` and
`componentDidCatch` have no hook equivalent. None use `React.memo`, and none define their own
custom hooks beyond consuming `useScrollReveal`.

## Component inventory

| Component | Purpose | Props | Local state | Notable dependencies |
| --- | --- | --- | --- | --- |
| `AboutSection` | Static "philosophy" section pairing a portrait image with brand narrative, a 2-item feature list, and a press-mentions bar. | none | none | `ScrollReveal` (wraps every content block); `lucide-react` icons (`Camera`, `Sparkles`, `Award`, `Star`); static `/images/bridal_portrait.jpg`. |
| `AnimatedCounter` | Counts up from 0 to `target` with an easeOutExpo animation, starting only once its wrapping `div` scrolls into view. | `target`, `suffix = ''`, `duration = 2000`, `className = ''` | `count` (1 `useState`) | `useScrollReveal` (`src/hooks/useScrollReveal.js`) supplies the `ref`/`isVisible` gate; drives the animation via `window.requestAnimationFrame`; used twice by `Hero` for the "1000+" and "40+" stat badges. |
| `AuthModal` | Sign-in modal with two tabs — Client Gallery PIN login and Studio admin login — each of which fakes a network delay before calling `onLoginSuccess`. | `isOpen`, `onClose`, `onLoginSuccess` | `activeTab` ('client'\|'admin'), `coupleName`, `clientPin`, `adminEmail`, `adminPassword`, `errorMsg`, `successMsg` (7 `useState`) | `lucide-react` icons (`X`, `Lock`, `Camera`, `Heart`); no real auth backend — `handleAdminLogin`/`handleClientLogin` only check that fields are non-empty (admin password ≥ 6 chars), then `setTimeout(…, 1000)` into `onLoginSuccess` with a hardcoded role object. |
| `BookingForm` | Wedding-inquiry form section; on submit swaps to a confirmation state and fires a `canvas-confetti` burst. | none | `submitted` (boolean), `formData` (object: `name`, `email`, `phone`, `date`, `location`, `guests`, `services[]`, `message`) | `ScrollReveal`; the `canvas-confetti` package (`confetti()` call inside `handleSubmit`); `handleServiceToggle` adds/removes entries from `formData.services`. |
| `ClientGalleryModal` | Private client-facing proofing gallery with an all/favorites filter and a photobook-selection progress meter capped at 20. | `isOpen`, `onClose`, `user`, `photos` | `favorites` (array of photo ids, lazily seeded from `photos.slice(0, 3)`), `activeFilter` ('all'\|'favorites') | `lucide-react` icons (`X`, `Heart`, `Download`, `CheckCircle2`, `Sparkles`, `Image as ImageIcon`, `Share2` — `Share2` is imported but never rendered); "Download ZIP" only calls `alert(...)`, there is no real export. |
| `ColorGradingSlider` | Before/after drag-comparison slider contrasting a "raw" vs. "cinema graded" treatment of one portrait image. | none | `sliderPos` (0–100, default 50), `containerWidth` (from `ResizeObserver`) | Browser `ResizeObserver` API; mouse/touch drag handlers (drag state itself lives in a `useRef`, not `useState`); `data-cursor="DRAG SLIDER"` (see `CustomCursor`); reuses the same `/images/bridal_portrait.jpg` for both layers. |
| `ContentManagerModal` | Admin "Studio Content Manager" modal with three tabs: add a single photo, publish a wedding story, and export/copy JSON. Submissions are pushed back into `App.jsx` state (and thus `localStorage`), not into `src/data/weddingData.js`. | `isOpen`, `onClose`, `onAddPhoto`, `onAddStory` | `activeTab`, `photoUrl`, `previewUrl`, `photoTitle`, `category`, `couple`, `location`, `storyTitle`, `storyCover`, `storyCouple`, `storyLocation`, `storyDate`, `storySummary`, `copied` (14 `useState`) | Browser `FileReader` API (`readAsDataURL`) for local file uploads; `handleCopyJSON` only toggles `copied` for 3 seconds — it never calls `navigator.clipboard`, so the "Copy Data to Clipboard" button does not actually copy anything. |
| `CustomCursor` | Replaces the OS cursor (desktop/`lg`-breakpoint only) with a dot-plus-label ring that reads whichever hovered element sets a `data-cursor` attribute. | none | `pos` ({x, y}), `cursorText`, `isHovered`, `isVisible` (4 `useState`) | Global `window` `mousemove`/`mouseover` listeners plus a `document` `mouseleave` listener; reads the `data-cursor` attribute set by `FilmsGallery`, `FeaturedStories`, `HorizontalGallery`, `ColorGradingSlider`, `PhotoGallery`, and `FilmStrip` (see "Shared patterns" below); hidden entirely below the `lg` breakpoint. |
| `ErrorBoundary` | Catches render-time errors anywhere below it and shows a recovery screen (heading, explanation, reload button) instead of unmounting the tree to a blank page (PS-010). | `children` | `hasError` (boolean, set via `getDerivedStateFromError`) | None beyond React; the codebase's only class component — `getDerivedStateFromError`/`componentDidCatch` have no hook equivalent; wraps `<App />` in `src/main.jsx`. |
| `FeaturedStories` | Grid of wedding-story cards; clicking a card opens `StoryDetailModal` for that story. | `stories`, `onOpenLightbox`, `onOpenVideo` | `selectedStory` (null or a story object) | `ScrollReveal` (staggers each card by `index * 150ms`); `StoryDetailModal` (mounted conditionally once a card is selected); `data-cursor="EXPLORE ALBUM"`. |
| `FilmStrip` | Infinitely-scrolling "behind the lens" marquee of 6 analog-camera frame cards; the scroll is a CSS animation, not user-driven. | none | none | A `btsFrames` array of 6 items is **hardcoded inline** in this component (see "Components with hardcoded data"); relies on the `animate-marquee` keyframe defined in `src/index.css`; `data-cursor="VIEW FRAME"`; renders `[...btsFrames, ...btsFrames]` (the list twice) to make the loop seamless. |
| `FilmsGallery` | 3-column grid of wedding-film thumbnails; clicking one calls `onOpenVideoModal` with that film's embed URL. | `films`, `onOpenVideoModal` | none | `ScrollReveal`; `data-cursor="PLAY FILM"`; unlike `FilmStrip`/`HorizontalGallery`, `films` is passed in as a prop from `App.jsx` (ultimately sourced from `src/data/weddingData.js`), not hardcoded here. |
| `Footer` | Site footer: brand blurb, social links, anchor-link navigation, a "Studio Tools" trigger for the content manager, and a back-to-top button. | `onOpenContentManager` | none | `lucide-react` icons; `scrollToTop` calls `window.scrollTo({ top: 0, behavior: 'smooth' })`; rendered after `</main>` in `src/App.jsx`, outside the section stack. |
| `Hero` | Full-viewport landing section: parallax background image, headline, two CTAs (watch showreel / book a date), and animated stat counters. | `onOpenBooking`, `onOpenFilmModal` | `scrollY` (drives the parallax `translateY` transform) | `ScrollReveal`; two `AnimatedCounter` instances (1000+ weddings, 40+ destinations); a `window` `scroll` listener; a hardcoded YouTube embed URL is passed straight into `onOpenFilmModal`. |
| `HorizontalGallery` | Horizontally-scrollable "editorial showcase" carousel with prev/next arrow buttons and a scroll-progress indicator bar. | none | `scrollProgress` (0–1, derived from the scroll container's `scrollLeft`/`scrollWidth`) | A `galleryItems` array of 5 items is **hardcoded inline** in this component (see "Components with hardcoded data"); `data-cursor="VIEW"`; injects a `<style>` tag to hide the scrollbar cross-browser. |
| `LightboxModal` | Fullscreen image viewer with prev/next navigation, `Escape`/arrow-key support, and a zoom toggle. | `activeImage`, `activeIndex`, `imagesList`, `onClose` | `currentIndex` (seeded from `activeIndex`), `isZoomed` | A `window` `keydown` listener for Escape/Arrow keys; note — its two `useState` calls are declared **after** an early `if (!activeImage) return null;`, so the hooks only run conditionally, a React Rules-of-Hooks violation that happens to work today only because `activeImage` doesn't change identity mid-mount. |
| `Navbar` | Fixed top navigation bar with scroll-aware styling, anchor links, auth/role-aware action buttons, and a mobile hamburger drawer. | `onOpenBooking`, `onOpenContentManager`, `user`, `onOpenAuthModal`, `onOpenClientGallery`, `onLogout` | `scrolled` (boolean), `mobileMenuOpen` (boolean) | A `window` `scroll` listener toggles `scrolled`; renders three different action-button layouts depending on whether `user` is absent, an admin, or a client. |
| `PhotoGallery` | Filterable, layout-switchable (1/2/4 column) photo grid with per-category counts and a "zoom" lightbox trigger. | `photos`, `onOpenLightbox`, `onOpenContentManager` | `activeCategory` ('All' by default), `layoutColumns` (1, 2, or 4) | `ScrollReveal` (header only); `data-cursor="ZOOM"`; `getGridClass()` switches the Tailwind grid classes based on `layoutColumns`. |
| `ScrollProgressBar` | Thin fixed bar at the very top of the viewport showing overall page-scroll percentage. | none | `scrollProgress` (0–100) | A `window` `scroll` listener wrapped in `window.requestAnimationFrame`; mounted once, globally, from `src/App.jsx`. |
| `ScrollReveal` | Generic fade/slide-in wrapper that animates its `children` into view once, based on the shared reveal hook. | `children`, `delay = 0`, `direction = 'up'`, `className = ''` | none directly — consumes `{ ref, isVisible }` from `useScrollReveal` | `src/hooks/useScrollReveal.js`; the shared entrance-animation building block used across the codebase (see "Shared patterns"). |
| `SectionDivider` | Decorative SVG wave divider dropped between page sections to transition between two flat background colors. | `flip = false`, `color = '#faf9f6'`, `bgColor = '#ffffff'` | none | None beyond React; `color`/`bgColor` are raw hex-string literals passed inline from `src/App.jsx` rather than Tailwind tokens (see [docs/ARCHITECTURE.md](./ARCHITECTURE.md)). |
| `SplashScreen` | One-time intro animation (camera focus → shutter snap with a synthesized click sound → reveal) shown before the site content; calls `onComplete` when finished. | `onComplete` | `phase` ('focus'\|'snap'\|'reveal'\|'done'), `flash` (boolean) | The Web Audio API (`AudioContext`) synthesizes the shutter-click noise burst in `playShutterSound`; a chain of `setTimeout` calls drives the phase timeline (~1.4s → ~1.8s → ~2.5s total); `/images/luxury_camera.jpg`. |
| `StoryDetailModal` | Full story-album modal (opened from `FeaturedStories`): summary text, one large active image, and a thumbnail grid to page through `story.fullGallery`. | `story`, `onClose`, `onSelectImage`, `onOpenVideo` | `activeImageIndex` | Rendered by `FeaturedStories`; shares the same early-return-before-hook pattern as `LightboxModal` (`if (!story) return null;` precedes its `useState` call); `onSelectImage` forwards the clicked thumbnail URL up so the parent can open `LightboxModal`. |
| `Testimonials` | Auto-rotating (5s interval) testimonial carousel with dot navigation, swipe support, and a pause-on-hover progress bar. | `testimonials` | `activeIdx`, `isHovered`, `touchStart`, `touchEnd` (4 `useState`) | A `setInterval` auto-advance timer (paused while `isHovered`); `onTouchStart`/`onTouchMove`/`onTouchEnd` swipe detection; injects a `<style>` tag defining the `fillProgress`/`customFadeIn` `@keyframes`. |

## Hooks

- **`src/hooks/useScrollReveal.js`** — `useScrollReveal(options = { threshold: 0.15, rootMargin: '0px 0px -50px 0px' })` returns `{ ref, isVisible }`. It creates an `IntersectionObserver` on mount, flips `isVisible` to `true` the first time the observed `ref` element intersects, and immediately `unobserve`s it — a one-shot reveal that never re-triggers, even if the element later scrolls out of and back into view. The effect's cleanup also unobserves on unmount. This hook is the sole shared abstraction used outside `src/App.jsx`; it is consumed directly by `AnimatedCounter` and, wrapped, by `ScrollReveal`.

## Shared patterns

- **`ScrollReveal` wraps sections for entrance animation.** `AboutSection`, `BookingForm`, `FeaturedStories`, `FilmsGallery`, `Hero`, and `PhotoGallery` all wrap their content in one or more `<ScrollReveal>` instances (often several per section, staggered with an incrementing `delay`) rather than animating in some other shared way. This is the de facto standard entrance animation for the whole page.
- **`data-cursor` attributes drive the `CustomCursor` label.** `CustomCursor` reads whichever element under the pointer carries a `data-cursor` attribute and renders its text inside the hover ring. Six components set it:
  - `FilmsGallery.jsx` → `"PLAY FILM"`
  - `FeaturedStories.jsx` → `"EXPLORE ALBUM"`
  - `HorizontalGallery.jsx` → `"VIEW"`
  - `ColorGradingSlider.jsx` → `"DRAG SLIDER"`
  - `PhotoGallery.jsx` → `"ZOOM"`
  - `FilmStrip.jsx` → `"VIEW FRAME"`

  All six are clickable/draggable surfaces that open a modal, play a video, or scrub a slider — `data-cursor` is this codebase's only mechanism for communicating "this is interactive" to the custom cursor, and it is applied ad hoc per component rather than through any shared "interactive surface" wrapper.

## Duplication to consolidate

Several components hand-roll near-identical class strings for what are effectively the same
two UI primitives — a pill-shaped button and a small uppercase badge/stamp — instead of sharing
one implementation:

- **Tab buttons.** `AuthModal` and `ContentManagerModal` each define their own tab buttons using
  the identical `"pb-3 text-xs uppercase tracking-wider font-bold border-b-2 transition-all
  flex items-center space-x-2 ..."` class string, differing only in which tab is "active."
- **Pill/toggle buttons.** `ClientGalleryModal`'s all/favorites filter toggle, `PhotoGallery`'s
  category-filter buttons, and `Footer`'s "In-App Image Manager" button all repeat the same
  `rounded-full ... uppercase tracking-wider font-bold` shape with the same
  `bg-pitch-900 text-offwhite-50` (active) vs. `border-pitch-900/15` (inactive) toggle logic.
  `Navbar`'s action buttons and `BookingForm`'s service-selection buttons follow the same
  pattern again with their own copies of the class string.
- **Small uppercase badges/stamps.** `ColorGradingSlider` ("Raw Camera File" / "Peak Story
  Cinema Grade"), `FeaturedStories` (the date stamp), and `PhotoGallery` (the category stamp)
  all repeat the same `text-[9px]`/`text-[10px] uppercase tracking-widest ... px-2.5 py-1
  rounded(-full)` pill markup.

The fix is a shared `Button` component (variants for solid/outline/toggle states) and a shared
`Badge` component, so this styling lives in one place instead of being copy-pasted per
component. This item is tracked in `docs/KNOWN-ISSUES.md`.

## Components with hardcoded data

`FilmStrip` and `HorizontalGallery` each define their own image arrays (`btsFrames` and
`galleryItems`, respectively) inline in the component file, instead of reading from
`src/data/weddingData.js` like every other data-driven section does. Practically, this means
the "In-App Image Manager" (`ContentManagerModal`) has no way to reach the content these two
components render — new photos or stories added through it can never appear in the film-strip
marquee or the horizontal editorial carousel, because both are wired to their own local arrays
rather than to shared app state.
