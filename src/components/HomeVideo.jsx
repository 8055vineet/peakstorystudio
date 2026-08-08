import React from 'react';
import { youtubeEmbedUrl } from '../lib/youtube';

const WORDMARK = 'Peak Story Studio';
const TAGLINE = 'by abhinav';

// The Option-1 mountain range: two fine strokes drawn under the wordmark.
// Decorative — aria-hidden; the band itself carries the accessible name.
function Peaks() {
  return (
    <svg
      viewBox="0 0 520 90"
      className="w-[min(520px,64vw)] my-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 78 L120 30 L180 58 L270 8 L360 58 L420 34 L516 78" opacity="0.95" />
      <path d="M4 86 L150 52 L250 74 L360 44 L516 86" opacity="0.5" />
    </svg>
  );
}

// The Home page's cinematic hero: the film plays muted, looping, and
// chromeless as a full-width ambient background, dimmed, with the studio
// name + mountain range + "by abhinav" overlaid. Full-width, natural 16:9
// height ("fit to the screen width", no crop or letterbox). The full films
// stay playable with sound on the Films page.
export default function HomeVideo({ film }) {
  return (
    <section className="w-full">
      <div
        className="relative w-full aspect-video overflow-hidden bg-pitch-950"
        aria-label={WORDMARK}
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
        <div className="absolute inset-0 bg-gradient-to-b from-pitch-950/45 via-pitch-950/20 to-pitch-950/60" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-offwhite-50 px-6 pointer-events-none">
          <h2
            className="font-garamond uppercase tracking-[0.34em] text-[clamp(1.6rem,5vw,4rem)] leading-none"
            style={{ textIndent: '0.34em' }}
          >
            {WORDMARK}
          </h2>
          <Peaks />
          <p className="font-script text-[clamp(1.2rem,2.6vw,2.1rem)] text-offwhite-100">{TAGLINE}</p>
        </div>
      </div>
    </section>
  );
}
