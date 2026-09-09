import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import ErrorBoundary from '../components/ErrorBoundary';
import { metaFor, buildShell } from '../../scripts/lib/prerender-html.mjs';
import { storyByline } from '../data/seo';
import { SITE_SETTINGS_FALLBACK } from '../data/siteSettingsFallback';

// The prerendered HTML (scripts/prerender.mjs) ships a visible crawler
// shell inside <div id="root">. src/main.jsx then calls
// createRoot(root).render(...) on that same element — NOT hydrateRoot — so
// React must throw the shell away and mount the real page without a
// mismatch warning. This test mounts the way main.jsx does, on a container
// that already holds a real shell, and proves exactly that.

const MOCK_COLLECTIONS = [{
  id: 'c-1',
  slug: 'travels',
  title: 'Travels',
  description: 'On the road with couples.',
  items: [
    { id: 'i-1', url: '/images/x/1.jpg', videoEmbedUrl: null, caption: null },
    { id: 'i-2', url: '', videoEmbedUrl: 'https://youtu.be/dQw4w9WgXcQ', caption: 'Teaser' },
  ],
}];

const ROYAL_AFFAIR = {
  id: 'w-1', slug: 'a-royal-affair', title: 'A Royal Affair', couple: 'Sam & Alex', location: 'Jaipur',
  date: 'November 2024', summary: 'Three days under the desert sky.', coverImage: '/images/w/cover.jpg',
  fullGallery: ['/images/w/one.jpg', '/images/w/two.jpg'], videoUrl: null, tags: [],
};

const weddingsData = [ROYAL_AFFAIR];

// Pages fetch through these hooks; this test needs no network and no Supabase.
vi.mock('../hooks/useContent', () => ({
  useWeddings: () => ({ data: weddingsData, loading: false, error: null }),
  useGalleryPhotos: () => ({ data: [], loading: false, error: null }),
  useFilms: () => ({ data: [], loading: false, error: null }),
  useTestimonials: () => ({ data: [], loading: false, error: null }),
  useGalleryCategories: () => ({ data: ['Pre-Wedding', 'Wedding', 'Engagement', 'Haldi & Mehendi'], loading: false, error: null }),
  useBookingServices: () => ({ data: ['Cinematic Film', 'Fine Art Photography', 'Drone Aerials', 'Pre-Wedding Shoot'], loading: false, error: null }),
  useCollections: () => ({ data: MOCK_COLLECTIONS, loading: false, error: null }),
  useSiteSettings: () => ({
    data: {
      quote: { text: 'A settings-driven quote for testing.', credit: 'by tester' },
      brandStory: { heading: 'The Brand Story', paragraphs: ['P one.', 'P two.'] },
      images: {
        hero: { src: '/images/home/hero.jpg', alt: 'hero' },
        brandStory: { src: '/images/home/brand-story.jpg', alt: 'portrait' },
        closing: { src: '/images/home/closing.jpg', alt: 'closing' },
      },
      contact: {
        address: 'Settings Street 1', email: 'settings@example.test', phone: '+91 11111 11111',
        whatsappNumber: '911111111111', instagramUrl: '', youtubeUrl: '',
      },
      fonts: { heading: 'Playfair Display', body: 'Inter', quote: 'Marcellus' },
      appearance: { warmth: 1 },
      logo: '/images/home/logo.jpg',
    },
    loading: false,
    error: null,
  }),
}));

const PATH = '/stories/a-royal-affair';
const ORIGIN = 'http://localhost:4173';

let root;
let container;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe('React takeover of the prerendered shell', () => {
  it('createRoot().render() replaces the crawler shell with the page, leaving one h1 and no console error', async () => {
    const data = { stories: weddingsData, collections: [], photos: [], films: [], settings: SITE_SETTINGS_FALLBACK };
    const shell = buildShell(metaFor(PATH, data, ORIGIN), { byline: storyByline(ROYAL_AFFAIR) });

    // What the browser has before the bundle runs: the built HTML's #root
    // already holding the shell that scripts/prerender.mjs wrote into it.
    container = document.createElement('div');
    container.id = 'root';
    container.innerHTML = shell;
    document.body.appendChild(container);
    expect(container.querySelector('[data-prerender-shell]')).not.toBeNull();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.textContent).toContain('Sam & Alex · Jaipur · November 2024');

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mounted exactly as src/main.jsx does, with MemoryRouter standing in
    // for BrowserRouter so the test controls the URL.
    await act(async () => {
      root = createRoot(container);
      root.render(
        <React.StrictMode>
          <ErrorBoundary>
            <MemoryRouter initialEntries={[PATH]}>
              <App />
            </MemoryRouter>
          </ErrorBoundary>
        </React.StrictMode>,
      );
    });

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('A Royal Affair');

    expect(container.querySelector('[data-prerender-shell]')).toBeNull();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByTestId('story-page')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Photograph \d of 2$/ })).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
