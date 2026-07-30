import React from 'react';
import { Camera } from 'lucide-react';
import { FILM_STRIP_FRAMES } from '../data/weddingData';

export default function FilmStrip() {
  return (
    <section className="py-16 bg-pitch-950 text-offwhite-50 overflow-hidden border-t border-b border-pitch-900">
      
      {/* Header Badge */}
      <div className="max-w-7xl mx-auto px-4 text-center mb-8">
        <div className="inline-flex items-center space-x-2 text-offwhite-200/80 text-[10px] uppercase tracking-[0.35em] font-bold">
          <Camera className="w-3.5 h-3.5" />
          <span>Analog 35mm & Behind The Lens</span>
        </div>
      </div>

      {/* Film Reel Frame Strip */}
      <div className="relative flex overflow-x-hidden">
        <div className="animate-marquee flex items-center space-x-6">
          {[...FILM_STRIP_FRAMES, ...FILM_STRIP_FRAMES].map((frame, i) => (
            <div
              key={i}
              className="relative shrink-0 w-72 bg-pitch-900 border border-white/10 rounded-xl p-3 shadow-2xl group cursor-pointer"
              data-cursor="VIEW FRAME"
            >
              {/* Film Sprocket Perforations */}
              <div className="flex justify-between items-center px-2 pb-2 text-[8px] font-mono text-offwhite-200/40 uppercase tracking-widest border-b border-white/10 mb-2">
                <span>{frame.title}</span>
                <span>▶ {i + 1}A</span>
              </div>

              {/* Image Frame */}
              <div className="aspect-[4/3] rounded-lg overflow-hidden img-zoom-container">
                <img
                  src={frame.img}
                  alt={frame.location}
                  className="w-full h-full object-cover filter contrast-110 saturate-90 group-hover:scale-110 transition-transform"
                />
              </div>

              {/* Bottom Stamp */}
              <div className="pt-2 text-center text-[9px] font-mono uppercase tracking-widest text-offwhite-200/60">
                PEAK STORY • {frame.location}
              </div>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
