import React from 'react';
import { Camera, Sparkles, Award, Star } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

export default function AboutSection() {
  return (
    <section id="about" className="py-24 relative bg-offwhite-100 text-pitch-900 border-t border-pitch-900/10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main 2-Column Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Visual Collage */}
          <ScrollReveal direction="left" className="lg:col-span-5 relative">
            <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-pitch-900/15 shadow-xl img-zoom-container bg-offwhite-200">
              <img
                src="/images/bridal_portrait.jpg"
                alt="Peak Story Studio Craftsmanship"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Overlapping Badge */}
            <div className="absolute -bottom-6 -right-6 bg-offwhite-50 border border-pitch-900/15 p-6 rounded-2xl max-w-xs shadow-2xl hidden sm:block animate-float">
              <div className="flex items-center space-x-1 text-pitch-900 mb-1">
                <Star className="w-4 h-4 fill-current text-pitch-900" />
                <Star className="w-4 h-4 fill-current text-pitch-900" />
                <Star className="w-4 h-4 fill-current text-pitch-900" />
                <Star className="w-4 h-4 fill-current text-pitch-900" />
                <Star className="w-4 h-4 fill-current text-pitch-900" />
              </div>
              <p className="font-cinzel text-xs font-bold text-pitch-900 uppercase tracking-wider">
                Vogue Fine Art Choice
              </p>
              <p className="font-garamond text-xs text-charcoal-700 italic mt-0.5">
                &ldquo;Recognized worldwide for cinema quality framing & discreet documentary execution.&rdquo;
              </p>
            </div>
          </ScrollReveal>

          {/* Right Column: Narrative */}
          <div className="lg:col-span-7 space-y-6">
            <ScrollReveal delay={100}>
              <div className="inline-flex items-center space-x-2 text-pitch-900 text-xs uppercase tracking-[0.3em] font-semibold">
                <Sparkles className="w-4 h-4" />
                <span>Our Legacy & Philosophy</span>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <h2 className="font-cinzel text-3xl sm:text-5xl font-bold tracking-tight leading-tight text-pitch-900">
                WE DON&apos;T JUST SNAP PICTURES. <br />
                <span className="font-garamond italic font-normal">WE PRESERVE HEIRLOOMS.</span>
              </h2>
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <p className="font-garamond text-xl text-charcoal-700 leading-relaxed italic">
                At Peak Story Studio, we believe every wedding is a grand tapestry of micro-moments. From silent tears shed in gilded suites to high-energy baraat celebrations under fireworks, we document handpicked elements packed with love.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={400}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-pitch-900/10">
                <div className="flex items-start space-x-4">
                  <div className="p-3 rounded-xl bg-offwhite-50 border border-pitch-900/15 text-pitch-900 shrink-0 shadow-sm">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-cinzel text-base font-bold text-pitch-900 mb-1">
                      Discreet Documentary
                    </h4>
                    <p className="text-xs text-charcoal-700 leading-relaxed">
                      We blend invisibly into your celebration, capturing genuine candid smiles without intruding.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="p-3 rounded-xl bg-offwhite-50 border border-pitch-900/15 text-pitch-900 shrink-0 shadow-sm">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-cinzel text-base font-bold text-pitch-900 mb-1">
                      4K Cinematic Color Grading
                    </h4>
                    <p className="text-xs text-charcoal-700 leading-relaxed">
                      Color-graded in Hollywood suites to give your wedding film timeless cinematic warmth.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Press Bar */}
            <ScrollReveal delay={500}>
              <div className="pt-6">
                <span className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500 font-bold block mb-4">
                  AS FEATURED IN LEADING LUXURY PUBLICATIONS
                </span>
                <div className="flex flex-wrap items-center gap-6 opacity-80">
                  <span className="font-cinzel text-lg font-bold tracking-[0.2em] text-pitch-900">VOGUE</span>
                  <span className="font-cinzel text-lg font-bold tracking-[0.2em] text-pitch-900">HARPER&apos;S BAZAAR</span>
                  <span className="font-cinzel text-lg font-bold tracking-[0.2em] text-pitch-900">FILMFARE</span>
                  <span className="font-cinzel text-lg font-bold tracking-[0.2em] text-pitch-900">WEDMEGOOD</span>
                </div>
              </div>
            </ScrollReveal>

          </div>

        </div>

      </div>
    </section>
  );
}
