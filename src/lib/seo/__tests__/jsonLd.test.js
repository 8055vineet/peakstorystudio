import { describe, it, expect } from 'vitest';
import { absoluteUrl, localBusinessJsonLd, websiteJsonLd, pageJsonLd } from '../jsonLd';
import { SITE_SETTINGS_FALLBACK } from '../../../data/siteSettingsFallback';
import { STATIC_SEO } from '../../../data/seo';

const SITE = 'https://peakstorystudio.in';

const stories = [{
  id: 'w-1', slug: 'a-royal-affair', title: 'A Royal Affair', couple: 'Sam & Alex',
  location: 'La Martiniere, Lucknow', date: 'November 2024',
  summary: 'Three days of ceremony under the winter sun.',
  coverImage: '/images/w/cover.jpg', fullGallery: ['/images/w/cover.jpg', '/images/w/two.jpg'], tags: [],
}, {
  id: 'w-2', slug: '', title: 'Unpublished shape', coverImage: '', fullGallery: [],
}];
const photos = [
  { id: 'g-1', title: 'Baraat', url: '/images/g/first.jpg', category: 'Wedding' },
  { id: 'g-2', title: 'Empty', url: '', category: 'Wedding' },
];
const films = [{
  id: 'f-1', title: 'A Film', couple: 'Sam & Alex', location: 'Lucknow',
  thumbnail: '/images/f/thumb.jpg', videoEmbedUrl: 'https://youtu.be/dQw4w9WgXcQ',
}];
const collections = [{
  id: 'c-1', slug: 'travels', title: 'Travels', description: 'On the road with couples.',
  items: [
    { id: 'i-1', url: '', videoEmbedUrl: 'https://youtu.be/dQw4w9WgXcQ', caption: 'Teaser' },
    { id: 'i-2', url: '/images/x/1.jpg', videoEmbedUrl: null, caption: null },
  ],
}];
const settings = {
  ...SITE_SETTINGS_FALLBACK,
  contact: { ...SITE_SETTINGS_FALLBACK.contact, instagramUrl: 'https://instagram.com/peakstory', youtubeUrl: '' },
  logo: '/media/logo.webp',
};
const data = { stories, photos, films, collections, settings, siteUrl: SITE };

describe('absoluteUrl', () => {
  it('prefixes a site-relative path with the site URL, tolerating a trailing slash', () => {
    expect(absoluteUrl('/gallery', SITE)).toBe('https://peakstorystudio.in/gallery');
    expect(absoluteUrl('/gallery', `${SITE}/`)).toBe('https://peakstorystudio.in/gallery');
  });

  it('returns the path unchanged when there is no site URL (local builds)', () => {
    expect(absoluteUrl('/gallery', '')).toBe('/gallery');
    expect(absoluteUrl('/gallery')).toBe('/gallery');
  });

  it('leaves an already-absolute URL (an R2 upload) alone', () => {
    expect(absoluteUrl('https://media.example/x.jpg', SITE)).toBe('https://media.example/x.jpg');
  });

  it('returns an empty string for an empty path — never a bare site root posing as an image', () => {
    expect(absoluteUrl('', SITE)).toBe('');
    expect(absoluteUrl(undefined, SITE)).toBe('');
  });
});

describe('localBusinessJsonLd', () => {
  const ld = localBusinessJsonLd({ settings, siteUrl: SITE });

  it('is a schema.org LocalBusiness for the studio at its Gomtinagar address', () => {
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('LocalBusiness');
    expect(ld.name).toBe('Peak Story Studio');
    expect(ld.url).toBe(SITE);
    expect(ld.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '2/231 Vastu Khand, Gomtinagar',
      addressLocality: 'Lucknow',
      addressRegion: 'Uttar Pradesh',
      addressCountry: 'IN',
    });
    expect(ld.areaServed).toEqual(['Lucknow', 'Uttar Pradesh']);
  });

  it('takes the phone and email from the settings row', () => {
    expect(ld.telephone).toBe('+91 8881621021');
    expect(ld.email).toBe('peakstorystudio@gmail.com');
  });

  it('builds absolute logo and image URLs', () => {
    expect(ld.logo).toBe('https://peakstorystudio.in/media/logo.webp');
    expect(ld.image).toBe('https://peakstorystudio.in/images/home/hero.webp');
  });

  it('lists only the social profiles that are set', () => {
    expect(ld.sameAs).toEqual(['https://instagram.com/peakstory']);
    const none = localBusinessJsonLd({ settings: SITE_SETTINGS_FALLBACK, siteUrl: SITE });
    expect(none).not.toHaveProperty('sameAs');
  });

  it('keeps relative paths when there is no site URL', () => {
    const local = localBusinessJsonLd({ settings, siteUrl: '' });
    expect(local.url).toBe('/');
    expect(local.logo).toBe('/media/logo.webp');
  });

  it('falls back to the shipped contact details and logo with no settings at all', () => {
    const bare = localBusinessJsonLd({});
    expect(bare.telephone).toBe('+91 8881621021');
    expect(bare.address.addressLocality).toBe('Lucknow');
    expect(bare.logo).toBe('/images/home/logo.webp');
    expect(bare).not.toHaveProperty('sameAs');
  });
});

describe('websiteJsonLd', () => {
  it('names the site and its URL', () => {
    expect(websiteJsonLd({ siteUrl: SITE })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Peak Story Studio',
      url: SITE,
      inLanguage: 'en',
    });
  });

  it('uses "/" when there is no site URL', () => {
    expect(websiteJsonLd({}).url).toBe('/');
  });
});

describe('pageJsonLd', () => {
  it('/gallery is an ImageGallery of the published photographs with a URL', () => {
    const ld = pageJsonLd('/gallery', data);
    expect(ld['@type']).toBe('ImageGallery');
    expect(ld.url).toBe('https://peakstorystudio.in/gallery');
    expect(ld.description).toBe(STATIC_SEO['/gallery'].description);
    expect(ld.image).toEqual(['https://peakstorystudio.in/images/g/first.jpg']);
  });

  it('/films is an ItemList of VideoObjects with name, thumbnail, and an embeddable URL', () => {
    const ld = pageJsonLd('/films', data);
    expect(ld['@type']).toBe('ItemList');
    expect(ld.itemListElement).toEqual([{
      '@type': 'ListItem',
      position: 1,
      item: {
        '@type': 'VideoObject',
        name: 'A Film',
        thumbnailUrl: 'https://peakstorystudio.in/images/f/thumb.jpg',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1',
      },
    }]);
  });

  it('/stories is an ItemList of the wedding page URLs, skipping a wedding without a slug', () => {
    const ld = pageJsonLd('/stories', data);
    expect(ld['@type']).toBe('ItemList');
    expect(ld.itemListElement).toEqual([{
      '@type': 'ListItem', position: 1, name: 'A Royal Affair', url: 'https://peakstorystudio.in/stories/a-royal-affair',
    }]);
  });

  it('/stories/<slug> is that wedding as an ImageGallery plus a Home > Stories > title breadcrumb', () => {
    const [gallery, crumbs] = pageJsonLd('/stories/a-royal-affair', data);
    expect(gallery['@type']).toBe('ImageGallery');
    expect(gallery.name).toBe('A Royal Affair');
    expect(gallery.url).toBe('https://peakstorystudio.in/stories/a-royal-affair');
    expect(gallery.description).toContain('Three days of ceremony');
    expect(gallery.image).toEqual(['https://peakstorystudio.in/images/w/cover.jpg', 'https://peakstorystudio.in/images/w/two.jpg']);
    expect(crumbs).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://peakstorystudio.in/' },
        { '@type': 'ListItem', position: 2, name: 'Stories', item: 'https://peakstorystudio.in/stories' },
        { '@type': 'ListItem', position: 3, name: 'A Royal Affair', item: 'https://peakstorystudio.in/stories/a-royal-affair' },
      ],
    });
  });

  it('/about is an AboutPage and /contact a ContactPage, each with its static description', () => {
    expect(pageJsonLd('/about', data)).toMatchObject({ '@type': 'AboutPage', url: `${SITE}/about`, description: STATIC_SEO['/about'].description });
    expect(pageJsonLd('/contact', data)).toMatchObject({ '@type': 'ContactPage', url: `${SITE}/contact`, description: STATIC_SEO['/contact'].description });
  });

  it('/more/<slug> is a CollectionPage named after the collection', () => {
    expect(pageJsonLd('/more/travels', data)).toMatchObject({
      '@type': 'CollectionPage',
      name: 'Travels',
      description: 'On the road with couples.',
      url: `${SITE}/more/travels`,
      image: `${SITE}/images/x/1.jpg`,
    });
  });

  it('every page object carries the schema.org context', () => {
    for (const route of ['/gallery', '/films', '/stories', '/about', '/contact', '/more/travels']) {
      expect(pageJsonLd(route, data)['@context'], route).toBe('https://schema.org');
    }
  });

  it('returns null for the home page, an unknown route, an unknown wedding, and an unknown collection', () => {
    expect(pageJsonLd('/', data)).toBeNull();
    expect(pageJsonLd('/nope', data)).toBeNull();
    expect(pageJsonLd('/stories/nope', data)).toBeNull();
    expect(pageJsonLd('/more/nope', data)).toBeNull();
  });

  it('uses relative URLs and empty lists with no site URL and no data', () => {
    expect(pageJsonLd('/gallery', {})).toMatchObject({ '@type': 'ImageGallery', url: '/gallery', image: [] });
    expect(pageJsonLd('/films', {})).toMatchObject({ '@type': 'ItemList', itemListElement: [] });
    expect(pageJsonLd('/stories', {})).toMatchObject({ '@type': 'ItemList', itemListElement: [] });
    expect(pageJsonLd('/about')).toMatchObject({ '@type': 'AboutPage', url: '/about' });
  });
});
