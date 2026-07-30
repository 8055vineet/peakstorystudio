# Known Issues

This is the open-issue register for Peak Story Studio's frontend, carried forward from the
code audit described in
[the end-to-end platform design spec](superpowers/specs/2026-07-30-end-to-end-platform-design.md).
Every row below is currently unresolved. "Planned phase" refers to the phase table in
[ROADMAP.md](ROADMAP.md) — that is the phase in which each issue is expected to be closed, not
a promise about scheduling within this document.

All locations were re-verified against the source files on 2026-07-30, not copied blind from
the audit; see the task report for the verification evidence.

| ID | Issue | Severity | Location | Planned phase |
| --- | --- | --- | --- | --- |
| PS-001 | Any client PIN unlocks every client's photos; no per-client scoping | Critical | `src/components/AuthModal.jsx`, `src/components/ClientGalleryModal.jsx` | 6 |
| PS-002 | Fabricated press credentials ("AS FEATURED IN" Vogue, Harper's Bazaar, Filmfare, WedMeGood; "Vogue Fine Art Choice" badge) and real Bollywood celebrities named as clients | Critical (legal) | `src/components/AboutSection.jsx`, `src/data/weddingData.js` | 7 |
| PS-003 | Booking form reports success unconditionally; submissions are discarded | High | `src/components/BookingForm.jsx` | 2 |
| PS-004 | Uploaded images stored as base64 in localStorage; exceeds the ~5 MB quota | High | `src/components/ContentManagerModal.jsx` (base64 conversion), `src/App.jsx:50` (oversized write) | 3 |
| PS-005 | Export Config JSON button sets a "Copied!" label but copies nothing | High | `src/components/ContentManagerModal.jsx` | 3 |
| PS-006 | Rules of Hooks violation: `useState` is called after an early conditional `return null`, so hook order is not stable across renders. Works today only because the parents mount and unmount these components rather than re-rendering them with a falsy prop; it will break under React's stricter compiler or if a parent starts rendering them unconditionally | High | `src/components/LightboxModal.jsx:5-8`, `src/components/StoryDetailModal.jsx:5-6` | 1 |
| PS-007 | "Download ZIP" button is a non-functional stub that fires a browser `alert()` | Medium | `src/components/ClientGalleryModal.jsx:59` | 6 |
| PS-008 | No routing; no shareable or indexable per-wedding URLs | High | app-wide | 5 |
| PS-009 | Modals do not trap focus, lock body scroll, or close on Escape | Medium | all modals except `src/components/LightboxModal.jsx` | 3 |
| PS-010 | No error boundary; a render throw blanks the page | Medium | `src/App.jsx` | 1 |
| PS-011 | `npm run lint` runs `vite build` and lints nothing; no tests exist | Medium | `package.json` | 1 |
| PS-012 | No `prefers-reduced-motion` handling | Medium | `src/index.css`, app-wide | 5 |
| PS-013 | Three scroll listeners; only Hero's is passive | Low | `src/components/Navbar.jsx`, `src/components/ScrollProgressBar.jsx`, `src/components/Hero.jsx` | 5 |
| PS-014 | Duplicated pill-button and badge markup across many components | Low | app-wide | 3 |
| PS-015 | `FilmStrip` and `HorizontalGallery` hardcode their own image arrays | Low | those files | 1 |
| PS-016 | 10 unused CSS rules and 7 unused palette tokens | Low | `src/index.css`, `tailwind.config.js` | 3 |
| PS-017 | Icon-only buttons use `title` instead of `aria-label` | Low | `src/components/PhotoGallery.jsx` and others | 3 |
| PS-018 | Hotlinked Unsplash images with no width/height; layout shift and third-party dependency | Low | `src/data/weddingData.js` | 3 |
| PS-019 | `dist/` build output is committed to git while also listed in `.gitignore`, so every build produces spurious diffs on tracked files | Low | `.gitignore`, `dist/` | 4 |

### Notes on selected rows

**PS-001 — no per-client scoping.** `AuthModal.jsx`'s `handleClientLogin` accepts any non-empty
PIN of up to 4 characters and does not check it against a per-couple value; it always logs the
visitor in as a client. `ClientGalleryModal.jsx` then renders whatever `photos` array `App.jsx`
passes it — the entire shared photo collection, with no filter keyed on the logged-in user. Any
visitor who reaches the client tab sees every couple's private photographs, not just their own.

**PS-002 — fabricated credentials.** This is a legal-risk row, not a cosmetic one.
`AboutSection.jsx` renders a "AS FEATURED IN LEADING LUXURY PUBLICATIONS" press bar naming
VOGUE, HARPER'S BAZAAR, FILMFARE, and WEDMEGOOD, plus a floating "Vogue Fine Art Choice" badge
claiming the studio was "Recognized worldwide for cinema quality framing." `weddingData.js`'s
`TESTIMONIALS` array attributes a quote to "Deepika & Ranveer" — the real names of a well-known
Bollywood actress and actor who are themselves a real married couple — presented as a genuine
client testimonial. None of this is sourced or substantiated anywhere in the repository. On a
live commercial site this is a false-endorsement and false-advertising exposure, independent of
whether the underlying photography claims are true.

**PS-004 — base64 uploads exceed the localStorage quota.** The two files play distinct roles.
`ContentManagerModal.jsx`'s `handleFileUpload` reads the chosen file with
`FileReader.readAsDataURL`, producing a full base64 data URL that is stored directly on the new
photo object — that file contains no `localStorage` reference itself. `App.jsx` is where the
quota is actually at risk: its `photos` state (seeded from `INITIAL_PHOTOS` plus anything added
through the Content Manager) is written to `localStorage` on every change via
`localStorage.setItem('peak_story_photos', JSON.stringify(photos))` at `src/App.jsx:50`. A
handful of base64-encoded photos is enough to approach or exceed the ~5 MB per-origin quota,
at which point that `setItem` call throws and silently stops persisting new photos. An engineer
fixing this needs both files: the upload path that creates the oversized string, and the
storage path that fails to hold it.

**PS-006 — Rules of Hooks violation.** In both files, an unconditional early return
(`if (!activeImage) return null;` in `LightboxModal.jsx`, `if (!story) return null;` in
`StoryDetailModal.jsx`) sits before `useState` calls. React requires the same hooks to run in
the same order on every render of a given component instance; a conditional return placed before
a hook call violates that rule in principle. It does not currently misbehave because neither
component is ever asked to do the one thing that would expose it: re-render in place with a
prop that toggles between falsy and truthy. `App.jsx` renders `LightboxModal` only inside
`{lightboxState.isOpen && <LightboxModal ... />}`, and the `ClientGalleryModal`/`StoryDetailModal`
call sites follow the same pattern elsewhere — the component is unmounted when the guard prop is
falsy and freshly mounted (with a stable hook order from the start) when it becomes truthy again,
rather than being kept mounted and re-rendered with an alternating prop. It would break the
moment a parent stopped unmounting the component and instead rendered it continuously, passing
`activeImage`/`story` as `null` on some renders and a value on others — React would then detect
a hook called conditionally relative to the previous render and throw ("Rendered fewer hooks
than expected") or silently corrupt state. It would also break under a future React compiler or
lint configuration that enforces the Rules of Hooks statically (the current `npm run lint`, per
PS-011, runs `vite build` and does not lint at all, so this passes unnoticed today).

## Resolved

Four bugs found in the same audit were fixed in commit `8ef6d5e`, before this documentation
baseline, and are not open issues:

- **Doubled custom cursor** — the custom cursor was rendering twice.
- **Client-gallery favourites ID mismatch** — favourited photo IDs did not match the ID format
  of the actual photo records, so the favourites filter silently matched nothing.
- **Unguarded `JSON.parse` of localStorage** — reading `peak_story_stories`, `peak_story_photos`,
  or `peak_story_user` from localStorage with malformed contents would throw uncaught.
- **Colour-slider resize drift** — the before/after comparison slider's handle position drifted
  out of sync with the pointer on window resize.

**Caveat carried forward from the cursor fix:** the fix hides the native text-input caret at
viewport widths of 1024px and above (the breakpoint at which the custom cursor is shown instead
of the system cursor), and there is a brief window with no visible cursor at all — neither the
system arrow nor the custom cursor — before the first mouse movement is detected. Both are
accepted trade-offs of the current implementation, not regressions to re-open as new issues.
