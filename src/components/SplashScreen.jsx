import React, { useState, useEffect, useRef } from 'react';

export default function SplashScreen({ onComplete }) {
  const [phase, setPhase] = useState('focus'); // 'focus' | 'snap' | 'reveal' | 'done'
  const [flash, setFlash] = useState(false);
  const audioContextRef = useRef(null);

  // Web Audio API synthesized mechanical shutter click sound
  const playShutterSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const bufferSize = ctx.sampleRate * 0.06; // 60ms
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 4;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch (e) {
      // Quiet fail if browser blocks autoplay audio
    }
  };

  useEffect(() => {
    // Animation Timeline:
    // 0.0s - 1.3s: Camera appears, lens focuses & aperture blades rotate
    // 1.3s: Shutter click + camera flash + slight body recoil
    // 1.6s: Zoom through camera lens into site
    // 2.3s: Done

    const snapTimer = setTimeout(() => {
      setPhase('snap');
      setFlash(true);
      playShutterSound();

      setTimeout(() => setFlash(false), 160);

      const revealTimer = setTimeout(() => {
        setPhase('reveal');
        const doneTimer = setTimeout(() => {
          setPhase('done');
          if (onComplete) onComplete();
        }, 700);
        return () => clearTimeout(doneTimer);
      }, 400);

      return () => clearTimeout(revealTimer);
    }, 1400);

    return () => clearTimeout(snapTimer);
  }, [onComplete]);

  if (phase === 'done') return null;

  return (
    <div
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center bg-offwhite-100 text-pitch-900 overflow-hidden select-none transition-all duration-700 ease-in-out ${
        phase === 'reveal' ? 'opacity-0 scale-125 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Real Camera Flash Burst */}
      <div
        className={`absolute inset-0 z-50 bg-white pointer-events-none transition-opacity duration-150 ease-out ${
          flash ? 'opacity-95' : 'opacity-0'
        }`}
      />

      {/* Viewfinder Heads-Up Display (HUD) */}
      <div className="absolute inset-6 sm:inset-12 pointer-events-none flex flex-col justify-between z-20 text-pitch-900/60 font-mono text-[10px] sm:text-xs tracking-widest uppercase">
        {/* Top Bar */}
        <div className="flex justify-between items-center border-b border-pitch-900/10 pb-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
            <span className="font-semibold text-pitch-900">REC</span>
            <span className="text-pitch-900/40">| LEICA M 35MM</span>
          </div>
          <div className="flex items-center space-x-4 font-mono font-semibold">
            <span>f/1.4</span>
            <span>1/500s</span>
            <span>ISO 100</span>
          </div>
        </div>

        {/* Viewfinder Corner Ticks */}
        <div className="absolute top-12 left-0 w-4 h-4 border-t-2 border-l-2 border-pitch-900/30" />
        <div className="absolute top-12 right-0 w-4 h-4 border-t-2 border-r-2 border-pitch-900/30" />
        <div className="absolute bottom-12 left-0 w-4 h-4 border-b-2 border-l-2 border-pitch-900/30" />
        <div className="absolute bottom-12 right-0 w-4 h-4 border-b-2 border-r-2 border-pitch-900/30" />

        {/* Bottom Bar */}
        <div className="flex justify-between items-end border-t border-pitch-900/10 pt-3">
          <span className="font-cinzel text-pitch-900 font-bold tracking-[0.25em]">PEAK STORY STUDIO</span>
          <span className="text-pitch-900/40">RANGEFINDER • FINE ART CINEMA</span>
        </div>
      </div>

      {/* Photorealistic Camera Body & Animated Lens Container */}
      <div className="relative flex flex-col items-center justify-center z-10 px-4">
        
        {/* Focus Box Quadrant */}
        <div
          className={`absolute z-30 w-64 h-64 sm:w-80 sm:h-80 rounded-3xl border-2 transition-all duration-500 flex items-center justify-center pointer-events-none ${
            phase === 'snap'
              ? 'border-pitch-900 scale-95 bg-pitch-900/5'
              : 'border-pitch-900/25 scale-100'
          }`}
        >
          {/* Focus Reticle Crosshair */}
          <div className="w-3 h-3 border border-pitch-900/50 rounded-full" />
          <div className="absolute w-full h-[1px] bg-pitch-900/10" />
          <div className="absolute h-full w-[1px] bg-pitch-900/10" />
        </div>

        {/* Photorealistic Camera Frame */}
        <div
          className={`relative max-w-sm sm:max-w-md transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${
            phase === 'snap'
              ? 'scale-95 rotate-[-1deg]'
              : phase === 'reveal'
              ? 'scale-150 opacity-0'
              : 'scale-100 rotate-0'
          }`}
        >
          {/* High-Res Leica Camera Image */}
          <img
            src="/images/luxury_camera.jpg"
            alt="Leica Luxury Camera"
            className="w-full h-auto object-contain drop-shadow-2xl rounded-2xl filter contrast-[1.05]"
          />

          {/* Interactive Mechanical Lens Aperture Blade Overlay (Positioned precisely over physical lens) */}
          <div className="absolute top-[52%] left-[53.5%] -translate-x-1/2 -translate-y-1/2 w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden pointer-events-none mix-blend-multiply opacity-85">
            <svg
              viewBox="0 0 200 200"
              className={`w-full h-full transform transition-transform duration-1000 ease-out ${
                phase === 'focus' ? 'rotate-60' : phase === 'snap' ? 'rotate-120' : 'rotate-180 scale-150'
              }`}
            >
              {/* 6 Rotating Mechanical Aperture Blades */}
              <g
                className={`transform origin-center transition-all duration-400 ease-in-out ${
                  phase === 'snap' ? 'scale-40 opacity-100' : 'scale-90 opacity-75'
                }`}
              >
                <path d="M100 20 C130 20 160 48 160 78 C130 62 100 58 70 78 Z" fill="#0a0a0a" />
                <path d="M100 20 C130 20 160 48 160 78 C130 62 100 58 70 78 Z" fill="#0a0a0a" transform="rotate(60 100 100)" />
                <path d="M100 20 C130 20 160 48 160 78 C130 62 100 58 70 78 Z" fill="#0a0a0a" transform="rotate(120 100 100)" />
                <path d="M100 20 C130 20 160 48 160 78 C130 62 100 58 70 78 Z" fill="#0a0a0a" transform="rotate(180 100 100)" />
                <path d="M100 20 C130 20 160 48 160 78 C130 62 100 58 70 78 Z" fill="#0a0a0a" transform="rotate(240 100 100)" />
                <path d="M100 20 C130 20 160 48 160 78 C130 62 100 58 70 78 Z" fill="#0a0a0a" transform="rotate(300 100 100)" />
              </g>
            </svg>
          </div>
        </div>

        {/* Status Messaging below Camera */}
        <div className="mt-6 text-center">
          <p className="font-cinzel text-xs sm:text-sm font-bold tracking-[0.3em] text-pitch-900 uppercase">
            {phase === 'focus' ? 'AUTO-FOCUSING LEICA SUMMILUX...' : phase === 'snap' ? 'CAPTURING MOMENT' : 'PEAK STORY STUDIO'}
          </p>
          <div className="w-16 h-[1px] bg-pitch-900/20 mx-auto mt-2" />
        </div>

      </div>
    </div>
  );
}
