import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

// Same module-registry hygiene as queries.test.js: siteSettings.js pulls in
// mediaUrl.js, which reads import.meta.env at load time.
beforeEach(() => {
  vi.resetModules();
  mockFrom.mockReset();
});

function singleResult(row, error = null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve({ data: row, error }),
  };
  return chain;
}

async function importSettings(baseUrl = 'https://cdn.peakstorystudio.test') {
  vi.stubEnv('VITE_MEDIA_BASE_URL', baseUrl);
  return import('../siteSettings');
}

const FULL_ROW = {
  quote_text: 'A quote.',
  quote_credit: 'by someone',
  brand_story_heading: 'The Brand Story',
  brand_story_p1: 'First paragraph.',
  brand_story_p2: 'Second paragraph.',
  studio_address: 'An address',
  studio_email: 'studio@example.test',
  studio_phone: '+91 00000 00000',
  whatsapp_number: '910000000000',
  instagram_url: 'https://instagram.com/x',
  youtube_url: '',
  heading_font: 'Playfair Display',
  body_font: 'Inter',
  quote_font: 'Marcellus',
  surface_warmth: 0.75,
  logo: { storage_path: 'uploads/logo.webp' },
  hero: { storage_path: 'uploads/hero.webp', alt_text: 'Uploaded hero' },
  brand_story: { storage_path: '/images/home/brand-story.jpg', alt_text: '' },
  closing: null,
};

describe('getSiteSettings', () => {
  it('maps a full row: text through, media resolved, alt falling back per slot', async () => {
    mockFrom.mockReturnValue(singleResult(FULL_ROW));
    const { getSiteSettings } = await importSettings();
    const settings = await getSiteSettings();

    expect(settings.quote).toEqual({ text: 'A quote.', credit: 'by someone' });
    expect(settings.brandStory).toEqual({
      heading: 'The Brand Story',
      paragraphs: ['First paragraph.', 'Second paragraph.'],
    });
    // bucket key resolves against the base; alt from the media row
    expect(settings.images.hero).toEqual({
      src: 'https://cdn.peakstorystudio.test/uploads/hero.webp',
      alt: 'Uploaded hero',
    });
    // static path passes through; blank alt falls back to the constant's alt
    expect(settings.images.brandStory.src).toBe('/images/home/brand-story.jpg');
    expect(settings.images.brandStory.alt).toBeTruthy();
    // null media -> the shipped static slot
    expect(settings.images.closing.src).toBe('/images/home/closing.jpg');
    expect(settings.contact).toEqual({
      address: 'An address',
      email: 'studio@example.test',
      phone: '+91 00000 00000',
      whatsappNumber: '910000000000',
      instagramUrl: 'https://instagram.com/x',
      youtubeUrl: '',
    });
    expect(settings.fonts).toEqual({ heading: 'Playfair Display', body: 'Inter', quote: 'Marcellus' });
    expect(settings.appearance).toEqual({ warmth: 0.75 });
    expect(settings.logo).toBe('https://cdn.peakstorystudio.test/uploads/logo.webp');
  });

  it('falls back to all three static paths when every media id is null', async () => {
    mockFrom.mockReturnValue(singleResult({
      ...FULL_ROW, logo: null, hero: null, brand_story: null, closing: null,
    }));
    const { getSiteSettings } = await importSettings();
    const settings = await getSiteSettings();
    expect(settings.images.hero.src).toBe('/images/home/hero.jpg');
    expect(settings.images.brandStory.src).toBe('/images/home/brand-story.jpg');
    expect(settings.images.closing.src).toBe('/images/home/closing.jpg');
    expect(settings.logo).toBeNull();
  });

  it('defaults surface warmth to 0.5 when the column is null', async () => {
    mockFrom.mockReturnValue(singleResult({ ...FULL_ROW, surface_warmth: null }));
    const { getSiteSettings } = await importSettings();
    const settings = await getSiteSettings();
    expect(settings.appearance).toEqual({ warmth: 0.5 });
  });

  it('throws a prefixed error on a Postgres failure', async () => {
    mockFrom.mockReturnValue(singleResult(null, { message: 'boom' }));
    const { getSiteSettings } = await importSettings();
    await expect(getSiteSettings()).rejects.toThrow('getSiteSettings: boom');
  });
});

describe('SITE_SETTINGS_FALLBACK', () => {
  it('mirrors the shipped constants exactly', async () => {
    const { SITE_SETTINGS_FALLBACK } = await import('../../../data/siteSettingsFallback');
    const { HOME_QUOTE, BRAND_STORY, HOME_IMAGES } = await import('../../../data/homeContent');
    const contact = await import('../../../data/contact');

    expect(SITE_SETTINGS_FALLBACK).toEqual({
      quote: { text: HOME_QUOTE.text, credit: HOME_QUOTE.credit },
      brandStory: { heading: BRAND_STORY.heading, paragraphs: BRAND_STORY.paragraphs },
      images: HOME_IMAGES,
      contact: {
        address: contact.STUDIO_ADDRESS,
        email: contact.STUDIO_EMAIL,
        phone: contact.STUDIO_PHONE,
        whatsappNumber: contact.WHATSAPP_NUMBER,
        instagramUrl: contact.STUDIO_INSTAGRAM_URL,
        youtubeUrl: contact.STUDIO_YOUTUBE_URL,
      },
      fonts: { heading: 'Cormorant Garamond', body: 'Plus Jakarta Sans', quote: 'Quicksand' },
      appearance: { warmth: 0.5 },
      logo: null,
    });
  });
});
