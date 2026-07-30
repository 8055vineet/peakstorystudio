import React, { useState } from 'react';
import { X, Heart, Download, CheckCircle2, Sparkles, Image as ImageIcon, Share2 } from 'lucide-react';

export default function ClientGalleryModal({ isOpen, onClose, user, photos }) {
  const [favorites, setFavorites] = useState([1, 3, 5]); // IDs of favorited photos
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'favorites'

  if (!isOpen || !user) return null;

  const toggleFavorite = (id) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const displayedPhotos = activeFilter === 'favorites'
    ? photos.filter(p => favorites.includes(p.id))
    : photos;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-pitch-950/85 backdrop-blur-xl animate-fade-in text-pitch-900">
      <div className="relative w-full max-w-6xl h-[90vh] bg-offwhite-100 rounded-3xl border border-pitch-900/15 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Top Navigation Bar */}
        <div className="p-6 sm:px-8 bg-offwhite-50 border-b border-pitch-900/10 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center space-x-2 text-pitch-900 text-xs uppercase tracking-[0.25em] font-semibold mb-1">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Private Client Proofing Portal</span>
            </div>
            <h2 className="font-cinzel text-xl sm:text-3xl font-bold text-pitch-900">
              {user.name} <span className="font-garamond italic font-normal text-charcoal-700">— {user.location || 'Wedding Album'}</span>
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            {/* Filter Toggle */}
            <div className="bg-offwhite-200 p-1 rounded-full border border-pitch-900/10 flex items-center">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
                  activeFilter === 'all' ? 'bg-pitch-900 text-offwhite-50 shadow-sm' : 'text-charcoal-700 hover:text-pitch-900'
                }`}
              >
                All Photos ({photos.length})
              </button>
              <button
                onClick={() => setActiveFilter('favorites')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all flex items-center space-x-1.5 ${
                  activeFilter === 'favorites' ? 'bg-pitch-900 text-offwhite-50 shadow-sm' : 'text-charcoal-700 hover:text-pitch-900'
                }`}
              >
                <Heart className="w-3.5 h-3.5 fill-current text-red-500" />
                <span>Selected ({favorites.length})</span>
              </button>
            </div>

            <button
              onClick={() => alert(`Downloading high-resolution ZIP archive for ${user.name}...`)}
              className="hidden sm:flex items-center space-x-2 bg-offwhite-200 hover:bg-offwhite-300 text-pitch-900 border border-pitch-900/15 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download ZIP</span>
            </button>

            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-offwhite-200 text-pitch-900 hover:bg-pitch-900 hover:text-offwhite-50 border border-pitch-900/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Photobook Progress Banner */}
        <div className="bg-pitch-900 text-offwhite-50 px-6 py-3 shrink-0 flex items-center justify-between text-xs tracking-wider uppercase font-semibold">
          <div className="flex items-center space-x-2">
            <Heart className="w-4 h-4 text-red-500 fill-current" />
            <span>Photobook Selection Progress: {favorites.length} / 20 Selected</span>
          </div>
          <div className="w-36 h-2 bg-offwhite-50/20 rounded-full overflow-hidden hidden sm:block">
            <div 
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${Math.min((favorites.length / 20) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Photo Masonry Content Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {displayedPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-charcoal-500">
              <ImageIcon className="w-12 h-12 mb-4 opacity-40" />
              <p className="font-cinzel text-lg font-bold text-pitch-900">No Favorites Selected Yet</p>
              <p className="font-garamond italic text-sm mt-1">Click the heart icon on any photo to add it to your photobook selection.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {displayedPhotos.map((photo) => {
                const isFav = favorites.includes(photo.id);
                return (
                  <div 
                    key={photo.id}
                    className="relative group rounded-2xl overflow-hidden bg-offwhite-200 border border-pitch-900/10 shadow-sm hover:shadow-xl transition-all duration-300"
                  >
                    <div className="aspect-[3/4] overflow-hidden">
                      <img 
                        src={photo.url} 
                        alt={photo.title || 'Client Photo'} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    </div>

                    {/* Favorite Heart Button */}
                    <button
                      onClick={() => toggleFavorite(photo.id)}
                      className={`absolute top-3 right-3 p-2.5 rounded-full backdrop-blur-md transition-all shadow-md ${
                        isFav 
                          ? 'bg-red-600 text-white scale-110' 
                          : 'bg-offwhite-50/80 text-pitch-900 hover:bg-white hover:scale-110'
                      }`}
                      aria-label="Toggle Favorite"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>

                    {/* Photo Info overlay */}
                    <div className="p-3 bg-offwhite-50 border-t border-pitch-900/10 flex items-center justify-between text-xs">
                      <span className="font-cinzel font-bold text-pitch-900 truncate">
                        {photo.title || `Photo #${photo.id}`}
                      </span>
                      {isFav && (
                        <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Selected</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
