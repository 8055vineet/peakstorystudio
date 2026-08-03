# Multi-Page Redesign (Phase 3b, v0.4b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single scrollable public page with six routed pages (React Router v6) restyled to the owner's approved Home screenshot, with the studio's real Lucknow contact details.

**Architecture:** `react-router-dom` v6 with `BrowserRouter` in `src/main.jsx`; `src/App.jsx` keeps all session/modal state and renders a route table whose shared frame is a `Layout` component (new header + `<Outlet />` + new footer). Pages in `src/pages/` mount the existing presentational section components; ten retired components are deleted. Spec: `docs/superpowers/specs/2026-08-03-multi-page-redesign-design.md` — read it before any task; the owner's screenshot is the design authority.

**Tech Stack:** Vite 5, React 18, plain JavaScript (`.jsx`), Tailwind utility classes, react-router-dom v6, Vitest + React Testing Library.

## Global Constraints

- **No TypeScript.** Plain `.jsx`/`.js` only.
- **No raw hex in components.** Only Tailwind tokens from `tailwind.config.js`. The screenshot's maroon is the existing `pitch-600`/`pitch-700`; its cream is `offwhite-100`/`offwhite-50`. **No new color tokens.**
- **`gold-*` and `font-cinzel` classes must not appear in `src/components/` or `src/pages/` when this phase completes** (admin files in `src/admin/` are out of scope and exempt).
- **Components stay presentational.** State lives in `src/App.jsx` and flows down as props. No context providers. Components never import the Supabase client.
- **Do not touch:** anything under `src/admin/`, `src/lib/`, `src/hooks/` (except imports of hooks), `supabase/`, `scripts/`, or `BookingForm`'s submission logic. The inquiry pipeline is verified working; only its *styling* may change.
- **Empty-list tolerance:** every page and section must render (not throw) with `[]` data.
- **Exact copy, verbatim** (curly apostrophes/em-dash included where shown):
  - Quote: `Every journey builds toward a single, breathless moment. We are here to capture the story when it reaches its absolute peak.` Credit line: `by abhinav`
  - Brand Story paragraph 1: `At Peak Story Studio, we believe that life's most profound moments are not just lived—they unfold like a masterpiece. Whether it is the quiet, nervous anticipation right before a wedding ceremony or the soaring crescendo of a cinematic short film, every narrative has a summit.`
  - Brand Story paragraph 2: `Our passion lies in recognizing that exact heartbeat. We don't just record events; we wait for the emotion, the light, and the connection to converge at their highest point. By freezing time at the peak of your story, we turn fleeting chapters into timeless memories that you can relive forever.`
  - Contact: phone `+91 8881621021` · email `peakstorystudio@gmail.com` · address `2/231 Vastu Khand, Gomtinagar, Lucknow, UP` · WhatsApp digits `918881621021`
- **Dependency:** `react-router-dom` v6 only (not v7), installed `--save-exact`.
- **Conventional Commits.** Branch `phase-3b/multi-page-redesign` (already exists, spec committed).
- **Never run `npm run dev` from a subagent** (long-running; it hangs the harness). Build/test/lint only.
- `npm run lint` must stay at ≤2 warnings (the two tracked `useScrollReveal` warnings, `PS-021`).

## File Structure

**Create:** `src/pages/{HomePage,GalleryPage,FilmsPage,StoriesPage,AboutPage,ContactPage,NotFoundPage}.jsx`, `src/components/Layout.jsx`, `src/components/ScrollToTop.jsx`, `src/data/homeContent.js`, `public/images/home/{hero,brand-story,closing}.jpg`, `public/_redirects`, tests alongside.

**Rewrite in place:** `src/components/Navbar.jsx` (new centered header), `src/components/Footer.jsx` (new footer).

**Modify:** `src/main.jsx`, `src/App.jsx`, `index.html`, `tailwind.config.js`, `src/data/contact.js`, `src/data/weddingData.js`, `src/index.css`, and light restyles of `FeaturedStories`, `FilmsGallery`, `PhotoGallery`, `Testimonials`, `BookingForm`, `StoryDetailModal`, `WhatsAppButton`.

**Delete:** `src/components/{SplashScreen,CustomCursor,ScrollProgressBar,SectionDivider,FilmStrip,ColorGradingSlider,HorizontalGallery,Hero,AboutSection,AnimatedCounter}.jsx` and `src/components/__tests__/{SectionDivider,FilmStrip}.test.jsx`.

**Docs:** `docs/COMPONENTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/KNOWN-ISSUES.md`, `CLAUDE.md`.

---

### Task 1: Real contact details and the script font

**Files:**
- Modify: `src/data/contact.js`, `index.html:13`, `tailwind.config.js:37-41`
- Modify: `src/components/WhatsAppButton.jsx` (comment only), `src/components/__tests__/WhatsAppButton.test.jsx` (if it stubs `WHATSAPP_NUMBER`)
- Test: `src/data/__tests__/contact.test.js` (create)

**Interfaces:**
- Produces: `STUDIO_PHONE`, `STUDIO_EMAIL`, `STUDIO_ADDRESS`, `WHATSAPP_NUMBER`, `STUDIO_INSTAGRAM_URL`, `STUDIO_YOUTUBE_URL` (all string constants) from `src/data/contact.js`; Tailwind class `font-script`.

- [ ] **Step 1: Write the failing test** — `src/data/__tests__/contact.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  STUDIO_PHONE, STUDIO_EMAIL, STUDIO_ADDRESS,
  WHATSAPP_NUMBER, STUDIO_INSTAGRAM_URL, STUDIO_YOUTUBE_URL,
} from '../contact';

describe('studio contact details (confirmed by the owner 2026-08-03)', () => {
  it('carries the real Lucknow details, not the seeded Mumbai placeholders', () => {
    expect(STUDIO_PHONE).toBe('+91 8881621021');
    expect(STUDIO_EMAIL).toBe('peakstorystudio@gmail.com');
    expect(STUDIO_ADDRESS).toBe('2/231 Vastu Khand, Gomtinagar, Lucknow, UP');
  });
  it('has a WhatsApp number in wa.me digit form', () => {
    expect(WHATSAPP_NUMBER).toBe('918881621021');
  });
  it('leaves social URLs empty until the owner supplies them', () => {
    expect(STUDIO_INSTAGRAM_URL).toBe('');
    expect(STUDIO_YOUTUBE_URL).toBe('');
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run src/data/__tests__/contact.test.js` — expect FAIL (old values / missing exports).
- [ ] **Step 3: Replace `src/data/contact.js` entirely:**

```js
// One home for the studio's contact details.
//
// Confirmed real by the studio owner on 2026-08-03 (this closed PS-028):
// the studio is in Lucknow. Change these here and nowhere else — components
// must import them, never hardcode them.
export const STUDIO_PHONE = '+91 8881621021';
export const STUDIO_EMAIL = 'peakstorystudio@gmail.com';
export const STUDIO_ADDRESS = '2/231 Vastu Khand, Gomtinagar, Lucknow, UP';

// Digits only, country code first — the form wa.me links require.
export const WHATSAPP_NUMBER = '918881621021';

// Owner has not supplied these yet. Empty string means the footer renders the
// icon without a link (a plain span, not a dead anchor). Fill in when known.
export const STUDIO_INSTAGRAM_URL = '';
export const STUDIO_YOUTUBE_URL = '';
```

- [ ] **Step 4: Update `WhatsAppButton.jsx`'s comment** ("Renders nothing when unconfigured…" is now historical — the number is confirmed; keep the `if (!WHATSAPP_NUMBER) return null;` guard as cheap defence). If `WhatsAppButton.test.jsx` mocks/asserts the old env-driven behavior, update it to assert the link href contains `wa.me/918881621021`.
- [ ] **Step 5: Add the script font.** In `index.html` line 13 insert `&family=Great+Vibes` into the Google Fonts URL (alphabetical position after Cormorant Garamond). In `tailwind.config.js` `fontFamily`, add `script: ['Great Vibes', 'cursive'],`.
- [ ] **Step 6: Full suite** — `npm test` — expect PASS (fix any test still asserting Mumbai values; `git grep -n "98200 37027\|inquiries@peakstorystudio\|Andheri" src` must return nothing).
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: real Lucknow contact details and script font (closes PS-028)"`

### Task 2: Home content module and placeholder images

**Files:**
- Create: `src/data/homeContent.js`, `public/images/home/hero.jpg`, `public/images/home/brand-story.jpg`, `public/images/home/closing.jpg`
- Test: `src/data/__tests__/homeContent.test.js`

**Interfaces:**
- Produces: `HOME_QUOTE` (`{ text, credit }`), `BRAND_STORY` (`{ heading, paragraphs: [string, string] }`), `HOME_IMAGES` (`{ hero, brandStory, closing }`, each `{ src, alt }`).

- [ ] **Step 1: Failing test** — `src/data/__tests__/homeContent.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { HOME_QUOTE, BRAND_STORY, HOME_IMAGES } from '../homeContent';

describe('home page content', () => {
  it('carries the owner-approved quote verbatim', () => {
    expect(HOME_QUOTE.text).toBe(
      'Every journey builds toward a single, breathless moment. We are here to capture the story when it reaches its absolute peak.',
    );
    expect(HOME_QUOTE.credit).toBe('by abhinav');
  });
  it('carries both Brand Story paragraphs verbatim', () => {
    expect(BRAND_STORY.heading).toBe('The Brand Story');
    expect(BRAND_STORY.paragraphs).toHaveLength(2);
    expect(BRAND_STORY.paragraphs[0]).toMatch(/^At Peak Story Studio, we believe/);
    expect(BRAND_STORY.paragraphs[0]).toContain('lived—they unfold like a masterpiece');
    expect(BRAND_STORY.paragraphs[1]).toMatch(/relive forever\.$/);
  });
  it('points every image slot at the owner-swappable files', () => {
    expect(HOME_IMAGES.hero.src).toBe('/images/home/hero.jpg');
    expect(HOME_IMAGES.brandStory.src).toBe('/images/home/brand-story.jpg');
    expect(HOME_IMAGES.closing.src).toBe('/images/home/closing.jpg');
    for (const slot of Object.values(HOME_IMAGES)) expect(slot.alt).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it** — expect FAIL (module missing).
- [ ] **Step 3: Create `src/data/homeContent.js`** with the exact strings from Global Constraints:

```js
// Content of the Home page that is neither database-driven nor per-component.
//
// THE IMAGE SLOTS ARE OWNER-SWAPPABLE FILES: to change the hero, Brand Story
// portrait, or closing image, overwrite the file in public/images/home/ —
// no code edit. The committed files are placeholders (Unsplash imagery the
// site already displayed; Unsplash's license permits redistribution).
export const HOME_QUOTE = {
  text: 'Every journey builds toward a single, breathless moment. We are here to capture the story when it reaches its absolute peak.',
  credit: 'by abhinav',
};

export const BRAND_STORY = {
  heading: 'The Brand Story',
  paragraphs: [
    "At Peak Story Studio, we believe that life's most profound moments are not just lived—they unfold like a masterpiece. Whether it is the quiet, nervous anticipation right before a wedding ceremony or the soaring crescendo of a cinematic short film, every narrative has a summit.",
    "Our passion lies in recognizing that exact heartbeat. We don't just record events; we wait for the emotion, the light, and the connection to converge at their highest point. By freezing time at the peak of your story, we turn fleeting chapters into timeless memories that you can relive forever.",
  ],
};

export const HOME_IMAGES = {
  hero: { src: '/images/home/hero.jpg', alt: 'A couple photographed at their wedding' },
  brandStory: { src: '/images/home/brand-story.jpg', alt: 'Bride and groom at a flower-decked ceremony' },
  closing: { src: '/images/home/closing.jpg', alt: 'A bridal lehenga in low evening light' },
};
```

- [ ] **Step 4: Download the three placeholders** (network available; these exact URLs already appear in `src/data/weddingData.js`):

```bash
mkdir -p public/images/home
curl -sL -o public/images/home/hero.jpg "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&q=80&w=2000"
curl -sL -o public/images/home/brand-story.jpg "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1200"
curl -sL -o public/images/home/closing.jpg "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=2000"
```

Verify each file is a JPEG > 20KB (`file public/images/home/*.jpg`). If a download fails, stop and report BLOCKED — do not commit empty files.
- [ ] **Step 5: Run the test** — expect PASS. **Step 6: Commit** — `git add -A && git commit -m "feat: home content module with owner-swappable image slots"`

### Task 3: React Router wiring (old look, new URLs)

The site becomes multi-page in this task, still wearing the old design. Every later task restyles.

**Files:**
- Modify: `src/main.jsx`, `src/App.jsx`, `src/components/Navbar.jsx:22-29` (links only), `package.json`
- Create: `src/components/ScrollToTop.jsx`, `src/components/Layout.jsx`, all seven files in `src/pages/`, `public/_redirects`
- Test: `src/__tests__/App.routes.test.jsx`

**Interfaces:**
- Consumes: `useWeddings/useGalleryPhotos/useFilms/useTestimonials` from `src/hooks/useContent`; existing section components with the exact props `src/App.jsx` passes today (`FeaturedStories {stories,onOpenLightbox,onOpenVideo}`, `FilmsGallery {films,onOpenVideoModal}`, `PhotoGallery {photos,onOpenLightbox}`, `Testimonials {testimonials}`, `BookingForm` no props).
- Produces: page components with props — `HomePage {films, photos, onOpenLightbox, onOpenVideo}`, `GalleryPage {photos, onOpenLightbox}`, `FilmsPage {films, onOpenVideoModal}`, `StoriesPage {stories, onOpenLightbox, onOpenVideo}`, `AboutPage {testimonials}`, `ContactPage {}`, `NotFoundPage {}`; `Layout {user, onOpenAuthModal, onOpenClientGallery, onLogout}` rendering `<ScrollToTop/>`, `<Navbar …/>`, `<Outlet/>`, `<Footer/>`.

- [ ] **Step 1: Install** — `npm install --save-exact react-router-dom@6` (records an exact 6.x version; verify `node -e "console.log(require('react-router-dom/package.json').version)"` prints `6.…`).
- [ ] **Step 2: Failing test** — `src/__tests__/App.routes.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Pages fetch through these hooks; route tests need no network and no Supabase.
vi.mock('../hooks/useContent', () => ({
  useWeddings: () => ({ data: [], loading: false, error: null }),
  useGalleryPhotos: () => ({ data: [], loading: false, error: null }),
  useFilms: () => ({ data: [], loading: false, error: null }),
  useTestimonials: () => ({ data: [], loading: false, error: null }),
}));

const renderAt = (path) =>
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

describe('routing', () => {
  it.each([
    ['/', 'home-page'],
    ['/gallery', 'gallery-page'],
    ['/films', 'films-page'],
    ['/stories', 'stories-page'],
    ['/about', 'about-page'],
    ['/contact', 'contact-page'],
  ])('%s renders its page', (path, testId) => {
    renderAt(path);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it('an unknown URL renders the not-found page with a way home', () => {
    renderAt('/no-such-page');
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
  });

  it('every page shares the frame: header nav and footer are present', () => {
    renderAt('/gallery');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it** — expect FAIL (`MemoryRouter` has nothing to match; no testids).
- [ ] **Step 4: Implement.**
  - `src/main.jsx`: wrap `<App/>` — `<ErrorBoundary><BrowserRouter><App/></BrowserRouter></ErrorBoundary>`.
  - `src/components/ScrollToTop.jsx`:

```jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// A route change starts the new page at the top; browsers only do this for
// full document loads, not client-side navigations.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
```

  - `src/components/Layout.jsx`:

```jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import ScrollToTop from './ScrollToTop';
import Navbar from './Navbar';
import Footer from './Footer';

// The frame every public page shares. State stays in App (the convention);
// this component only arranges the frame around the routed page.
export default function Layout({ user, onOpenAuthModal, onOpenClientGallery, onLogout }) {
  return (
    <div className="min-h-screen bg-offwhite-100 text-pitch-900 font-sans selection:bg-pitch-900 selection:text-offwhite-50">
      <ScrollToTop />
      <Navbar
        user={user}
        onOpenAuthModal={onOpenAuthModal}
        onOpenClientGallery={onOpenClientGallery}
        onLogout={onLogout}
      />
      <main><Outlet /></main>
      <Footer />
    </div>
  );
}
```

  - Pages, each `data-testid`'d and wrapping today's section component with today's props. Exact contents:

```jsx
// src/pages/GalleryPage.jsx
import React from 'react';
import PhotoGallery from '../components/PhotoGallery';

export default function GalleryPage({ photos, onOpenLightbox }) {
  return (
    <div data-testid="gallery-page">
      <PhotoGallery photos={photos} onOpenLightbox={onOpenLightbox} />
    </div>
  );
}
```

```jsx
// src/pages/FilmsPage.jsx
import React from 'react';
import FilmsGallery from '../components/FilmsGallery';

export default function FilmsPage({ films, onOpenVideoModal }) {
  return (
    <div data-testid="films-page">
      <FilmsGallery films={films} onOpenVideoModal={onOpenVideoModal} />
    </div>
  );
}
```

```jsx
// src/pages/StoriesPage.jsx
import React from 'react';
import FeaturedStories from '../components/FeaturedStories';

export default function StoriesPage({ stories, onOpenLightbox, onOpenVideo }) {
  return (
    <div data-testid="stories-page">
      <FeaturedStories stories={stories} onOpenLightbox={onOpenLightbox} onOpenVideo={onOpenVideo} />
    </div>
  );
}
```

```jsx
// src/pages/AboutPage.jsx — Task 6 gives it the Brand Story; Testimonials now
import React from 'react';
import Testimonials from '../components/Testimonials';

export default function AboutPage({ testimonials }) {
  return (
    <div data-testid="about-page">
      <Testimonials testimonials={testimonials} />
    </div>
  );
}
```

```jsx
// src/pages/ContactPage.jsx
import React from 'react';
import BookingForm from '../components/BookingForm';

export default function ContactPage() {
  return (
    <div data-testid="contact-page">
      <BookingForm />
    </div>
  );
}
```

```jsx
// src/pages/HomePage.jsx — skeleton; Task 5 builds the real page
import React from 'react';
import { HOME_IMAGES } from '../data/homeContent';

export default function HomePage() {
  return (
    <div data-testid="home-page">
      <img src={HOME_IMAGES.hero.src} alt={HOME_IMAGES.hero.alt} className="w-full object-cover" />
    </div>
  );
}
```

```jsx
// src/pages/NotFoundPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div data-testid="not-found-page" className="min-h-[50vh] flex flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-garamond text-3xl text-pitch-900">This page does not exist.</p>
      <Link to="/" className="text-xs uppercase tracking-[0.2em] underline underline-offset-4 text-pitch-700 hover:text-pitch-900">
        Return home
      </Link>
    </div>
  );
}
```

  - `src/App.jsx`: delete the imports of `SplashScreen`, `ScrollProgressBar`, `CustomCursor`, `Hero`, `SectionDivider`, `FilmStrip`, `ColorGradingSlider`, `HorizontalGallery`, `AboutSection` and all their JSX, plus `splashDone` state and `scrollToBooking`. Keep: session state + effect, lightbox state/handlers, `videoModalUrl`, `authModalOpen`, `clientGalleryOpen`, `handleLoginSuccess`, `handleLogout`, and all four modals (`LightboxModal`, video modal JSX, `AuthModal`, `ClientGalleryModal`) rendered after the routes. Replace the old `<main>` with:

```jsx
<Routes>
  <Route
    element={
      <Layout
        user={user}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onOpenClientGallery={() => setClientGalleryOpen(true)}
        onLogout={handleLogout}
      />
    }
  >
    <Route index element={<HomePage films={films} photos={photos} onOpenLightbox={handleOpenLightbox} onOpenVideo={(url) => setVideoModalUrl(url)} />} />
    <Route path="gallery" element={<GalleryPage photos={photos} onOpenLightbox={handleOpenLightbox} />} />
    <Route path="films" element={<FilmsPage films={films} onOpenVideoModal={(url) => setVideoModalUrl(url)} />} />
    <Route path="stories" element={<StoriesPage stories={stories} onOpenLightbox={(url) => handleOpenLightbox(url)} onOpenVideo={(url) => setVideoModalUrl(url)} />} />
    <Route path="about" element={<AboutPage testimonials={testimonials} />} />
    <Route path="contact" element={<ContactPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route>
</Routes>
```

(`import { Routes, Route } from 'react-router-dom'`; import the seven pages and `Layout`. The wrapper `div` with the page-level classes moves into `Layout`, so `App` returns a fragment of `<Routes>` + modals.)
  - `src/components/Navbar.jsx` links only (full restyle is Task 4): replace the `navLinks` hrefs with router paths — `{ name: 'Home', to: '/' }, { name: 'Gallery', to: '/gallery' }, { name: 'Films', to: '/films' }, { name: 'Stories', to: '/stories' }, { name: 'About', to: '/about' }, { name: 'Contact', to: '/contact' }` — rendered with `<Link to={link.to}>` (`import { Link, useNavigate } from 'react-router-dom'`); the brand logo wraps in `<Link to="/">`; the Book Date buttons call `useNavigate()('/contact')` instead of `onOpenBooking` (drop that prop; `App` no longer passes it). `Footer.jsx`: if it contains `#anchor` links, point them at the same router paths with `Link` (mechanical; full rewrite is Task 4).
  - `public/_redirects` (one line, for the Phase 4 Cloudflare Pages deploy; static assets win over redirects there, so `admin.html` is unaffected): `/*    /index.html   200`
- [ ] **Step 5: Run the routing test** — expect PASS. **Step 6: Full suite + lint** — `npm test && npm run lint` — expect PASS (fix fallout: any test rendering a component that now uses `Link`/`useNavigate` needs a `<MemoryRouter>` wrapper).
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: six routed pages via react-router-dom, shared Layout frame"`

### Task 4: The new header and footer

**Files:**
- Rewrite: `src/components/Navbar.jsx`, `src/components/Footer.jsx`
- Test: `src/components/__tests__/Navbar.test.jsx`, `src/components/__tests__/Footer.test.jsx` (create both)

**Interfaces:**
- Consumes: `Navbar {user, onOpenAuthModal, onOpenClientGallery, onLogout}` (unchanged from Task 3); contact constants from Task 1.
- Produces: same prop contracts — Layout does not change.

Design (the screenshot is authoritative): header is a calm cream block, not fixed, no scroll-condensing (delete the `scrolled` state and its listener — this removes one of `PS-013`'s three scroll listeners). Centered column: wordmark `Peak Story Studio` in `font-garamond text-2xl sm:text-3xl tracking-[0.25em] text-pitch-900`, beneath it the six nav links (`text-xs uppercase tracking-[0.2em]`), rendered with `NavLink` — active page gets `underline underline-offset-8` in the same color, inactive gets `text-pitch-900/70 hover:text-pitch-900`. Top-right corner (absolute within the header, `hidden lg:flex`): quiet Sign In control (existing `user ? badge/logout : Sign In` logic, restyled — text button, no pill/gold) and a `Book Date` button (`bg-pitch-900 text-offwhite-50 px-4 py-2 text-xs uppercase tracking-[0.15em]`, navigates to `/contact`). Mobile (`md:` down): wordmark centered, hamburger right, drawer with the six links + Sign In + Book Date. Keep `aria-label`s on icon-only buttons.

Footer (`<footer>`, `bg-offwhite-50 border-t border-pitch-900/10`): three-zone grid — left the wordmark (`font-garamond tracking-[0.2em]`); center the contact block from `contact.js` (`STUDIO_ADDRESS`, then `Email: {STUDIO_EMAIL}`, then `Phone: {STUDIO_PHONE}`, small centered lines); right three labeled marks with lucide icons — `Film` "Wedding Films", `Camera` "Professional Photography", `Globe` "Online Delivery". Beneath, centered social row: Instagram, Youtube, MessageCircle (lucide). WhatsApp icon links to `https://wa.me/${WHATSAPP_NUMBER}`; Instagram/YouTube render as `<a>` **only when** their constant is non-empty, else a plain `<span>` with the icon (`aria-hidden` wrapper is fine, no dead `href="#"`).

- [ ] **Step 1: Failing tests:**

```jsx
// src/components/__tests__/Footer.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../Footer';

const renderFooter = () => render(<MemoryRouter><Footer /></MemoryRouter>);

describe('Footer', () => {
  it('shows the real Lucknow contact details', () => {
    renderFooter();
    expect(screen.getByText(/2\/231 Vastu Khand, Gomtinagar, Lucknow, UP/)).toBeInTheDocument();
    expect(screen.getByText(/peakstorystudio@gmail\.com/)).toBeInTheDocument();
    expect(screen.getByText(/\+91 8881621021/)).toBeInTheDocument();
  });
  it('links WhatsApp but leaves unset social networks unlinked', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'href', expect.stringContaining('wa.me/918881621021'),
    );
    expect(screen.queryByRole('link', { name: /instagram/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /youtube/i })).toBeNull();
  });
});
```

```jsx
// src/components/__tests__/Navbar.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Navbar from '../Navbar';

const noop = () => {};
const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar user={null} onOpenAuthModal={noop} onOpenClientGallery={noop} onLogout={noop} />
      <Routes>
        <Route path="*" element={null} />
        <Route path="/contact" element={<div data-testid="contact-route" />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Navbar', () => {
  it('renders the wordmark and all six page links', () => {
    renderAt('/');
    expect(screen.getByText(/Peak Story Studio/i)).toBeInTheDocument();
    for (const name of ['Home', 'Gallery', 'Films', 'Stories', 'About', 'Contact']) {
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0);
    }
  });
  it('marks the current page link as the active one', () => {
    renderAt('/films');
    const filmsLink = screen.getAllByRole('link', { name: 'Films' })[0];
    expect(filmsLink.getAttribute('aria-current')).toBe('page'); // NavLink sets this
  });
  it('Book Date navigates to /contact', () => {
    renderAt('/');
    fireEvent.click(screen.getAllByRole('button', { name: /book date/i })[0]);
    expect(screen.getByTestId('contact-route')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run** — expect FAIL. **Step 3: Rewrite both components** to the design above (no `gold-*`, no `font-cinzel`, no raw hex, no `scrolled` listener; keep the signed-in badge/logout logic from the old Navbar, restyled). **Step 4: Run the two test files, then the full suite** — expect PASS. **Step 5: Commit** — `git add -A && git commit -m "feat: centered wordmark header and three-zone footer per approved design"`

### Task 5: The Home page

**Files:**
- Rewrite: `src/pages/HomePage.jsx`
- Test: `src/pages/__tests__/HomePage.test.jsx` (create)

**Interfaces:**
- Consumes: `HomePage {films, photos, onOpenLightbox, onOpenVideo}` (wired in Task 3); `HOME_QUOTE`, `BRAND_STORY`, `HOME_IMAGES`; the film object's fields — read `src/components/FilmsGallery.jsx` first and use exactly the fields it renders (thumbnail image + title) and the URL field it passes to `onOpenVideoModal`; copy its test fixture shape from `src/components/__tests__/FilmsGallery.test.jsx`.

Page structure, top to bottom (all backgrounds `offwhite`, headings `font-garamond`):
1. **Hero:** `<img>` `HOME_IMAGES.hero`, full-bleed, `w-full max-h-[85vh] object-cover`.
2. **Quote:** centered, generous padding; text in `font-script text-2xl sm:text-4xl text-pitch-900 leading-relaxed` rendered wrapped in typographic quotes (`“…”`); credit `HOME_QUOTE.credit` beneath in `font-script text-lg text-charcoal-700`.
3. **Video block:** section with a `w-full aspect-video` area, `max-w-5xl mx-auto`. If `films.length > 0`: render the first film's thumbnail `object-cover` with a centered play button (`aria-label="Play film"`) that calls `onOpenVideo(<the URL field FilmsGallery passes>)`. Else: `bg-charcoal-400/60 flex items-center justify-center` with `Video to be added` in `font-garamond text-pitch-700 text-xl tracking-wide`.
4. **Images:** heading `Images` (`text-center font-garamond text-2xl tracking-[0.2em] text-pitch-900`, thin `border-b border-pitch-900/20` accent per the screenshot); grid (`data-testid="home-images-grid"`) of `photos.slice(0, 18)` — `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4`, each `<button aria-label={photo.alt || 'View photo'}>` wrapping `<img className="aspect-square w-full object-cover" loading="lazy">`, clicking calls `onOpenLightbox(url, index, photos)` with the same field `PhotoGallery` uses for its image URL (read `PhotoGallery.jsx` and reuse its field names exactly). Zero photos: render the heading plus `Photographs are on their way.` in `text-charcoal-500` — never throw.
5. **Brand Story:** two-column on `lg` (image left `HOME_IMAGES.brandStory`, text right): heading `BRAND_STORY.heading` in `font-garamond text-3xl tracking-[0.15em] text-pitch-700`, both paragraphs centered `text-sm leading-7 text-charcoal-800`.
6. **Closing image:** `HOME_IMAGES.closing`, full-bleed `w-full max-h-[70vh] object-cover`.

- [ ] **Step 1: Failing tests:**

```jsx
// src/pages/__tests__/HomePage.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../HomePage';
import { HOME_QUOTE, BRAND_STORY } from '../../data/homeContent';

// Match this fixture's field names to src/components/__tests__/FilmsGallery.test.jsx
// and PhotoGallery.test.jsx — the page must consume the same shapes the
// section components already consume.
const film = { /* copy fixture shape from FilmsGallery.test.jsx */ };
const photos = [ /* copy 2 fixtures from PhotoGallery.test.jsx */ ];

const renderPage = (props = {}) =>
  render(
    <MemoryRouter>
      <HomePage films={[]} photos={[]} onOpenLightbox={() => {}} onOpenVideo={() => {}} {...props} />
    </MemoryRouter>,
  );

describe('HomePage', () => {
  it('renders the quote and credit verbatim', () => {
    renderPage();
    expect(screen.getByText(new RegExp(HOME_QUOTE.text.slice(0, 40)))).toBeInTheDocument();
    expect(screen.getByText(HOME_QUOTE.credit)).toBeInTheDocument();
  });
  it('renders both Brand Story paragraphs', () => {
    renderPage();
    for (const p of BRAND_STORY.paragraphs) {
      expect(screen.getByText(new RegExp(p.slice(0, 40)))).toBeInTheDocument();
    }
  });
  it('shows "Video to be added" with no films, and a playable film with one', () => {
    renderPage();
    expect(screen.getByText('Video to be added')).toBeInTheDocument();
    const onOpenVideo = vi.fn();
    renderPage({ films: [film], onOpenVideo });
    fireEvent.click(screen.getByRole('button', { name: /play film/i }));
    expect(onOpenVideo).toHaveBeenCalledTimes(1);
  });
  it('survives an empty photo list', () => {
    renderPage();
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Photographs are on their way.')).toBeInTheDocument();
  });
  it('caps the grid at 18 photos', () => {
    const many = Array.from({ length: 24 }, (_, i) => ({ ...photos[0], id: `photo-${i}` }));
    renderPage({ photos: many });
    expect(within(screen.getByTestId('home-images-grid')).getAllByRole('button')).toHaveLength(18);
  });
});
```

(Fill the two fixtures from the existing test files before running; the test must not invent field names.)
- [ ] **Step 2: Run** — expect FAIL. **Step 3: Implement `HomePage.jsx`** per the structure above. **Step 4: Run page tests + full suite** — expect PASS. **Step 5: Commit** — `git add -A && git commit -m "feat: home page matching the approved screenshot design"`

### Task 6: Restyle the remaining pages and kept sections

**Files:**
- Modify: `src/pages/{GalleryPage,FilmsPage,StoriesPage,AboutPage,ContactPage}.jsx`; `src/components/{FeaturedStories,FilmsGallery,PhotoGallery,Testimonials,BookingForm,StoryDetailModal,WhatsAppButton}.jsx` (class-level restyle only — no logic, handler, or hook changes; `BookingForm` submission code untouched)
- Test: existing component tests must stay green; extend `src/pages/__tests__/AboutPage.test.jsx`, `ContactPage.test.jsx` (create)

Apply this **class translation** across the seven components and five pages (mechanical; judgment only for composition):

| Old | New |
| --- | --- |
| `font-cinzel` | `font-garamond` |
| `text-gold-400/500/600` | `text-pitch-600` |
| `bg-gold-*` | `bg-pitch-700` (or drop decorative gold fills) |
| `border-gold-*` | `border-pitch-900/20` |
| dark section shells (`bg-pitch-950`, `bg-pitch-900`, `bg-charcoal-900` as full-section backgrounds) | `bg-offwhite-100` with `text-pitch-900` (modals/overlays keep their dark scrims) |

Then per page: each of Gallery/Films/Stories gets a page header block (centered `font-garamond text-3xl tracking-[0.2em] text-pitch-900` title — `Gallery`, `Films`, `Stories` — with the same thin rule accent as Home's `Images` heading). **AboutPage** becomes: page title `About`, Brand Story block (image `HOME_IMAGES.brandStory` + `BRAND_STORY` heading/paragraphs — import from `homeContent`, do not copy the strings), then `Testimonials`. **ContactPage** becomes: page title `Contact`, a centered contact block (address/email/phone from `contact.js`, email and phone as `mailto:`/`tel:` links), the `WhatsAppButton`, then `BookingForm`.

- [ ] **Step 1: Failing page tests** — `AboutPage.test.jsx`: renders `BRAND_STORY.paragraphs[0]` (regex on first 40 chars) and survives `testimonials={[]}`; `ContactPage.test.jsx`: shows `2/231 Vastu Khand`, a `tel:` link containing `8881621021`, a `mailto:peakstorystudio@gmail.com` link, and the booking form's submit button. Follow the render idiom from Task 5's test (MemoryRouter wrapper; `BookingForm` renders in jsdom — see its own test file for any required setup/mocks and copy it).
- [ ] **Step 2: Run** — expect FAIL. **Step 3: Implement** the page compositions and the class translation. **Step 4: Enforce the constraint** — `git grep -nE "gold-|font-cinzel" src/components src/pages` must output nothing. **Step 5: Full suite + lint** — expect PASS; update any kept-component test that asserted a translated class. **Step 6: Commit** — `git add -A && git commit -m "feat: restyle all pages to the approved quiet design"`

### Task 7: Delete the retired components

**Files:**
- Delete: `src/components/{SplashScreen,CustomCursor,ScrollProgressBar,SectionDivider,FilmStrip,ColorGradingSlider,HorizontalGallery,Hero,AboutSection,AnimatedCounter}.jsx`, `src/components/__tests__/{SectionDivider,FilmStrip}.test.jsx`
- Modify: `src/data/weddingData.js` (remove the now-orphaned `FILM_STRIP_FRAMES` and `EDITORIAL_GALLERY` exports **and** the fabricated press/stats content that only `AboutSection` consumed, if any is exported from here — check imports before deleting anything), `src/index.css` (remove the custom-cursor block — the `cursor: none !important` rules at the top — and the `splashFadeOut` keyframes + `.animate-splash-out` and the `.horizontal-scroll` rules; keep scrollbar styling, paper-grain, and the `scrollFade*` keyframes used by `ScrollReveal`)

- [ ] **Step 1: Verify nothing imports the condemned** — `git grep -ln "SplashScreen\|CustomCursor\|ScrollProgressBar\|SectionDivider\|FilmStrip\|ColorGradingSlider\|HorizontalGallery\|AboutSection\|AnimatedCounter" src | grep -v __tests__` and `git grep -ln "from './Hero'\|components/Hero'" src` — the only hits must be the files being deleted. If anything else still imports one, fix that first (it is a Task 3–6 escape).
- [ ] **Step 2: Delete** the ten components and two test files (`git rm`). **Step 3: Prune** `weddingData.js` and `index.css` per above; `git grep -n "FILM_STRIP_FRAMES\|EDITORIAL_GALLERY" src` must return nothing.
- [ ] **Step 4: Full suite + lint** — `npm test && npm run lint` — expect PASS with ≤2 warnings. **Step 5: Commit** — `git add -A && git commit -m "refactor: delete retired single-page components (closes PS-020 by removal)"`

### Task 8: Documentation and the issue register

**Files:**
- Modify: `docs/COMPONENTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/KNOWN-ISSUES.md`, `CLAUDE.md`

Read each file fully before editing. Required edits:

- [ ] **Step 1: `docs/COMPONENTS.md`** — remove the ten deleted components' entries; add entries for `Layout` and `ScrollToTop` (they live in `src/components/`, so `check:docs` requires them); rewrite `Navbar`/`Footer` entries for the new design; add a short "Pages" section documenting the seven `src/pages/` components (not mechanically required, but the doc claims to describe the UI surface).
- [ ] **Step 2: `docs/ARCHITECTURE.md`** — replace the anchor-scroll navigation description with the router architecture (BrowserRouter in `main.jsx`, route table in `App.jsx`, Layout frame, state still in App flowing down as props); document the `public/images/home/` owner-swappable image-slot convention and `public/_redirects`.
- [ ] **Step 3: `docs/ROADMAP.md`** — add the Phase 3b row to the table after v0.4: `**v0.4b** | 3b — Multi-page redesign | Routed pages per navbar option; full restyle to the owner's approved design; real Lucknow contact details | Each nav option is its own URL; no fabricated press/stat claims rendered by any component; suite green | local`; update "Current position"; note explicitly that routing arrived early from Phase 5 scope (per-wedding URLs etc. remain there) and part of the truthful-content pass arrived early from Phase 7.
- [ ] **Step 4: `docs/KNOWN-ISSUES.md`** — move to Resolved (with one-line explanations naming this phase): `PS-013` (all three scroll listeners' owners deleted or rewritten without listeners), `PS-020` (SectionDivider deleted), `PS-023` (FilmStrip/HorizontalGallery deleted, arrays removed), `PS-028` (owner confirmed the Lucknow details on 2026-08-03). Update in place: `PS-002` (AboutSection deleted; remaining scope is `src/data/weddingData.js`'s TESTIMONIALS entry and the seeded database row — Phase 7), `PS-008` (routing now exists; remaining scope is per-wedding URLs/prerendering — Phase 5), `PS-030` (Navbar rewritten in 3b; admin badge still has no admin.html link — still Phase 4), `PS-016` (counts stale after 3b deletions; recount at Phase 7). Verify every file path cited in rows you touch still exists (`check:docs` enforces).
- [ ] **Step 5: `CLAUDE.md`** — Project section: replace "single-page app with no router — 'navigation' is anchor-link scrolling" with the six-route router description (react-router-dom v6, `src/pages/`, Layout frame; admin still its own entry). Conventions: rewrite the `PS-020` bullet (resolved by deletion in 3b — keep the no-raw-hex rule itself). Content integrity: record that Phase 3b removed the press strip, badge, and fabricated statistics from rendered components at the owner's direction, and that the remaining `PS-002` scope is `weddingData.js` + the seeded testimonial row.
- [ ] **Step 6: Gates** — `npm run check:docs && npm test && npm run lint` — all green. **Step 7: Commit** — `git add -A && git commit -m "docs: record Phase 3b — routing, redesign, resolved PS-013/020/023/028"`

### Task 9: Whole-branch verification

No new code. Controller may run this inline rather than dispatching.

- [ ] **Step 1:** `npm test` (full), `npm run lint` (≤2 warnings), `npm run check:docs` — all green.
- [ ] **Step 2:** `npm run build` — succeeds; then clean up per project convention: `git checkout -- dist/ && git clean -fx dist/`.
- [ ] **Step 3:** If the local Supabase stack and functions server are running, `npm run verify:inquiry` — must pass (Contact page mounts the same BookingForm; the pipeline must be provably intact). If the stack is not running, note it and have the controller run it before merge.
- [ ] **Step 4:** SPA smoke: **controller only** (never a subagent-launched dev server) — with the dev server running, `curl -s http://localhost:3000/gallery | grep -q '<div id="root">'` proves deep links serve the app shell.
- [ ] **Step 5:** `git grep -nE "gold-|font-cinzel" src/components src/pages` → empty; `git grep -n "Andheri\|98200 37027" src` → empty.
- [ ] **Step 6:** Commit anything the gates fixed; otherwise done — hand to superpowers:finishing-a-development-branch (merge is the owner's call; tag `v0.4b` on completion).
