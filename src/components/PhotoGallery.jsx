import React from 'react';
import ScrollReveal from './ScrollReveal';
import { GALLERY_CATEGORY_FALLBACK } from '../data/galleryCategories';

// The gallery as ceremony sections: a quiet uppercase label per ceremony,
// then the photographs as a dense grid of square tiles — sharp corners, no
// rounding, no filter buttons. Tiles crop square (the owner's "square photo
// format"); clicking opens the full uncropped photograph in the lightbox.
// Density matters here: 64 natural-height photographs two-up produced a
// 24,000px page where visitors never discovered the later sections. A
// category renders only when it has photographs, so an unpublished set
// leaves no gap. Section order comes from the admin-managed category list
// (`categoryOrder`, defaulting to the shipped fallback when the database is
// unreachable); categories the order list doesn't know append after the
// known ones rather than disappearing.
export default function PhotoGallery({ photos, onOpenLightbox, categoryOrder = GALLERY_CATEGORY_FALLBACK }) {
  const categories = [...new Set(photos.map((p) => p.category))].sort((a, b) => {
    const ia = categoryOrder.indexOf(a);
    const ib = categoryOrder.indexOf(b);
    return (ia === -1 ? categoryOrder.length : ia) - (ib === -1 ? categoryOrder.length : ib);
  });

  return (
    <section id="gallery" className="py-10 relative border-t border-pitch-900/10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {photos.length === 0 && (
          <p className="text-center text-charcoal-500 py-16">Photographs are on their way.</p>
        )}

        {categories.map((category) => {
          const items = photos.filter((p) => p.category === category);
          return (
            <div key={category} className="mb-14">
              <ScrollReveal>
                <h2 className="text-center text-xs uppercase tracking-[0.3em] text-charcoal-500 mb-6">
                  {category}
                </h2>
              </ScrollReveal>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
                      className="aspect-square w-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
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
