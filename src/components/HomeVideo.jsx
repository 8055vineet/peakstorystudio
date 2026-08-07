import React from 'react';
import { youtubeEmbedUrl } from '../lib/youtube';

// The Home page's video block: the embedded player itself, full content
// width and 16:9, autoplaying muted on load (the only autoplay a browser
// allows) and using YouTube's own thumbnail/player — nothing hardcoded.
// Home-only; the Films/Stories pages keep their click-to-play modal.
export default function HomeVideo({ film }) {
  return (
    <section className="pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative w-full aspect-video overflow-hidden bg-pitch-950">
          {film ? (
            <iframe
              src={youtubeEmbedUrl(film.videoEmbedUrl, { autoplay: true })}
              title={film.title}
              className="absolute inset-0 w-full h-full border-0"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-charcoal-400/60">
              <p className="font-garamond text-pitch-700 text-xl tracking-wide">Video to be added</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
