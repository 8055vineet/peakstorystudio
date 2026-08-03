import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

export default function LightboxModal({ activeImage, activeIndex, imagesList, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(activeIndex || 0);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && imagesList?.length) {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : imagesList.length - 1));
      }
      if (e.key === 'ArrowRight' && imagesList?.length) {
        setCurrentIndex((prev) => (prev < imagesList.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imagesList, onClose]);

  if (!activeImage) return null;

  const currentPhoto = imagesList && imagesList[currentIndex] ? imagesList[currentIndex] : { url: activeImage };
  const imageUrl = currentPhoto.url || activeImage;

  const handlePrev = () => {
    if (imagesList?.length) {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : imagesList.length - 1));
    }
  };

  const handleNext = () => {
    if (imagesList?.length) {
      setCurrentIndex((prev) => (prev < imagesList.length - 1 ? prev + 1 : 0));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-pitch-950/90 backdrop-blur-2xl flex items-center justify-center animate-fade-in p-4 sm:p-8">
      
      {/* Top Bar Controls */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3 text-offwhite-50">
          <span className="text-xs uppercase tracking-widest font-bold">
            Fine Art Preview
          </span>
          {imagesList?.length > 1 && (
            <span className="text-xs font-mono text-offwhite-200/70">
              ({currentIndex + 1} / {imagesList.length})
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsZoomed(!isZoomed)}
            className="p-2.5 rounded-full bg-offwhite-50 text-pitch-900 hover:bg-offwhite-200 border border-pitch-900/10 transition-all shadow-sm"
            title="Toggle Zoom"
          >
            {isZoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>

          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-offwhite-50 text-pitch-900 hover:bg-offwhite-200 border border-pitch-900/10 transition-all shadow-sm"
            aria-label="Close Lightbox"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div className="relative w-full h-full flex items-center justify-center max-w-7xl max-h-[85vh]">
        <img
          src={imageUrl}
          alt={currentPhoto.title || 'Wedding Photograph'}
          className={`max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-transform duration-300 ${
            isZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
          }`}
          onClick={() => setIsZoomed(!isZoomed)}
        />

        {/* Previous Button */}
        {imagesList?.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-2 sm:left-6 p-4 rounded-full bg-offwhite-50 text-pitch-900 hover:bg-pitch-900 hover:text-offwhite-50 border border-pitch-900/10 transition-all shadow-xl"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Next Button */}
        {imagesList?.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-2 sm:right-6 p-4 rounded-full bg-offwhite-50 text-pitch-900 hover:bg-pitch-900 hover:text-offwhite-50 border border-pitch-900/10 transition-all shadow-xl"
            aria-label="Next photo"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Caption Bar */}
      {currentPhoto.title && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-offwhite-50 text-pitch-900 border border-pitch-900/15 px-6 py-3 rounded-full text-center shadow-lg">
          <h4 className="font-garamond text-sm font-bold">
            {currentPhoto.title}
          </h4>
          {currentPhoto.couple && (
            <p className="font-garamond text-xs text-charcoal-700 italic">
              {currentPhoto.couple} {currentPhoto.location && `• ${currentPhoto.location}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
