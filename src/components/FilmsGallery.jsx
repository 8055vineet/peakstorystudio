import React from 'react';
import { Play, Film, Clock } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

export default function FilmsGallery({ films, onOpenVideoModal }) {
  return (
    <section id="films" className="py-24 relative bg-offwhite-50 text-pitch-900 border-t border-pitch-900/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <ScrollReveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <div className="inline-flex items-center space-x-2 text-pitch-900 text-xs uppercase tracking-[0.3em] font-semibold mb-3">
                <Film className="w-4 h-4" />
                <span>Cinema & Teaser Showcase</span>
              </div>
              <h2 className="font-cinzel text-3xl sm:text-5xl font-bold tracking-tight">
                CINEMATIC <span className="font-garamond italic font-normal">WEDDING FILMS</span>
              </h2>
            </div>
            <p className="font-garamond text-xl text-charcoal-700 italic max-w-md font-light">
              Rendered as illustrious as contemporary cinema—experience our high-definition wedding showreels.
            </p>
          </div>
        </ScrollReveal>

        {/* Films Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {films.map((film, index) => (
            <ScrollReveal key={film.id} delay={index * 150} className="h-full">
              <div
                onClick={() => onOpenVideoModal(film.videoEmbedUrl)}
                data-cursor="PLAY FILM"
                className="group relative bg-white rounded-3xl overflow-hidden minimal-card cursor-pointer transition-all duration-500 h-full flex flex-col"
              >
                {/* Thumbnail Container */}
                <div className="relative aspect-video img-zoom-container overflow-hidden">
                  <img
                    src={film.thumbnail}
                    alt={film.title}
                    className="w-full h-full object-cover filter brightness-90 group-hover:brightness-100 transition-all"
                  />

                  {/* Overlay Play Button */}
                  <div className="absolute inset-0 flex items-center justify-center bg-pitch-950/30 group-hover:bg-pitch-950/15 transition-all">
                    <div className="w-16 h-16 rounded-full bg-pitch-900 text-offwhite-50 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-7 h-7 fill-current ml-1" />
                    </div>
                  </div>

                  {/* Duration Badge */}
                  <div className="absolute bottom-4 right-4 bg-offwhite-50/95 backdrop-blur-md px-3 py-1 rounded-full border border-pitch-900/10 text-pitch-900 text-xs font-semibold flex items-center space-x-1.5 shadow-sm">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{film.duration}</span>
                  </div>
                </div>

                {/* Info Container */}
                <div className="p-6 space-y-2 flex-grow">
                  <span className="text-[10px] uppercase tracking-widest text-charcoal-500 font-bold block">
                    {film.location}
                  </span>
                  <h3 className="font-cinzel text-xl font-bold text-pitch-900 group-hover:text-charcoal-700 transition-colors">
                    {film.title}
                  </h3>
                  <p className="font-garamond text-base text-charcoal-700 italic">
                    Featuring {film.couple}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

      </div>
    </section>
  );
}
