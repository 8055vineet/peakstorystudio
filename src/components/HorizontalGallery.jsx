import React, { useRef, useState, useEffect } from 'react';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { EDITORIAL_GALLERY } from '../data/weddingData';

export default function HorizontalGallery() {
  const scrollRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = window.innerWidth * 0.6; // Scroll by rough card width
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const progress = scrollLeft / (scrollWidth - clientWidth);
      setScrollProgress(progress);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <section className="py-24 bg-offwhite-50 overflow-hidden relative">
      <div className="container mx-auto px-4 md:px-8 mb-12">
        <div className="flex items-center space-x-2 text-pitch-900 mb-6">
          <Sparkles className="w-5 h-5 text-gold-400" />
          <span className="font-sans text-sm tracking-[0.2em] uppercase text-charcoal-700">Editorial Showcase</span>
        </div>
        <div className="flex justify-between items-end">
          <h2 className="font-cinzel text-3xl md:text-5xl text-pitch-900 leading-tight">
            CURATED <br />
            <span className="font-garamond italic font-light text-charcoal-700">Editorial Moments</span>
          </h2>
          
          <div className="hidden md:flex space-x-4">
            <button 
              onClick={() => scroll('left')}
              className="w-12 h-12 rounded-full border border-pitch-900/20 flex items-center justify-center text-pitch-900 hover:bg-pitch-900 hover:text-offwhite-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => scroll('right')}
              className="w-12 h-12 rounded-full border border-pitch-900/20 flex items-center justify-center text-pitch-900 hover:bg-pitch-900 hover:text-offwhite-50 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory px-4 md:px-8 space-x-6 md:space-x-8 pb-12 cursor-grab active:cursor-grabbing"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {EDITORIAL_GALLERY.map((item) => (
          <div 
            key={item.id}
            className="flex-shrink-0 w-[80vw] md:w-[60vw] lg:w-[45vw] snap-center group"
            data-cursor="VIEW"
          >
            <div className="overflow-hidden rounded-2xl aspect-[3/2] mb-6 border border-pitch-900/10 group-hover:border-pitch-900/30 transition-colors">
              <img 
                src={item.image} 
                alt={item.title} 
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                loading="lazy"
              />
            </div>
            <div className="text-center md:text-left px-2">
              <h3 className="font-cinzel font-bold text-xl md:text-2xl text-pitch-900 mb-2">
                {item.title}
              </h3>
              <p className="font-garamond italic text-lg text-charcoal-500">
                {item.location}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center mt-4 px-8">
        <div className="w-full max-w-md h-[2px] bg-pitch-900/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-pitch-900 transition-all duration-300 ease-out rounded-full"
            style={{ 
              width: '20%',
              transform: `translateX(${scrollProgress * 400}%)`
            }}
          />
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}} />
    </section>
  );
}
