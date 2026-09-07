import React, { useState } from 'react';
import { MapPin, Calendar, Sparkles, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import Photo from './Photo';
import { activateOnKey } from '../lib/keyboardActivate';

// The body of a wedding's story page: tag chips, the summary, the
// couple/location/date card (with Play Film when the wedding has one), one
// large active image with prev/next, and the thumbnail grid. Extracted from
// the retired StoryDetailModal (Phase 5) so the same album renders at the
// wedding's own URL under the shared frame. The title itself is the page's
// <h1> (`StoryPage` renders it through `PageHeader`), so it is not repeated
// here. Presentational: the only state is which photograph is enlarged.
export default function StoryAlbum({ story, onSelectImage, onOpenVideo }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const images = story.fullGallery || [story.coverImage];

  // The lightbox gets the chosen photograph, its index, and the whole album
  // (as the `{ url }` objects it expects) so it opens on that photograph and
  // pages through this album — not through the site-wide gallery.
  const selectImage = (idx) => {
    setActiveImageIndex(idx);
    onSelectImage(images[idx], idx, images.map((url) => ({ url })));
  };

  return (
    <div className="space-y-8 text-pitch-900">

      {/* Summary & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-wrap gap-2 mb-2">
            {story.tags?.map((tag, idx) => (
              <span key={idx} className="text-[10px] uppercase tracking-wider text-pitch-900 bg-offwhite-200 px-3 py-1 border border-pitch-900/10 font-semibold">
                {tag}
              </span>
            ))}
          </div>
          {story.summary && (
            <p className="font-garamond text-xl text-charcoal-700 italic">
              &ldquo;{story.summary}&rdquo;
            </p>
          )}
        </div>

        <div className="bg-offwhite-100 p-6 space-y-4 border border-pitch-900/10 shadow-sm">
          <div className="flex items-center space-x-3 text-pitch-900">
            <Sparkles className="w-4 h-4 text-pitch-900 shrink-0" aria-hidden="true" />
            <div>
              <div className="text-[9px] uppercase tracking-widest text-charcoal-500 font-semibold">Couple</div>
              <div className="font-garamond font-bold text-base text-pitch-900">{story.couple}</div>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-pitch-900">
            <MapPin className="w-4 h-4 text-pitch-900 shrink-0" aria-hidden="true" />
            <div>
              <div className="text-[9px] uppercase tracking-widest text-charcoal-500 font-semibold">Destination</div>
              <div className="text-sm font-medium text-pitch-900">{story.location}</div>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-pitch-900">
            <Calendar className="w-4 h-4 text-pitch-900 shrink-0" aria-hidden="true" />
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
              <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              <span>Play Film</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Featured Image Display */}
      <div className="relative overflow-hidden border border-pitch-900/10 max-h-[500px] flex items-center justify-center bg-offwhite-200">
        <Photo
          src={images[activeImageIndex]}
          alt={`${story.title} preview`}
          className="w-full h-full object-contain max-h-[500px]"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
              aria-label="Previous photograph"
              className="absolute left-4 p-3 bg-pitch-950/80 hover:bg-pitch-900 text-offwhite-50 rounded-full transition-all"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
              aria-label="Next photograph"
              className="absolute right-4 p-3 bg-pitch-950/80 hover:bg-pitch-900 text-offwhite-50 rounded-full transition-all"
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* Album Grid Thumbnails */}
      <div>
        <h2 className="font-garamond text-lg font-bold text-pitch-900 mb-4">
          Full Album Gallery ({images.length} Photographs)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((imgUrl, idx) => (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              aria-label={`Photograph ${idx + 1} of ${images.length}`}
              onClick={() => selectImage(idx)}
              onKeyDown={activateOnKey(() => selectImage(idx))}
              className={`relative aspect-square overflow-hidden cursor-pointer border-2 transition-all duration-300 img-zoom-container focus:outline-none focus-visible:ring-2 focus-visible:ring-pitch-900 ${
                activeImageIndex === idx ? 'border-pitch-900 shadow-md' : 'border-transparent hover:border-pitch-900/40'
              }`}
            >
              <Photo src={imgUrl} alt="Thumbnail" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
