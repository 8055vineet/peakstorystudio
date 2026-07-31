import React, { useState, useEffect } from 'react';
import { Quote, Sparkles } from 'lucide-react';

export default function Testimonials({ testimonials }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  useEffect(() => {
    if (isHovered || testimonials.length === 0) return undefined;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isHovered, testimonials.length]);

  const minSwipeDistance = 50;
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      setActiveIdx((prev) => (prev + 1) % testimonials.length);
    }
    if (isRightSwipe) {
      setActiveIdx((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
    }
  };

  // Nothing to show — render nothing rather than indexing into an empty
  // array. Reachable once content is dynamic: every testimonial unpublished,
  // or a status filter that legitimately matches none.
  if (testimonials.length === 0) return null;

  return (
    <section className="py-24 relative bg-offwhite-50 overflow-hidden border-t border-pitch-900/10 text-pitch-900">
      <style>
        {`
          @keyframes fillProgress {
            0% { width: 0%; }
            100% { width: 100%; }
          }
          @keyframes customFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-custom-fade {
            animation: customFadeIn 0.8s ease-out forwards;
          }
        `}
      </style>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        
        {/* Header */}
        <div className="inline-flex items-center space-x-2 text-pitch-900 text-xs uppercase tracking-[0.3em] font-semibold mb-3">
          <Sparkles className="w-4 h-4" />
          <span>Couples & Clients Speak</span>
        </div>

        <h2 className="font-cinzel text-3xl sm:text-5xl font-bold tracking-tight text-pitch-900 mb-12">
          LOVE NOTES & <span className="font-garamond italic font-normal">TESTIMONIALS</span>
        </h2>

        {/* Active Testimonial Card */}
        <div 
          className="relative bg-white p-8 sm:p-14 rounded-3xl border border-pitch-900/15 shadow-xl max-w-4xl mx-auto"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEndHandler}
        >
          <div key={activeIdx} className="animate-custom-fade">
            <Quote className="w-12 h-12 text-pitch-900/20 mx-auto mb-6" />

            <p className="font-garamond text-2xl sm:text-3xl text-pitch-900 italic leading-relaxed mb-8 font-light">
              &ldquo;{testimonials[activeIdx].quote}&rdquo;
            </p>

            <div className="space-y-1">
              <h4 className="font-cinzel text-xl font-bold text-pitch-900">
                {testimonials[activeIdx].couple}
              </h4>
              <p className="text-xs uppercase tracking-widest text-charcoal-500 font-semibold">
                {testimonials[activeIdx].event}
              </p>
            </div>
          </div>

          {/* Navigation Dots */}
          <div className="flex items-center justify-center space-x-3 mt-8">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  activeIdx === i ? 'w-8 bg-pitch-900 shadow-sm' : 'w-2 bg-pitch-900/20 hover:bg-pitch-900/40'
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>
          
          {/* Progress Bar */}
          <div className="mt-6 max-w-[200px] mx-auto h-[2px] bg-pitch-900/10 rounded-full overflow-hidden">
            <div 
              key={activeIdx + (isHovered ? '-paused' : '-playing')}
              className="h-full bg-pitch-900/40"
              style={{
                width: isHovered ? '100%' : '100%',
                animation: isHovered ? 'none' : 'fillProgress 5s linear forwards'
              }}
            />
          </div>

        </div>

      </div>
    </section>
  );
}
