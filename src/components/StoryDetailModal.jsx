import React, { useState } from 'react';
import { X, MapPin, Calendar, Sparkles, Play, ChevronLeft, ChevronRight } from 'lucide-react';

export default function StoryDetailModal({ story, onClose, onSelectImage, onOpenVideo }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  if (!story) return null;

  const images = story.fullGallery || [story.coverImage];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-pitch-950/80 backdrop-blur-xl animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-offwhite-50 border border-pitch-900/15 overflow-hidden shadow-2xl my-auto text-pitch-900">
        
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-pitch-900/10 bg-offwhite-100">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-pitch-900">
              Wedding Story Album
            </span>
            <span className="text-charcoal-400">•</span>
            <span className="text-xs font-medium text-charcoal-700">{story.couple}</span>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-pitch-900 hover:text-offwhite-50 hover:bg-pitch-900 bg-offwhite-200 rounded-full border border-pitch-900/10 transition-all"
            aria-label="Close album"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-10 max-h-[80vh] overflow-y-auto space-y-8">
          
          {/* Main Headline & Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex flex-wrap gap-2 mb-2">
                {story.tags?.map((tag, idx) => (
                  <span key={idx} className="text-[10px] uppercase tracking-wider text-pitch-900 bg-offwhite-200 px-3 py-1 border border-pitch-900/10 font-semibold">
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="font-garamond text-3xl sm:text-5xl font-bold text-pitch-900">
                {story.title}
              </h2>
              <p className="font-garamond text-xl text-charcoal-700 italic">
                &ldquo;{story.summary}&rdquo;
              </p>
            </div>

            <div className="bg-offwhite-100 p-6 space-y-4 border border-pitch-900/10 shadow-sm">
              <div className="flex items-center space-x-3 text-pitch-900">
                <Sparkles className="w-4 h-4 text-pitch-900 shrink-0" />
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-charcoal-500 font-semibold">Couple</div>
                  <div className="font-garamond font-bold text-base text-pitch-900">{story.couple}</div>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-pitch-900">
                <MapPin className="w-4 h-4 text-pitch-900 shrink-0" />
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-charcoal-500 font-semibold">Destination</div>
                  <div className="text-sm font-medium text-pitch-900">{story.location}</div>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-pitch-900">
                <Calendar className="w-4 h-4 text-pitch-900 shrink-0" />
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-charcoal-500 font-semibold">Date</div>
                  <div className="text-sm font-medium text-pitch-900">{story.date}</div>
                </div>
              </div>

              {story.videoUrl && (
                <button
                  onClick={() => onOpenVideo(story.videoUrl)}
                  className="w-full mt-2 flex items-center justify-center space-x-2 bg-pitch-900 text-offwhite-50 font-bold py-3 text-xs uppercase tracking-wider hover:bg-pitch-800 transition-all shadow-md"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play Film</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Featured Image Display */}
          <div className="relative overflow-hidden border border-pitch-900/10 max-h-[500px] flex items-center justify-center bg-offwhite-200">
            <img
              src={images[activeImageIndex]}
              alt={`${story.title} preview`}
              className="w-full h-full object-contain max-h-[500px]"
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                  className="absolute left-4 p-3 bg-pitch-950/80 hover:bg-pitch-900 text-offwhite-50 rounded-full transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                  className="absolute right-4 p-3 bg-pitch-950/80 hover:bg-pitch-900 text-offwhite-50 rounded-full transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Album Grid Thumbnails */}
          <div>
            <h3 className="font-garamond text-lg font-bold text-pitch-900 mb-4">
              Full Album Gallery ({images.length} Photographs)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {images.map((imgUrl, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setActiveImageIndex(idx);
                    onSelectImage(imgUrl);
                  }}
                  className={`relative aspect-square overflow-hidden cursor-pointer border-2 transition-all duration-300 img-zoom-container ${
                    activeImageIndex === idx ? 'border-pitch-900 shadow-md' : 'border-transparent hover:border-pitch-900/40'
                  }`}
                >
                  <img src={imgUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
