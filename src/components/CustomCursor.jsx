import React, { useEffect, useRef, useState } from 'react';

// The site's pointer, rebuilt in a quieter form than the pre-3b original:
// a small maroon dot that rides the pointer exactly, and a thin ring that
// trails it on a gentle lag, swelling over anything interactive. Renders
// only for fine pointers on desktop widths; touch devices and visitors
// with prefers-reduced-motion get the native cursor, untouched.
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine) and (min-width: 1024px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], input, textarea, select, label, summary';

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia(FINE_POINTER_QUERY);
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setEnabled(fine.matches && !reduced.matches);
    update();
    fine.addEventListener('change', update);
    reduced.addEventListener('change', update);
    return () => {
      fine.removeEventListener('change', update);
      reduced.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    document.documentElement.classList.add('custom-cursor-active');

    const dot = dotRef.current;
    const ring = ringRef.current;
    let mx = -100;
    let my = -100;
    let rx = -100;
    let ry = -100;
    let interactive = false;
    let seen = false;
    let raf = null;

    const onMove = (event) => {
      mx = event.clientX;
      my = event.clientY;
      if (!seen) {
        // First movement: appear at the pointer rather than gliding in
        // from the corner of the screen.
        seen = true;
        rx = mx;
        ry = my;
        dot.style.opacity = '1';
        ring.style.opacity = '1';
      }
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      const overInteractive = Boolean(event.target?.closest?.(INTERACTIVE_SELECTOR));
      if (overInteractive !== interactive) {
        interactive = overInteractive;
        ring.classList.toggle('cursor-ring-engaged', interactive);
      }
    };

    const onLeave = () => {
      seen = false;
      dot.style.opacity = '0';
      ring.style.opacity = '0';
    };

    const tick = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px, ${ry}px) scale(${interactive ? 1.5 : 1})`;
      raf = window.requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      if (raf) window.cancelAnimationFrame(raf);
      document.documentElement.classList.remove('custom-cursor-active');
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" data-testid="custom-cursor">
      <div ref={ringRef} className="cursor-ring" />
      <div ref={dotRef} className="cursor-dot" />
    </div>
  );
}
