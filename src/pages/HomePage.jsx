import React from 'react';
import { Play } from 'lucide-react';
import { HOME_QUOTE, BRAND_STORY, HOME_IMAGES } from '../data/homeContent';

// The Home page, section for section from the owner's approved screenshot:
// hero image → script quote → video block → images grid → Brand Story →
// closing image. The header and footer come from Layout.
export default function HomePage({
  films = [], photos = [], onOpenLightbox, onOpenVideo,
  quote = HOME_QUOTE, brandStory = BRAND_STORY, images = HOME_IMAGES,
}) {
  const featuredFilm = films.length > 0 ? films[0] : null;
  const gridPhotos = photos.slice(0, 18);

  return (
    <div data-testid="home-page">

      {/* Hero */}
      <img
        src={images.hero.src}
        alt={images.hero.alt}
        className="w-full max-h-[85vh] object-cover"
      />

      {/* Quote — no solid background of its own, so the petals layer shows through */}
      <section className="px-6 py-16 sm:py-20 text-center">
        <blockquote className="max-w-3xl mx-auto">
          <p className="font-script text-2xl sm:text-4xl text-pitch-900 leading-relaxed">
            &ldquo;{quote.text}&rdquo;
          </p>
          <cite className="mt-4 block font-script text-lg text-charcoal-700 not-italic">
            {quote.credit}
          </cite>
        </blockquote>
      </section>

      {/* Video */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-5xl mx-auto w-full aspect-video overflow-hidden">
          {featuredFilm ? (
            <div className="relative w-full h-full group">
              <img
                src={featuredFilm.thumbnail}
                alt={featuredFilm.title}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => onOpenVideo(featuredFilm.videoEmbedUrl)}
                aria-label="Play film"
                className="absolute inset-0 flex items-center justify-center bg-pitch-950/30 hover:bg-pitch-950/15 transition-colors"
              >
                <span className="w-16 h-16 rounded-full bg-pitch-900 text-offwhite-50 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="w-7 h-7 fill-current ml-1" />
                </span>
              </button>
            </div>
          ) : (
            <div className="w-full h-full bg-charcoal-400/60 flex items-center justify-center">
              <p className="font-garamond text-pitch-700 text-xl tracking-wide">Video to be added</p>
            </div>
          )}
        </div>
      </section>

      {/* Images */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center font-garamond text-2xl tracking-[0.2em] text-pitch-900">
            Images
          </h2>
          <div className="w-40 mx-auto mt-3 mb-10 border-b border-pitch-900/20" aria-hidden="true" />

          {gridPhotos.length > 0 ? (
            <div data-testid="home-images-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {gridPhotos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => onOpenLightbox(photo.url, index, photos)}
                  aria-label={photo.title || 'View photo'}
                  className="block overflow-hidden"
                >
                  <img
                    src={photo.url}
                    alt={photo.title || ''}
                    loading="lazy"
                    className="aspect-square w-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-charcoal-500">Photographs are on their way.</p>
          )}
        </div>
      </section>

      {/* The Brand Story */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <img
            src={images.brandStory.src}
            alt={images.brandStory.alt}
            className="w-full max-h-[560px] object-cover"
          />
          <div className="text-center space-y-6">
            <h2 className="font-garamond text-3xl tracking-[0.15em] text-pitch-700 font-semibold uppercase">
              {brandStory.heading}
            </h2>
            {brandStory.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="text-sm leading-7 text-charcoal-800">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Closing image */}
      <img
        src={images.closing.src}
        alt={images.closing.alt}
        className="w-full max-h-[70vh] object-cover"
      />
    </div>
  );
}
