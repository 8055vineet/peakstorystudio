import React from 'react';
import PageHeader from '../components/PageHeader';
import Testimonials from '../components/Testimonials';
import { BRAND_STORY, HOME_IMAGES } from '../data/homeContent';

// Brand Story text and portrait come from the shared module — one source of
// truth for the studio's real copy, never a second typed-out copy.
export default function AboutPage({
  testimonials, brandStory = BRAND_STORY, portraitImage = HOME_IMAGES.brandStory,
}) {
  return (
    <div data-testid="about-page">
      <PageHeader title="About" />

      <section className="px-4 sm:px-6 py-14 border-t border-pitch-900/10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <img
            src={portraitImage.src}
            alt={portraitImage.alt}
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

      <Testimonials testimonials={testimonials} />
    </div>
  );
}
