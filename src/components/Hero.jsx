import React, { useState, useEffect } from 'react';
import { Play, Sparkles, ChevronDown, Award, Globe, Film } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import AnimatedCounter from './AnimatedCounter';

export default function Hero({ onOpenBooking, onOpenFilmModal }) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-16 bg-offwhite-100">
      
      {/* Off-white Subtle Background Texture & Image Grid */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.25]"
        style={{ transform: `translateY(${scrollY * 0.3}px)` }}
      >
        <img
          src="/images/hero_royal.jpg"
          alt="Peak Story Studio Background"
          className="w-full h-full object-cover filter grayscale contrast-125 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-offwhite-100 via-offwhite-100/70 to-offwhite-100/90" />
      </div>

      {/* Main Hero Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center mt-8 sm:mt-0">
        
        {/* Top Minimal Pill Tag */}
        <ScrollReveal delay={0}>
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-offwhite-50 border border-pitch-900/15 text-pitch-900 text-[11px] uppercase tracking-[0.3em] font-semibold mb-8 shadow-sm animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-pitch-900" />
            <span>Cinematic Wedding Films & Photography</span>
          </div>
        </ScrollReveal>

        {/* Main Headline */}
        <ScrollReveal delay={100}>
          <h1 className="font-cinzel text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-pitch-900 leading-[1.08] mb-6 drop-shadow-sm">
            CRAFTING TIMELESS <br className="hidden sm:inline" />
            <span className="font-garamond italic font-normal text-pitch-900 border-b-2 border-pitch-900/20">CINEMATIC STORIES</span>
          </h1>
        </ScrollReveal>

        {/* Subheading */}
        <ScrollReveal delay={200}>
          <p className="font-garamond text-xl sm:text-2xl md:text-3xl text-charcoal-700 max-w-3xl mx-auto font-light italic leading-relaxed mb-10">
            "We document handpicked elements & fleeting emotions packed with love, rendering your wedding as an enduring royal classic."
          </p>
        </ScrollReveal>

        {/* Call to Actions */}
        <ScrollReveal delay={300}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => onOpenFilmModal("https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1")}
              className="group flex items-center space-x-3 bg-offwhite-50 hover:bg-offwhite-200 border border-pitch-900/20 text-pitch-900 px-7 py-4 rounded-full text-xs uppercase tracking-[0.2em] font-semibold transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <div className="w-7 h-7 rounded-full bg-pitch-900 text-offwhite-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </div>
              <span>Watch Showreel 2025</span>
            </button>

            <button
              onClick={onOpenBooking}
              className="flex items-center space-x-3 bg-pitch-900 hover:bg-pitch-800 text-offwhite-50 font-bold px-8 py-4 rounded-full text-xs uppercase tracking-[0.2em] hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
            >
              <span>Inquire For Your Date</span>
            </button>
          </div>
        </ScrollReveal>

        {/* Badges / Stats Bar */}
        <ScrollReveal delay={400}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto pt-8 border-t border-pitch-900/10">
            <div className="flex flex-col items-center">
              <div className="flex items-center space-x-1.5 text-pitch-900 mb-1">
                <Award className="w-4 h-4" />
                <AnimatedCounter target={1000} suffix="+" className="font-cinzel text-xl sm:text-2xl font-bold text-pitch-900" />
              </div>
              <span className="text-[10px] uppercase tracking-widest text-charcoal-500 font-semibold">Illustrious Weddings</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center space-x-1.5 text-pitch-900 mb-1">
                <Globe className="w-4 h-4" />
                <AnimatedCounter target={40} suffix="+" className="font-cinzel text-xl sm:text-2xl font-bold text-pitch-900" />
              </div>
              <span className="text-[10px] uppercase tracking-widest text-charcoal-500 font-semibold">Global Destinations</span>
            </div>

            <div className="col-span-2 md:col-span-1 flex flex-col items-center justify-center">
              <div className="flex items-center space-x-1.5 text-pitch-900 mb-1">
                <Film className="w-4 h-4" />
                <span className="font-cinzel text-xl sm:text-2xl font-bold text-pitch-900">Featured</span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-charcoal-500 font-semibold">Vogue & Filmfare</span>
            </div>
          </div>
        </ScrollReveal>

      </div>

      {/* Scroll Down Prompt */}
      <a
        href="#stories"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-charcoal-500 hover:text-pitch-900 transition-colors flex flex-col items-center space-y-1.5 group"
      >
        <span className="text-[9px] uppercase tracking-[0.35em] font-semibold group-hover:tracking-[0.45em] transition-all">Explore Stories</span>
        <ChevronDown className="w-4 h-4 animate-bounce text-pitch-900" />
      </a>
    </section>
  );
}
