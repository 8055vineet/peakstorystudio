import React, { useState } from 'react';
import { Camera, Maximize2, LayoutGrid, Grid, Square } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

export default function PhotoGallery({ photos, onOpenLightbox }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [layoutColumns, setLayoutColumns] = useState(4); // 1, 2, or 4

  const categories = ['All', 'Royal', 'Candid', 'Pre-Wedding', 'Rituals', 'Details'];

  const filteredPhotos = activeCategory === 'All'
    ? photos
    : photos.filter((p) => p.category.toLowerCase() === activeCategory.toLowerCase());

  // Dynamic grid class based on column switcher choice
  const getGridClass = () => {
    if (layoutColumns === 1) return 'grid grid-cols-1 gap-8 auto-rows-[550px] max-w-4xl mx-auto';
    if (layoutColumns === 2) return 'grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-[400px]';
    return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[260px]';
  };

  return (
    <section id="gallery" className="py-24 relative bg-offwhite-100 overflow-hidden border-t border-pitch-900/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <ScrollReveal>
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-3">
            <div className="inline-flex items-center space-x-2 text-pitch-900 text-xs uppercase tracking-[0.3em] font-semibold">
              <Camera className="w-4 h-4" />
              <span>Fine Art Photography</span>
            </div>
            <h2 className="font-cinzel text-3xl sm:text-5xl font-bold tracking-tight text-pitch-900">
              THE FINE ART <span className="font-garamond italic font-normal">GALLERY</span>
            </h2>
            <p className="font-garamond text-xl text-charcoal-700 italic font-light">
              Every frame tells an indelible tale of romance, royal splendor, and raw emotion.
            </p>
          </div>
        </ScrollReveal>

        {/* Controls Bar: Category Filters + Grid Layout Switcher */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 border-b border-pitch-900/10 pb-6">
          
          {/* Category Filters */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {categories.map((cat) => {
              const count = cat === 'All' ? photos.length : photos.filter(p => p.category.toLowerCase() === cat.toLowerCase()).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs uppercase tracking-[0.15em] font-bold transition-all duration-300 flex items-center space-x-2 ${
                    activeCategory === cat
                      ? 'bg-pitch-900 text-offwhite-50 shadow-md'
                      : 'bg-offwhite-50 text-pitch-900 hover:bg-offwhite-200 border border-pitch-900/15'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    activeCategory === cat ? 'bg-offwhite-50/20 text-offwhite-50' : 'bg-offwhite-200 text-pitch-900'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Controls: Grid Switcher */}
          <div className="flex items-center space-x-4">

            {/* Column Layout Switcher */}
            <div className="flex items-center space-x-1 bg-offwhite-50 border border-pitch-900/15 p-1 rounded-full shadow-sm">
              <button
                onClick={() => setLayoutColumns(1)}
                className={`p-1.5 rounded-full transition-all ${layoutColumns === 1 ? 'bg-pitch-900 text-offwhite-50' : 'text-pitch-900/60 hover:text-pitch-900'}`}
                title="Single Column Editorial View"
              >
                <Square className="w-4 h-4" />
              </button>

              <button
                onClick={() => setLayoutColumns(2)}
                className={`p-1.5 rounded-full transition-all ${layoutColumns === 2 ? 'bg-pitch-900 text-offwhite-50' : 'text-pitch-900/60 hover:text-pitch-900'}`}
                title="2-Column Magazine View"
              >
                <Grid className="w-4 h-4" />
              </button>

              <button
                onClick={() => setLayoutColumns(4)}
                className={`p-1.5 rounded-full transition-all ${layoutColumns === 4 ? 'bg-pitch-900 text-offwhite-50' : 'text-pitch-900/60 hover:text-pitch-900'}`}
                title="4-Column Dense Gallery View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* Photo Grid */}
        <div className={getGridClass()}>
          {filteredPhotos.map((photo, index) => (
            <div
              key={photo.id || index}
              onClick={() => onOpenLightbox(photo.url, index, filteredPhotos)}
              data-cursor="ZOOM"
              className={`group relative rounded-2xl overflow-hidden cursor-pointer border border-pitch-900/10 hover:border-pitch-900/40 transition-all duration-500 hover:shadow-xl ${
                layoutColumns === 4 ? (photo.span || 'col-span-1 row-span-1') : 'col-span-1 row-span-1'
              }`}
            >
              {/* Image */}
              <img
                src={photo.url}
                alt={photo.title}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                loading="lazy"
              />

              {/* Leica-style Date & Monogram Stamp */}
              <div className="absolute top-3 left-3 z-10 font-mono text-[9px] uppercase tracking-widest text-offwhite-50 bg-pitch-950/70 backdrop-blur-md px-2.5 py-1 rounded border border-white/10 opacity-70 group-hover:opacity-100 transition-opacity">
                PSS / {photo.category.toUpperCase()}
              </div>

              {/* Hover Dark Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-pitch-950/90 via-pitch-950/20 to-transparent opacity-0 group-hover:opacity-90 transition-opacity duration-300" />

              {/* Top Zoom Icon */}
              <div className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-offwhite-50 text-pitch-900 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-pitch-900/10 shadow-sm">
                <Maximize2 className="w-4 h-4" />
              </div>

              {/* Bottom Caption & Category Badge */}
              <div className="absolute bottom-0 left-0 right-0 p-5 z-10 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 text-offwhite-50">
                <span className="text-[9px] uppercase tracking-widest text-pitch-900 bg-offwhite-50 px-2.5 py-0.5 rounded-full font-bold mb-1 inline-block">
                  {photo.category}
                </span>
                <h4 className="font-cinzel text-lg font-bold text-offwhite-50">
                  {photo.title}
                </h4>
                {photo.couple && (
                  <p className="font-garamond text-sm text-offwhite-200/80 italic">
                    {photo.couple} {photo.location && `• ${photo.location}`}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
