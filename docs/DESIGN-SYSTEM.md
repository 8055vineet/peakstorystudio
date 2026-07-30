# Design System

This document is the visual-language reference for Peak Story Studio: the color palette, the
type system, the animation inventory, and the site's one genuinely distinctive idea — its
film/camera vernacular. It complements [docs/ARCHITECTURE.md](./ARCHITECTURE.md) and
[docs/COMPONENTS.md](./COMPONENTS.md); where those documents describe structure and behavior,
this one describes what the tokens and classes they reference actually look like, and which of
them are dead weight. Usage counts were measured with
`grep -ro "<token>" src | grep -v '^src/index.css' | wc -l` (or, for color tokens, plain
`grep -ro "<token>" src | wc -l`, since no color token is itself defined inside `src/index.css`)
on 2026-07-30 against commit `ab17a18`. The dead entries identified here feed the inventory in
`docs/KNOWN-ISSUES.md`.

## Palette

All 18 color tokens live in `tailwind.config.js` under `theme.extend.colors`, in three families
(`offwhite`, `pitch`, `charcoal`) plus one accent (`gold`). Nothing in `src/index.css` declares a
color token — the handful of raw hex values there (`#f5f3ee`, `#d5cfc2`, `#0a0a0a`, `#ffffff`)
are one-off scrollbar styling, not part of this system.

| Token | Hex | Usages | Status |
| --- | --- | --- | --- |
| `offwhite-50` | `#ffffff` | 104 | in use |
| `offwhite-100` | `#faf9f6` | 42 | in use |
| `offwhite-200` | `#f5f3ee` | 29 | in use |
| `offwhite-300` | `#e8e4dc` | 2 | in use |
| `offwhite-400` | `#d5cfc2` | 0 | **unused** |
| `pitch-950` | `#2A0813` | 17 | in use |
| `pitch-900` | `#3D0C1A` | 422 | in use |
| `pitch-800` | `#4A0E1E` | 10 | in use |
| `pitch-700` | `#5C162E` | 0 | **unused** |
| `pitch-600` | `#7A1C3C` | 0 | **unused** |
| `charcoal-900` | `#171717` | 0 | **unused** |
| `charcoal-800` | `#262626` | 0 | **unused** |
| `charcoal-700` | `#404040` | 29 | in use |
| `charcoal-500` | `#737373` | 33 | in use |
| `charcoal-400` | `#a3a3a3` | 2 | in use |
| `gold-400` | `#d4af37` | 2 | in use (icon tint only) |
| `gold-500` | `#c5a059` | 0 | **unused** |
| `gold-600` | `#a3813c` | 0 | **unused** |

Seven tokens are dead: `charcoal-800`, `charcoal-900`, `gold-500`, `gold-600`, `offwhite-400`,
`pitch-600`, `pitch-700`. None of these appear anywhere under `src/` outside their declaration
in `tailwind.config.js`.

`gold-400` is not dead by the letter of the grep, but it is dead in spirit: its only two uses are
both a small `<Sparkles>` icon tint — `text-gold-400` in
`src/components/HorizontalGallery.jsx:71` and `src/components/ColorGradingSlider.jsx:83` — never
a background, border, or text color for actual content. With three of the four `gold` shades
completely unused and the fourth reduced to decorating one icon twice, the entire gold ramp is
effectively vestigial. It is not, and never became, a real accent color for this site.

The site's real color identity is two tones, not the five-family palette the config implies:
**oxblood** (`pitch-900`, `#3D0C1A`) as the near-universal text/border/accent color — it appears
422 times across 21 of the 24 files in `src/components/` plus `src/App.jsx` — laid over **warm
off-white** (`offwhite-100`, `#faf9f6` and `offwhite-50`, `#ffffff`) as the page background.
Everything else in the palette (the deeper `pitch-950`/`pitch-800` shades, the `charcoal` grays,
`offwhite-200`/`offwhite-300`) plays a supporting role — secondary text, hover darkening, subtle
borders — around that oxblood-on-off-white core.

## Typography

Three font families are configured in `tailwind.config.js` under `theme.extend.fontFamily`:

| Family | Utility class | Role |
| --- | --- | --- |
| Cinzel | `font-cinzel` | Display — every big headline, brand wordmark, and stat number |
| Cormorant Garamond | `font-garamond` | Italic editorial voice — the secondary line under a Cinzel headline, pull quotes, captions |
| Plus Jakarta Sans | `font-sans` | UI and body copy (also Tailwind's default `sans-serif` fallback, so most unstyled text renders in it implicitly) |

`font-cinzel` appears 41 times and `font-garamond` 31 times across `src/components`; `font-sans`
is set explicitly only twice (`src/App.jsx`'s root wrapper and `Navbar`'s nav-link text) since it
is Tailwind's default and therefore the ambient body face everywhere else.

**One heading pattern repeats across nine of the site's ten top-level page sections.** Every
section rendered directly from `src/App.jsx` except `FilmStrip` builds its heading the same way:
an uppercase, bold `font-cinzel` `<h1>`/`<h2>`, followed by a `<span className="font-garamond
italic ...">` second line or clause:

- `Hero.jsx` (`<h1>`) — "CRAFTING TIMELESS" / *"CINEMATIC STORIES"*
- `FeaturedStories.jsx` — "FEATURED" / *"WEDDING STORIES"*
- `FilmsGallery.jsx` — "CINEMATIC" / *"WEDDING FILMS"*
- `ColorGradingSlider.jsx` — "CINEMATIC" / *"COLOR SCIENCE"*
- `HorizontalGallery.jsx` — "CURATED" / *"Editorial Moments"*
- `PhotoGallery.jsx` — "THE FINE ART" / *"GALLERY"*
- `AboutSection.jsx` — "WE DON'T JUST SNAP PICTURES." / *"WE PRESERVE HEIRLOOMS."*
- `Testimonials.jsx` — "LOVE NOTES &" / *"TESTIMONIALS"*
- `BookingForm.jsx` — "LET'S CREATE YOUR" / *"MASTERPIECE"*

`FilmStrip.jsx` is the sole exception — it has no headline at all, only a small uppercase badge
("Analog 35mm & Behind The Lens"). This one-pattern-nine-times repetition (uppercase Cinzel
headline, italic Garamond second line, near-identical Tailwind class strings copy-pasted section
to section) is the single biggest reason the page reads as templated rather than art-directed:
nine different sections all announce themselves with the exact same rhetorical device.

## Animation catalogue

Two sources define animation: `@keyframes` blocks hand-written in `src/index.css`, and the
`theme.extend.animation`/`theme.extend.keyframes` entries in `tailwind.config.js`. Usage counts
below count the utility class name across `src`, excluding `src/index.css` itself (its own
definitions would otherwise inflate every count by one).

| Keyframe (source) | Utility class | Usages | Status |
| --- | --- | --- | --- |
| `marquee` (`src/index.css:64`) | `animate-marquee` | 1 | in use — `FilmStrip.jsx` |
| `fadeIn` (`src/index.css:80`) | `animate-fade-in` | 13 | in use |
| `scrollFadeUp` (`src/index.css:90`) | `animate-scroll-up` | 0 | **unused** |
| `scrollFadeLeft` (`src/index.css:95`) | `animate-scroll-left` | 0 | **unused** |
| `scrollFadeRight` (`src/index.css:100`) | `animate-scroll-right` | 0 | **unused** |
| `logoPulse` (`src/index.css:118`) | `animate-logo-pulse` | 0 | **unused** |
| `splashFadeOut` (`src/index.css:128`) | `animate-splash-out` | 0 | **unused** |
| `progressFill` (`src/index.css:138`) | `animate-progress-fill` | 0 | **unused** |
| `float` (`tailwind.config.js`, `theme.extend.keyframes`) | `animate-float` | 1 | in use — `Footer.jsx` |
| *(none — reuses Tailwind's built-in `pulse` keyframe)* | `animate-pulse-slow` | 0 | **unused** |

`src/index.css` also defines non-`@keyframes` utility classes that are part of the same
animation/interaction system:

| Class (`src/index.css`) | Usages | Status |
| --- | --- | --- |
| `glass-panel-light` | 0 | **unused** |
| `minimal-card` | 2 | in use — `FeaturedStories.jsx`, `FilmsGallery.jsx` |
| `img-blur-up` | 0 | **unused** |
| `img-zoom-container` | 5 | in use — `AboutSection.jsx`, `FeaturedStories.jsx`, `FilmStrip.jsx`, `FilmsGallery.jsx`, `StoryDetailModal.jsx` |
| `horizontal-scroll` | 0 | **unused** |
| `section-wave` | 1 | in use — `SectionDivider.jsx` |

Ten class/keyframe pairs are dead: `glass-panel-light`, `animate-scroll-up`,
`animate-scroll-left`, `animate-scroll-right`, `animate-logo-pulse`, `animate-splash-out`,
`animate-progress-fill`, `img-blur-up`, `horizontal-scroll`, and `animate-pulse-slow`. Notably,
`animate-logo-pulse` and `animate-splash-out` were clearly written for `SplashScreen.jsx` (a
"logo pulse" and a "splash fade out" have no plausible use elsewhere) but that component does
not reference either class — its intro/outro animation is driven entirely by inline Tailwind
transition utilities and React state (`phase`), not by these two keyframes.

Six are confirmed in use: `animate-fade-in` (13), `img-zoom-container` (5), `minimal-card` (2),
`animate-marquee` (1), `section-wave` (1), and `animate-float` (1).

## Locally injected styles

Two components bypass `src/index.css` entirely and inject their own `<style>` tags at render
time, duplicating the stylesheet's role in miniature:

- **`src/components/Testimonials.jsx`** (lines 39–53) renders a plain `<style>` block defining
  `@keyframes fillProgress`, `@keyframes customFadeIn`, and `.animate-custom-fade`. The
  `fillProgress` keyframe (`width: 0% → 100%`) is a near-exact duplicate of the already-unused
  `progressFill` keyframe in `src/index.css:138` (`animate-progress-fill`) — the same testimonial
  progress-bar effect was implemented twice, once dead in the shared stylesheet and once locally
  here where it is actually used (`style={{ animation: '... fillProgress 5s linear forwards' }}`
  at line 113).
- **`src/components/HorizontalGallery.jsx`** (lines 140–144) uses
  `<style dangerouslySetInnerHTML={{__html: ...}}>` to define a single `.hide-scrollbar` rule
  that hides the horizontal scroll container's scrollbar cross-browser — functionally the same
  job `.horizontal-scroll` in `src/index.css:171` already does (and which, per the animation
  catalogue above, sits unused).

Both components could be rewired onto `src/index.css` utilities with no loss of behavior; instead
the codebase now carries three separate implementations of "hide this scrollbar" and two of
"animate this progress fill."

## Motion and accessibility

There is no `prefers-reduced-motion` handling anywhere in the codebase — not in `src/index.css`,
not in `tailwind.config.js`, and not as an inline media query or JS check in any component
(`grep -rn "prefers-reduced-motion" src` and the project root both return nothing). Every
animation cataloged above — the splash-screen camera sequence, the 13 `animate-fade-in` entrance
transitions, the `animate-marquee` film-strip scroll, the `animate-float` footer element, scroll
reveal transforms driven by `useScrollReveal`, and the locally injected `fillProgress`/
`hide-scrollbar` styles — plays unconditionally for every visitor regardless of their OS-level
reduced-motion preference. This is a plain accessibility gap, not a style choice: nothing in the
system currently degrades or disables motion for users who have asked their OS to minimize it.

## Film and camera vernacular

The film/camera vernacular is the site's most distinctive visual idea, but it is not applied
consistently — it is built out in full in exactly two components, and echoed only as a thin,
inconsistent accent everywhere else that references it.

**`src/components/SplashScreen.jsx`** is the fullest expression. Before the site content ever
renders, it shows a ~2.3-second sequence — camera focuses, aperture blades rotate, a shutter
"snaps" (with a synthesized click sound generated live via the Web Audio API in
`playShutterSound`, plus a white flash overlay), then the camera zooms away to reveal the page.
Layered over a photo of a real Leica camera (`/images/luxury_camera.jpg`) are two distinct
camera-UI devices:

- A **viewfinder heads-up display** (lines 94–121): four corner "focus ticks"
  (`border-t-2 border-l-2`, etc., positioned at each corner via `absolute`), a top bar reading
  `REC` next to a pulsing red dot and `LEICA M 35MM`, and a technical readout of
  `f/1.4`, `1/500s`, and `ISO 100` — real camera exposure-triangle values, not placeholders. The
  bottom bar reads `PEAK STORY STUDIO` / `RANGEFINDER • FINE ART CINEMA`.
- An **animated aperture-blade SVG** (lines 157–179): six mechanical blade paths (identical path
  data, each rotated 60° from the last — `rotate(60 100 100)` through `rotate(300 100 100)`)
  layered over the lens position of the camera photo, blend-multiplied
  (`mix-blend-multiply`) so the blades read as part of the physical lens. The blade group's
  `scale`/`opacity` and the SVG's own rotation both key off the same `phase` state
  (`'focus' | 'snap' | 'reveal' | 'done'`) that drives the rest of the sequence, so the blades
  visibly close down at the moment of the shutter "snap."

**`src/components/FilmStrip.jsx`** is the second full expression: an infinitely-scrolling
(`animate-marquee`) horizontal reel of six hardcoded "behind the lens" frames. Each card carries
two label rows that mimic a film-slate/contact-sheet aesthetic: a top mono caption naming a
film stock or camera per frame (`"KODAK 400TX"`, `"LEICA M11"`, `"HASSELBLAD"`, `"CINEMA 35MM"`,
`"KODAK PORTRA"`, `"ARRI ALEXA"`) paired with a frame number (`▶ 1A`, `▶ 2A`, ...), and a bottom
stamp reading `PEAK STORY • {LOCATION}`.

Elsewhere, the vernacular survives only as a small monogram "stamp" motif borrowed into two
otherwise plain grids — and each of the three places that render a stamp uses a **different
format**:

| Component | Stamp text | Format |
| --- | --- | --- |
| `src/components/PhotoGallery.jsx:134` | `PSS / {CATEGORY}` | monogram + category |
| `src/components/FeaturedStories.jsx:52` | `PEAK STORY / {DATE}` | full name + date |
| `src/components/FilmStrip.jsx:51` | `PEAK STORY • {LOCATION}` | full name + location, different separator |

None of the three agree on whether to abbreviate the studio name (`PSS` vs. `PEAK STORY`), on the
separator (`/` vs. `•`), or on what the second field even is (category, date, or location). This
is exactly the kind of inconsistency the rest of the vernacular doesn't have — the HUD readout
and the film-slate captions are each internally consistent within their own component.

Given that this vernacular touches only two components in full and is diluted into three
mismatched micro-formats everywhere else, it is the strongest candidate for the site's signature
visual idea if invested in deliberately — and the three stamp formats above are the first thing
that should be unified into one, applied consistently wherever a "shot" needs a credit.
