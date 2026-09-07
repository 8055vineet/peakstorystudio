import React, { useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { youtubeEmbedUrl } from '../lib/youtube';

// The YouTube IFrame API accepts player commands over postMessage once the
// embed carries enablejsapi=1 (see youtubeEmbedUrl's background mode). This
// is how the film is muted and unmuted IN PLACE: swapping `mute=0` into the
// iframe src would reload the player and restart the film from the top.
const PLAYER_ORIGIN = 'https://www.youtube.com';
function sendPlayerCommand(iframe, func) {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), PLAYER_ORIGIN);
}

// The Home page's cinematic hero: the first published film plays looping and
// chromeless as a full-width ambient background (natural 16:9, fit to the
// screen width). No text overlay — the clean video is the hero. It starts
// MUTED because that is the only autoplay any browser honours; the one
// control on it is a mute/unmute toggle, so a visitor who wants the sound is
// one tap from it. When no film is published it shows a quiet dark band. The
// full films stay playable with sound on the Films page.
export default function HomeVideo({ film }) {
  const [muted, setMuted] = useState(true);
  const frameRef = useRef(null);

  const toggleSound = () => {
    sendPlayerCommand(frameRef.current, muted ? 'unMute' : 'mute');
    setMuted((wasMuted) => !wasMuted);
  };

  return (
    <section className="w-full">
      <div
        role="region"
        className="relative w-full aspect-video overflow-hidden bg-pitch-950"
        aria-label="Featured film"
      >
        {film && (
          <>
            <iframe
              ref={frameRef}
              src={youtubeEmbedUrl(film.videoEmbedUrl, { background: true })}
              title={film.title}
              tabIndex={-1}
              className="absolute inset-0 w-full h-full border-0"
              allow="autoplay; encrypted-media; picture-in-picture"
            />
            <button
              type="button"
              onClick={toggleSound}
              aria-label={muted ? 'Unmute film' : 'Mute film'}
              aria-pressed={!muted}
              className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 w-11 h-11 rounded-full bg-offwhite-50/90 text-pitch-900 border border-pitch-900/10 shadow-md flex items-center justify-center hover:bg-offwhite-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offwhite-50"
            >
              {muted ? <VolumeX className="w-5 h-5" aria-hidden="true" /> : <Volume2 className="w-5 h-5" aria-hidden="true" />}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
