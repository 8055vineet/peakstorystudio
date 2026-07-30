import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, SlidersHorizontal } from 'lucide-react';

export default function ColorGradingSlider() {
  const [sliderPos, setSliderPos] = useState(50);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef(null);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      setContainerWidth(containerRef.current.offsetWidth);
    };

    const resizeObserver = new ResizeObserver(updateWidth);
    updateWidth();
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let percentage = (x / rect.width) * 100;
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;
    setSliderPos(percentage);
  };

  const handleMouseDown = () => { isDragging.current = true; };
  const handleMouseUp = () => { isDragging.current = false; };

  const handleMouseMove = (e) => {
    if (isDragging.current) handleMove(e.clientX);
  };

  const handleTouchMove = (e) => {
    if (e.touches[0]) handleMove(e.touches[0].clientX);
  };

  return (
    <section className="py-20 relative bg-offwhite-50 text-pitch-900 border-t border-pitch-900/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center space-x-2 text-pitch-900 text-xs uppercase tracking-[0.3em] font-bold">
            <SlidersHorizontal className="w-4 h-4" />
            <span>The Fine Art Process</span>
          </div>
          <h2 className="font-cinzel text-3xl sm:text-4xl font-bold text-pitch-900">
            CINEMATIC <span className="font-garamond italic font-normal">COLOR SCIENCE</span>
          </h2>
          <p className="font-garamond text-lg text-charcoal-700 italic font-light">
            Drag the slider to reveal how our custom Hollywood color science transforms flat camera files into rich heirloom art.
          </p>
        </div>

        {/* Slider Container */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          className="relative aspect-[16/9] md:aspect-[21/9] rounded-3xl overflow-hidden cursor-ew-resize select-none border border-pitch-900/20 shadow-2xl bg-offwhite-200"
          data-cursor="DRAG SLIDER"
        >
          {/* Layer 1: After / Cinema Color Graded (Full width underneath) */}
          <img
            src="/images/bridal_portrait.jpg"
            alt="Cinema Graded Wedding Portrait"
            className="absolute inset-0 w-full h-full object-cover filter brightness-[1.05] contrast-[1.1] saturate-[1.15]"
          />
          <div className="absolute top-4 right-4 bg-pitch-900 text-offwhite-50 text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full shadow-md z-10 flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-gold-400" />
            <span>Peak Story Cinema Grade</span>
          </div>

          {/* Layer 2: Before / Flat Raw Shot (Clipped by slider position) */}
          <div
            className="absolute inset-y-0 left-0 overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            <img
              src="/images/bridal_portrait.jpg"
              alt="Raw Unedited Shot"
              className="absolute inset-0 w-full h-full object-cover filter brightness-90 saturate-50 contrast-90 grayscale-[30%]"
              style={{ width: containerWidth ? `${containerWidth}px` : '100%' }}
            />
            <div className="absolute top-4 left-4 bg-offwhite-50 text-pitch-900 text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full border border-pitch-900/20 shadow-md z-10">
              Raw Camera File
            </div>
          </div>

          {/* Vertical Slider Handle Line */}
          <div
            className="absolute inset-y-0 w-0.5 bg-offwhite-50 shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20 pointer-events-none"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-pitch-900 text-offwhite-50 border-2 border-offwhite-50 flex items-center justify-center shadow-xl">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
