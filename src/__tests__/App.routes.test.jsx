import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const MOCK_COLLECTIONS = [{
  id: 'c-1',
  slug: 'travels',
  title: 'Travels',
  description: 'On the road with couples.',
  items: [
    { id: 'i-1', url: '/images/x/1.jpg', videoEmbedUrl: null, caption: null },
    { id: 'i-2', url: '', videoEmbedUrl: 'https://www.youtube.com/embed/abc', caption: 'Teaser' },
  ],
}];

// Pages fetch through these hooks; route tests need no network and no Supabase.
vi.mock('../hooks/useContent', () => ({
  useWeddings: () => ({ data: [], loading: false, error: null }),
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
      fonts: { heading: 'Playfair Display', body: 'Inter' },
    },
    loading: false,
    error: null,
  }),
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

  it('applies the admin-chosen fonts as CSS variables on the document', () => {
    renderAt('/');
    expect(document.documentElement.style.getPropertyValue('--font-heading')).toContain('Playfair Display');
    expect(document.documentElement.style.getPropertyValue('--font-body')).toContain('Inter');
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

  it('shows the not-found content for an unknown slug once loaded', () => {
    renderAt('/more/nope');
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
  });

  it('shows the More menu in the navbar when pages exist', () => {
    renderAt('/');
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });
});
