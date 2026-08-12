import React, { useState } from 'react';
import { MapPin, ArrowUpRight, Sparkles, BookOpen } from 'lucide-react';
import StoryDetailModal from './StoryDetailModal';
import ScrollReveal from './ScrollReveal';
import Photo from './Photo';

export default function FeaturedStories({ stories, onOpenLightbox, onOpenVideo }) {
  const [selectedStory, setSelectedStory] = useState(null);

  return (
    <section id="stories" className="py-24 relative bg-offwhite-100 overflow-hidden border-t border-pitch-900/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <ScrollReveal>
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center space-x-2 text-pitch-900 text-xs uppercase tracking-[0.3em] font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Handpicked Wedding Features</span>
            </div>
            <h2 className="font-garamond text-3xl sm:text-5xl font-bold tracking-tight text-pitch-900">
              FEATURED <span className="font-garamond italic font-normal text-pitch-900">WEDDING STORIES</span>
            </h2>
            <p className="font-garamond text-xl text-charcoal-700 italic font-light">
              Step inside our grandest wedding sagas—where love, culture, and cinematic artistry merge seamlessly.
            </p>
          </div>
        </ScrollReveal>

        {/* Stories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {stories.map((story, index) => (
            <ScrollReveal key={story.id} delay={index * 150} className="h-full">
              <div
                onClick={() => setSelectedStory(story)}
                data-cursor="EXPLORE ALBUM"
                className="group relative bg-offwhite-50 overflow-hidden minimal-card cursor-pointer flex flex-col transition-all duration-500 h-full"
              >
                {/* Cover Image Container */}
                <div className="relative aspect-[4/5] img-zoom-container overflow-hidden">
                  <Photo
                    src={story.coverImage}
                    alt={story.title}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Legibility gradient — bottom third only, so the
                      photograph itself stays clean and sharp */}
                  <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-pitch-950/85 to-transparent" />

                  {/* Leica-style Date & Monogram Stamp */}
                  <div className="absolute top-4 left-4 z-10 flex flex-col space-y-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-offwhite-50 bg-pitch-950/70 backdrop-blur-md px-2.5 py-1 border border-white/10 opacity-80">
                      PEAK STORY / {story.date.toUpperCase()}
                    </div>
                  </div>

                  {/* Top Right Quick View Icon */}
                  <div className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-offwhite-50/95 backdrop-blur-md border border-pitch-900/10 text-pitch-900 flex items-center justify-center group-hover:bg-pitch-900 group-hover:text-offwhite-50 transition-all duration-300 shadow-sm">
                    <ArrowUpRight className="w-5 h-5 group-hover:rotate-45 transition-transform" />
                  </div>

                  {/* Card Content Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 z-10 space-y-2.5 text-offwhite-50">
                    <div className="flex items-center space-x-2 text-offwhite-200 text-xs font-semibold uppercase tracking-widest">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{story.location}</span>
                    </div>

                    <h3 className="font-garamond text-2xl font-bold text-offwhite-50 group-hover:text-white transition-colors">
                      {story.title}
                    </h3>

                    <div className="flex items-center justify-between text-xs text-offwhite-200/80 border-t border-white/15 pt-3">
                      <span className="font-garamond text-base italic">{story.couple}</span>
                      <span className="flex items-center space-x-1 font-semibold text-offwhite-50">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>View Album</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

      </div>

      {/* Story Detail Modal */}
      {selectedStory && (
        <StoryDetailModal
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
          onSelectImage={(url) => onOpenLightbox(url)}
          onOpenVideo={(url) => onOpenVideo(url)}
        />
      )}
    </section>
  );
}
