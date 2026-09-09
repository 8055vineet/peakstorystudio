import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

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

// Mutable so individual tests can hand a route real content.
let weddingsData = [];
let photosData = [];
let settingsLoading = false;
const NON_DEFAULT_FONTS = { heading: 'Playfair Display', body: 'Inter', quote: 'Marcellus' };
let fontsData = NON_DEFAULT_FONTS;

// Pages fetch through these hooks; route tests need no network and no Supabase.
vi.mock('../hooks/useContent', () => ({
  useWeddings: () => ({ data: weddingsData, loading: false, error: null }),
  useGalleryPhotos: () => ({ data: photosData, loading: false, error: null }),
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
      fonts: fontsData,
      appearance: { warmth: 1 },
      logo: '/images/home/logo.jpg',
    },
    loading: settingsLoading,
    error: null,
  }),
}));

const renderAt = (path) =>
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

beforeEach(() => {
  window.sessionStorage.clear();
  weddingsData = [];
  photosData = [];
  settingsLoading = false;
  fontsData = NON_DEFAULT_FONTS;
  // The document persists across tests in this file; the fonts effect
  // leaves its <link> in document.head, so each test starts without one.
  document.getElementById('site-fonts')?.remove();
});

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

  it('applies the admin-chosen fonts as CSS variables on the document', () => {
    renderAt('/');
    expect(document.documentElement.style.getPropertyValue('--font-heading')).toContain('Playfair Display');
    expect(document.documentElement.style.getPropertyValue('--font-body')).toContain('Inter');
    expect(document.documentElement.style.getPropertyValue('--font-quote')).toContain('Marcellus');
  });

  // index.html loads only the three default families; anything else the
  // admin chose is fetched by exactly one <link id="site-fonts">.
  it('adds one site-fonts stylesheet link for the non-default families the settings chose', () => {
    renderAt('/');
    const links = document.querySelectorAll('link#site-fonts');
    expect(links).toHaveLength(1);
    const href = links[0].getAttribute('href');
    expect(links[0].getAttribute('rel')).toBe('stylesheet');
    expect(href).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?/);
    expect(href).toContain('family=Playfair+Display');
    expect(href).toContain('family=Inter');
    expect(href).toContain('family=Marcellus');
  });

  it('adds no site-fonts link when the settings resolve to the three defaults, and removes a stale one', () => {
    fontsData = { heading: 'Cormorant Garamond', body: 'Plus Jakarta Sans', quote: 'Quicksand' };
    const stale = document.createElement('link');
    stale.id = 'site-fonts';
    stale.rel = 'stylesheet';
    stale.href = 'https://fonts.googleapis.com/css2?family=Inter&display=swap';
    document.head.appendChild(stale);
    renderAt('/');
    expect(document.querySelector('link#site-fonts')).toBeNull();
  });

  it('applies the admin-chosen surface warmth as CSS variables on the document', () => {
    renderAt('/');
    expect(document.documentElement.style.getPropertyValue('--offwhite-100')).toBe('#f6efe1');
  });

  it('plays the intro splash on Home', () => {
    renderAt('/');
    expect(screen.getByTestId('intro-splash')).toBeInTheDocument();
  });

  it('does not render the intro splash off Home', () => {
    renderAt('/gallery');
    expect(screen.queryByTestId('intro-splash')).toBeNull();
  });

  it('an unknown URL renders the not-found page with a way home', () => {
    renderAt('/no-such-page');
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /return home/i })).toHaveAttribute('href', '/');
  });

  it('every page shares the frame: header nav and footer are present', () => {
    renderAt('/gallery');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  // The site's singular content comes from useSiteSettings, not constants —
  // these three assert the settings actually reach what a visitor sees.
  it('Home renders the settings-driven quote', () => {
    renderAt('/');
    expect(screen.getByText(/A settings-driven quote for testing\./)).toBeInTheDocument();
  });

  it('the footer renders the settings-driven contact details on every page', () => {
    renderAt('/gallery');
    expect(screen.getByText(/Settings Street 1/)).toBeInTheDocument();
  });

  it('the contact page renders the settings-driven phone', () => {
    renderAt('/contact');
    expect(screen.getAllByText(/\+91 11111 11111/).length).toBeGreaterThan(0);
  });
});

describe('/more/:slug', () => {
  it('renders a published collection page with its photos and videos', () => {
    renderAt('/more/travels');
    expect(screen.getByRole('heading', { name: 'Travels' })).toBeInTheDocument();
    expect(screen.getByText('On the road with couples.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view photo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play video/i })).toBeInTheDocument();
  });

  it('normalizes a collection video URL when the modal opens', () => {
    renderAt('/more/travels');
    fireEvent.click(screen.getByRole('button', { name: /play video/i }));
    const iframe = document.querySelector('iframe[title="Cinematic Film Preview"]');
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute('src')).toContain('/embed/dQw4w9WgXcQ');
  });

  it('shows the not-found content for an unknown slug once loaded', () => {
    renderAt('/more/nope');
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
  });

  it('shows the More menu in the navbar when pages exist', () => {
    renderAt('/');
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });
});

const ROYAL_AFFAIR = {
  id: 'w-1', slug: 'a-royal-affair', title: 'A Royal Affair', couple: 'Sam & Alex', location: 'Jaipur',
  date: 'November 2024', summary: 'Three days under the desert sky.', coverImage: '/images/w/cover.jpg',
  fullGallery: ['/images/w/one.jpg', '/images/w/two.jpg'], videoUrl: null, tags: [],
};

describe('/stories/:slug', () => {
  it('renders the wedding at its own URL, under the shared frame', () => {
    weddingsData = [ROYAL_AFFAIR];
    renderAt('/stories/a-royal-affair');
    expect(screen.getByTestId('story-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'A Royal Affair' })).toBeInTheDocument();
    expect(screen.getByText(/Three days under the desert sky\./)).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('names the tab after the wedding', () => {
    weddingsData = [ROYAL_AFFAIR];
    renderAt('/stories/a-royal-affair');
    expect(document.title).toBe('A Royal Affair | Peak Story Studio');
  });

  it('the card on /stories links to that page', () => {
    weddingsData = [ROYAL_AFFAIR];
    renderAt('/stories');
    expect(screen.getByRole('link', { name: /A Royal Affair/ })).toHaveAttribute('href', '/stories/a-royal-affair');
  });

  it('shows the not-found content for an unknown slug once loaded', () => {
    weddingsData = [ROYAL_AFFAIR];
    renderAt('/stories/no-such-wedding');
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
  });
});

describe('stories lightbox', () => {
  it('a story page opens the lightbox on the clicked album photograph, not on the first gallery photo', () => {
    weddingsData = [ROYAL_AFFAIR];
    photosData = [{ id: 'g-1', title: 'Unrelated gallery photo', url: '/images/g/first.jpg', category: 'Wedding', couple: '', location: '' }];
    renderAt('/stories/a-royal-affair');
    fireEvent.click(screen.getByRole('button', { name: 'Photograph 2 of 2' }));
    expect(screen.getByRole('img', { name: 'Wedding Photograph' })).toHaveAttribute('src', '/images/w/two.jpg');
  });
});

describe('home while settings load', () => {
  it('holds the Home page until the site settings resolve, so the intro never covers an already-painted page', () => {
    settingsLoading = true;
    renderAt('/');
    expect(screen.queryByTestId('home-page')).toBeNull();
    expect(screen.queryByTestId('intro-splash')).toBeNull();
  });
});

describe('fonts while settings load', () => {
  it('keeps the prerendered site-fonts link until the settings query resolves', () => {
    const link = document.createElement('link');
    link.id = 'site-fonts'; link.rel = 'stylesheet'; link.href = 'https://fonts.googleapis.com/css2?family=Cinzel&display=swap';
    document.head.appendChild(link);
    settingsLoading = true;
    renderAt('/gallery');
    expect(document.getElementById('site-fonts')?.getAttribute('href')).toContain('Cinzel');
    link.remove();
  });
});
