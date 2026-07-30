import React from 'react';
import { Camera, Instagram, Youtube, Facebook, ArrowUp, PlusCircle } from 'lucide-react';

export default function Footer({ onOpenContentManager }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-offwhite-200 text-pitch-900 border-t border-pitch-900/10 pt-16 pb-12 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Row: Brand & Links */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-16">
          
          {/* Col 1: Brand info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full border border-pitch-900/20 flex items-center justify-center bg-offwhite-50 shadow-sm">
                <Camera className="w-5 h-5 text-pitch-900" />
              </div>
              <div>
                <span className="font-cinzel text-xl font-bold tracking-[0.2em] text-pitch-900 block leading-none">
                  PEAK STORY
                </span>
                <span className="text-[9px] uppercase tracking-[0.4em] text-charcoal-700 font-bold block mt-1">
                  STUDIO
                </span>
              </div>
            </div>

            <p className="font-garamond text-lg text-charcoal-700 italic max-w-md font-light">
              Crafting contemporary cinematic wedding films & fine art photography for royal celebrations worldwide.
            </p>

            <div className="flex items-center space-x-3 pt-2">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-offwhite-50 border border-pitch-900/15 text-pitch-900 hover:bg-pitch-900 hover:text-offwhite-50 flex items-center justify-center transition-all shadow-sm">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-offwhite-50 border border-pitch-900/15 text-pitch-900 hover:bg-pitch-900 hover:text-offwhite-50 flex items-center justify-center transition-all shadow-sm">
                <Youtube className="w-4 h-4" />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-offwhite-50 border border-pitch-900/15 text-pitch-900 hover:bg-pitch-900 hover:text-offwhite-50 flex items-center justify-center transition-all shadow-sm">
                <Facebook className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div className="space-y-3">
            <h4 className="font-cinzel text-sm font-bold text-pitch-900 uppercase tracking-wider">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs uppercase tracking-widest text-charcoal-700 font-medium">
              <li><a href="#hero" className="hover:text-pitch-900 transition-colors">Home</a></li>
              <li><a href="#stories" className="hover:text-pitch-900 transition-colors">Featured Stories</a></li>
              <li><a href="#films" className="hover:text-pitch-900 transition-colors">Cinematic Films</a></li>
              <li><a href="#gallery" className="hover:text-pitch-900 transition-colors">Fine Art Gallery</a></li>
              <li><a href="#about" className="hover:text-pitch-900 transition-colors">Our Legacy</a></li>
              <li><a href="#contact" className="hover:text-pitch-900 transition-colors">Inquire Date</a></li>
            </ul>
          </div>

          {/* Col 3: Content Management */}
          <div className="space-y-3">
            <h4 className="font-cinzel text-sm font-bold text-pitch-900 uppercase tracking-wider">
              Studio Tools
            </h4>
            <p className="text-xs text-charcoal-700 leading-relaxed">
              Add your own wedding imagery or export portfolio JSON data anytime.
            </p>
            <button
              onClick={onOpenContentManager}
              className="mt-2 inline-flex items-center space-x-2 bg-offwhite-50 hover:bg-pitch-900 hover:text-offwhite-50 border border-pitch-900/20 text-pitch-900 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>In-App Image Manager</span>
            </button>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-pitch-900/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-charcoal-500 font-medium">
          <p>© {new Date().getFullYear()} PEAK STORY STUDIO. All Rights Reserved.</p>
          
          <div className="flex items-center space-x-2">
            <span>Built with minimalist elegance for luxury weddings.</span>
          </div>

          <button
            onClick={scrollToTop}
            className="flex items-center space-x-2 text-pitch-900 hover:text-charcoal-700 transition-colors"
          >
            <span className="uppercase tracking-widest text-[10px] font-bold">Back to Top</span>
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>

      </div>
    </footer>
  );
}
