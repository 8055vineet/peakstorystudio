import React from 'react';
import { youtubeEmbedUrl } from '../lib/youtube';

// The Home page's cinematic hero: the first published film plays muted,
// looping, and chromeless as a full-width ambient background (natural 16:9,
// fit to the screen width). No text overlay — the clean video is the hero.
// When no film is published it shows a quiet dark band. The full films stay
// playable with sound on the Films page.
export default function HomeVideo({ film }) {
  return (
    <section className="w-full">
      <div
        className="relative w-full aspect-video overflow-hidden bg-pitch-950"
        aria-label="Featured film"
      >
        {film && (
          <iframe
            src={youtubeEmbedUrl(film.videoEmbedUrl, { background: true })}
            title={film.title}
            tabIndex={-1}
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
          />
        )}
      </div>
    </section>
  );
}
