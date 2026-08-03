import React from 'react';
import ScrollReveal from './ScrollReveal';

// The gallery as ceremony sections, per the owner's reference layout:
// a quiet uppercase label per ceremony, then the photographs two-up in
// their natural uploaded orientation — sharp corners, no rounding, no
// filter buttons. A category renders only when it has photographs, so an
// unpublished set leaves no gap. Categories the order list doesn't know
// (added later through the admin) append after the known ones rather
// than disappearing.
const SECTION_ORDER = ['Pre-Wedding', 'Wedding', 'Engagement', 'Haldi & Mehendi'];

export default function PhotoGallery({ photos, onOpenLightbox }) {
  const categories = [...new Set(photos.map((p) => p.category))].sort((a, b) => {
    const ia = SECTION_ORDER.indexOf(a);
    const ib = SECTION_ORDER.indexOf(b);
    return (ia === -1 ? SECTION_ORDER.length : ia) - (ib === -1 ? SECTION_ORDER.length : ib);
  });

  return (
    <section id="gallery" className="py-10 relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {photos.length === 0 && (
          <p className="text-center text-charcoal-500 py-16">Photographs are on their way.</p>
        )}

        {categories.map((category) => {
          const items = photos.filter((p) => p.category === category);
          return (
            <div key={category} className="mb-16">
              <ScrollReveal>
                <h2 className="text-center text-xs uppercase tracking-[0.3em] text-charcoal-500 mb-8">
                  {category}
                </h2>
              </ScrollReveal>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {items.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => onOpenLightbox(photo.url, photos.indexOf(photo), photos)}
                    aria-label={photo.title || 'View photo'}
                    className="block overflow-hidden group"
                  >
                    <img
                      src={photo.url}
                      alt={photo.title || ''}
                      loading="lazy"
                      className="w-full h-auto group-hover:scale-[1.02] transition-transform duration-700"
                    />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
