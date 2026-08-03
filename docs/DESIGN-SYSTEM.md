# Design System

This document is the visual-language reference for Peak Story Studio's **public site**: the
color palette, the type system, and the animation inventory. It complements
[docs/ARCHITECTURE.md](./ARCHITECTURE.md) and [docs/COMPONENTS.md](./COMPONENTS.md); where
those documents describe structure and behavior, this one describes what the tokens and
classes they reference actually look like, and which of them are dead weight. Usage counts
were re-measured with `grep -ro "<token>" src | wc -l` (classes exclude `src/index.css`'s own
definitions) on 2026-08-03, after Phase 3b's redesign. The admin app (`src/admin/`) styles
itself from the same Tailwind config but was deliberately untouched by the redesign — counts
below that exist only because of admin files say so.

**The design language changed in Phase 3b.** The owner supplied the design: a centered
Cormorant Garamond wordmark, quiet cream surfaces, deep-maroon headings, a handwritten script
quote, and far less ornament. The previous language — Cinzel display caps, a film/camera
vernacular (splash-screen shutter sequence, film-strip marquee, viewfinder HUD), wave section
dividers, a custom cursor — was removed along with the ten components that carried it.
Documents describing that language predate `v0.4b`.

## Palette

All 18 color tokens live in `tailwind.config.js` under `theme.extend.colors`, in three
families (`offwhite`, `pitch`, `charcoal`) plus one accent (`gold`). Nothing in
`src/index.css` declares a color token — the handful of raw hex values there are one-off
scrollbar styling, not part of this system.

| Token | Hex | Usages | Status |
| --- | --- | --- | --- |
| `offwhite-50` | `#ffffff` | 92 | in use |
| `offwhite-100` | `#faf9f6` | 35 | in use |
| `offwhite-200` | `#f5f3ee` | 32 | in use |
| `offwhite-300` | `#e8e4dc` | 1 | in use |
| `offwhite-400` | `#d5cfc2` | 0 | **unused** |
| `pitch-950` | `#2A0813` | 17 | in use |
| `pitch-900` | `#3D0C1A` | 368 | in use |
| `pitch-800` | `#4A0E1E` | 16 | in use |
| `pitch-700` | `#5C162E` | 8 | in use — the redesign's heading maroon ("The Brand Story", page accents) |
| `pitch-600` | `#7A1C3C` | 0 | **unused** |
| `charcoal-900` | `#171717` | 0 | **unused** |
| `charcoal-800` | `#262626` | 2 | in use |
| `charcoal-700` | `#404040` | 47 | in use |
| `charcoal-500` | `#737373` | 40 | in use |
| `charcoal-400` | `#a3a3a3` | 3 | in use |
| `gold-400` | `#d4af37` | 0 | **unused on the public site** (was an icon tint in two deleted components) |
| `gold-500` | `#c5a059` | 3 | admin only (`src/admin/`) |
| `gold-600` | `#a3813c` | 2 | admin only (`src/admin/`) |

The public site's color identity is unchanged in substance and now truer in practice:
**oxblood** (`pitch-900`) text and accents over **warm off-white** (`offwhite-100`/`-50`)
surfaces, with `pitch-700` as the deliberate deep-maroon heading accent the owner's design
called for — a token that sat unused until Phase 3b. The `gold` ramp no longer appears on the
public site at all; it survives only in the admin's styling, which the redesign deliberately
did not touch. Dead public tokens (`offwhite-400`, `pitch-600`, `charcoal-900`, `gold-400`)
feed the `PS-016` recount scheduled for Phase 7.

## Typography

Four font families are configured in `tailwind.config.js` under `theme.extend.fontFamily`:

| Family | Utility class | Role |
| --- | --- | --- |
| Cormorant Garamond | `font-garamond` | Display — the wordmark, every heading, and page titles (48 uses) |
| Great Vibes | `font-script` | The Home quote and its credit line only (2 uses) |
| Plus Jakarta Sans | `font-sans` | UI and body copy (Tailwind's default, so most text renders in it implicitly) |
| Cinzel | `font-cinzel` | **Admin only** since Phase 3b (10 uses, all under `src/admin/`); no public component uses it |

The old nine-sections-one-headline-pattern critique no longer applies: pages open with the
shared `PageHeader` (a single quiet Garamond title over a thin rule — the same treatment as
Home's "Images" heading), and the sections' remaining internal headlines are Garamond
throughout. Great Vibes loads from the same Google Fonts `<link>` in `index.html` as the other
faces; the admin entry does not load it.

## Animation catalogue

Two sources define animation: `@keyframes` blocks hand-written in `src/index.css`, and the
`theme.extend.animation`/`theme.extend.keyframes` entries in `tailwind.config.js`. Usage
counts below count the utility class name across `src`, excluding `src/index.css` itself.

| Keyframe (source) | Utility class | Usages | Status |
| --- | --- | --- | --- |
| `fadeIn` (`src/index.css`) | `animate-fade-in` | 9 | in use |
| `scrollFadeUp` (`src/index.css`) | `animate-scroll-up` | 0 | **unused** |
| `scrollFadeLeft` (`src/index.css`) | `animate-scroll-left` | 0 | **unused** |
| `scrollFadeRight` (`src/index.css`) | `animate-scroll-right` | 0 | **unused** |
| `progressFill` (`src/index.css`) | `animate-progress-fill` | 0 | **unused** |
| `float` (`tailwind.config.js`) | `animate-float` | 0 | **unused** since Phase 3b deleted its one consumer |
| *(Tailwind's built-in `pulse`)* | `animate-pulse-slow` | 0 | **unused** |

Phase 3b already removed the keyframes whose owners it deleted (`marquee`, `logoPulse`,
`splashFadeOut`, the `.horizontal-scroll` and `.section-wave` helpers, and the desktop
`cursor: none` override). The rows still marked unused above predate 3b and remain part of the
`PS-016` cleanup.

Non-`@keyframes` utility classes in `src/index.css`:

| Class | Usages | Status |
| --- | --- | --- |
| `glass-panel-light` | 0 | **unused** |
| `minimal-card` | 2 | in use — `FeaturedStories.jsx`, `FilmsGallery.jsx` |
| `img-blur-up` | 0 | **unused** |
| `img-zoom-container` | 3 | in use — `FeaturedStories.jsx`, `FilmsGallery.jsx`, `StoryDetailModal.jsx` |

## Locally injected styles

One component bypasses `src/index.css` and injects its own `<style>` tag at render time:
**`src/components/Testimonials.jsx`** defines `@keyframes fillProgress` and
`@keyframes customFadeIn` locally. Its `fillProgress` duplicates the unused `progressFill`
keyframe in `src/index.css` — the same progress-bar effect implemented twice, once dead in the
shared stylesheet and once locally where it is actually used. Consolidating this is `PS-016`
territory. (The other injector, `HorizontalGallery`, was deleted in Phase 3b.)

## Motion and accessibility

Motion added after Phase 3b respects `prefers-reduced-motion` from day one: the falling
petals (`PetalsBackground`) disappear entirely for reduced-motion visitors, and the rebuilt
`CustomCursor` never mounts for them (or for any coarse pointer). The *older* animations —
`animate-fade-in` transitions, the scroll-reveal transforms driven by `useScrollReveal`,
hover zooms, and `Testimonials`' injected `fillProgress` — still play unconditionally
regardless of the OS-level preference. Closing that gap for the older set remains `PS-012`,
planned Phase 5.

## What happened to the film/camera vernacular

The previous edition of this document identified the film/camera vernacular (the splash
screen's shutter sequence, the film-strip marquee, three mismatched "stamp" formats) as the
site's most distinctive idea and its strongest candidate for deliberate investment. The
owner's Phase 3b design went the other way — quiet, minimal, no camera conceit — and the two
components that carried the vernacular in full were deleted. Of the three stamp formats, only
two survive (`PhotoGallery`'s `PSS / {CATEGORY}`, `FeaturedStories`' `PEAK STORY / {DATE}`);
unifying or removing them is a Phase 7 polish decision, not a design commitment.
