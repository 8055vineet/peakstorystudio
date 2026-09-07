import { describe, it, expect } from 'vitest';
import { STATIC_SEO, descriptionFor, cardImageFor } from '../seo';
import { SITE_SETTINGS_FALLBACK } from '../siteSettingsFallback';

const ROUTES = ['/', '/gallery', '/films', '/stories', '/about', '/contact'];

const stories = [{
  id: 'w-1', slug: 'a-royal-affair', title: 'A Royal Affair', couple: 'Sam & Alex',
  location: 'La Martiniere, Lucknow', date: 'November 2024',
  summary: 'Three days of ceremony under the winter sun.',
  coverImage: '/images/w/cover.jpg', fullGallery: ['/images/w/cover.jpg', '/images/w/two.jpg'], tags: [],
}];
const photos = [{ id: 'g-1', title: 'Baraat', url: '/images/g/first.jpg', category: 'Wedding' }];
const films = [{ id: 'f-1', title: 'A Film', thumbnail: '/images/f/thumb.jpg', videoEmbedUrl: 'https://youtu.be/dQw4w9WgXcQ' }];
const collections = [{
  id: 'c-1', slug: 'travels', title: 'Travels', description: 'On the road with couples.',
  items: [
    { id: 'i-1', url: '', videoEmbedUrl: 'https://youtu.be/dQw4w9WgXcQ', caption: 'Teaser' },
    { id: 'i-2', url: '/images/x/1.jpg', videoEmbedUrl: null, caption: null },
  ],
}];
const settings = SITE_SETTINGS_FALLBACK;
const data = { stories, photos, films, collections, settings };

describe('STATIC_SEO', () => {
  it.each(ROUTES)('%s has a description that names Lucknow and stays within a search snippet', (route) => {
    const { description } = STATIC_SEO[route];
    expect(description).toMatch(/Lucknow/);
    expect(description.length).toBeGreaterThan(60);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it('never claims awards, press, or statistics (CLAUDE.md content-integrity rule)', () => {
    for (const { description } of Object.values(STATIC_SEO)) {
      expect(description).not.toMatch(/award|featured in|vogue|\d+\+|\d{2,} weddings/i);
    }
  });
});

describe('descriptionFor', () => {
  it.each(ROUTES)('%s returns the static copy', (route) => {
    expect(descriptionFor(route, data)).toBe(STATIC_SEO[route].description);
  });

  it('ignores a trailing slash', () => {
    expect(descriptionFor('/gallery/', data)).toBe(STATIC_SEO['/gallery'].description);
  });

  it('/stories/<slug> describes that wedding: its summary, then where and when', () => {
    expect(descriptionFor('/stories/a-royal-affair', data))
      .toBe('Three days of ceremony under the winter sun. Sam & Alex — La Martiniere, Lucknow, November 2024.');
  });

  it('/stories/<slug> copes with a wedding that has no summary or date', () => {
    const bare = { ...data, stories: [{ ...stories[0], summary: '', date: '' }] };
    expect(descriptionFor('/stories/a-royal-affair', bare)).toBe('Sam & Alex — La Martiniere, Lucknow.');
  });

  it('/stories/<unknown> falls back to the Stories copy', () => {
    expect(descriptionFor('/stories/nope', data)).toBe(STATIC_SEO['/stories'].description);
  });

  it('/more/<slug> returns the collection description', () => {
    expect(descriptionFor('/more/travels', data)).toBe('On the road with couples.');
  });

  it('returns an empty string for an unknown route, an unknown collection, and empty data', () => {
    expect(descriptionFor('/no-such-page', data)).toBe('');
    expect(descriptionFor('/more/nope', data)).toBe('');
    expect(descriptionFor('/more/travels', {})).toBe('');
    expect(descriptionFor('/more/travels')).toBe('');
  });
});

describe('cardImageFor', () => {
  it.each([
    ['/', settings.images.hero.src],
    ['/contact', settings.images.hero.src],
    ['/about', settings.images.brandStory.src],
    ['/gallery', '/images/g/first.jpg'],
    ['/films', '/images/f/thumb.jpg'],
    ['/stories', '/images/w/cover.jpg'],
    ['/stories/a-royal-affair', '/images/w/cover.jpg'],
    ['/more/travels', '/images/x/1.jpg'],
  ])('%s → %s', (route, expected) => {
    expect(cardImageFor(route, data)).toBe(expected);
  });

  it('skips a collection item that is a video with no photograph', () => {
    expect(cardImageFor('/more/travels', data)).toBe('/images/x/1.jpg');
  });

  it('returns an empty string when the image is unavailable', () => {
    const empty = { stories: [], photos: [], films: [], collections: [], settings: { images: {} } };
    for (const route of [...ROUTES, '/stories/a-royal-affair', '/more/travels', '/nope']) {
      expect(cardImageFor(route, empty), route).toBe('');
    }
    expect(cardImageFor('/', {})).toBe('');
    expect(cardImageFor('/gallery')).toBe('');
  });
});
