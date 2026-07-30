import React, { useEffect, useState } from 'react';

export default function CustomCursor() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [cursorText, setCursorText] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setPos({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseOver = (e) => {
      const target = e.target.closest('[data-cursor]');
      if (target) {
        setCursorText(target.getAttribute('data-cursor') || '');
        setIsHovered(true);
      } else {
        setIsHovered(false);
        setCursorText('');
      }
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] hidden lg:block overflow-hidden">
      {/* Center Dot */}
      <div
        className="fixed w-2.5 h-2.5 bg-pitch-900 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      />

      {/* Outer Follower Ring / Badge */}
      <div
        className={`fixed transform -translate-x-1/2 -translate-y-1/2 rounded-full border border-pitch-900/40 transition-all duration-300 flex items-center justify-center text-center ${
          isHovered
            ? 'w-24 h-24 bg-pitch-900 text-offwhite-50 border-pitch-900 scale-100 shadow-2xl'
            : 'w-10 h-10 bg-transparent scale-75 border-pitch-900/30'
        }`}
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      >
        {isHovered && cursorText && (
          <span className="text-[10px] font-bold uppercase tracking-widest leading-none px-2 animate-fade-in">
            {cursorText}
          </span>
        )}
      </div>
    </div>
  );
}
