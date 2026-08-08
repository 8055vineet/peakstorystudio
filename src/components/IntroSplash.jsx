import { useCallback, useEffect, useRef, useState } from 'react';

// Phase 3i: the Home-page first-load moment. The studio logo fills a warm
// cream screen, holds, then scales and glides into the navbar badge, once
// per browser session. Presentational and self-contained: it owns only its
// own play/skip lifecycle and renders nothing that outlives it. App renders
// it only on the Home route, so "home only" is structural.
const SESSION_KEY = 'peak_intro_played';
const INTRO_LOGO_SIZE = 240; // px, the on-screen intro logo diameter

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
function alreadyPlayed() {
  try { return window.sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}
function markPlayed() {
  try { window.sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* private mode: may replay, never crash */ }
}

export default function IntroSplash({ logoUrl, onDone }) {
  // Decide once, before first paint, whether to play — reading matchMedia /
  // sessionStorage in a lazy initializer keeps render pure.
  const [active, setActive] = useState(() => (
    Boolean(logoUrl) && !prefersReducedMotion() && !alreadyPlayed()
  ));
  const [phase, setPhase] = useState('in'); // 'in' -> 'hold' -> 'out'
  const [entered, setEntered] = useState(false);
  const [target, setTarget] = useState(null); // { dx, dy, scale } | null (fade-only)
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const dismiss = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setActive(false);
    onDoneRef.current?.();
  }, []);

  // Choreography timeline; every timer cleaned up on unmount.
  useEffect(() => {
    if (!active) return undefined;
    markPlayed();
    const t1 = setTimeout(() => setEntered(true), 20);
    const t2 = setTimeout(() => setPhase('hold'), 470);
    const t3 = setTimeout(() => setPhase('out'), 1170);
    const t4 = setTimeout(() => dismiss(), 1770);
    return () => { [t1, t2, t3, t4].forEach(clearTimeout); };
  }, [active, dismiss]);

  // Measure the navbar badge as the glide destination, post-mount. The
  // setState is deferred a tick so it never runs synchronously in the effect
  // body — it still lands long before the ~1.2s collapse.
  useEffect(() => {
    if (!active) return undefined;
    const badge = document.querySelector('[data-logo-badge]');
    if (!badge) return undefined;
    const r = badge.getBoundingClientRect();
    if (!r.width) return undefined; // not laid out (jsdom) -> fade-only
    const id = setTimeout(() => setTarget({
      dx: (r.left + r.width / 2) - window.innerWidth / 2,
      dy: (r.top + r.height / 2) - window.innerHeight / 2,
      scale: r.width / INTRO_LOGO_SIZE,
    }), 0);
    return () => clearTimeout(id);
  }, [active]);

  // Any intent to interact fast-forwards and dismisses.
  useEffect(() => {
    if (!active) return undefined;
    const skip = () => dismiss();
    window.addEventListener('click', skip);
    window.addEventListener('wheel', skip, { passive: true });
    window.addEventListener('touchstart', skip, { passive: true });
    window.addEventListener('keydown', skip);
    return () => {
      window.removeEventListener('click', skip);
      window.removeEventListener('wheel', skip);
      window.removeEventListener('touchstart', skip);
      window.removeEventListener('keydown', skip);
    };
  }, [active, dismiss]);

  if (!active) return null;

  const collapsing = phase === 'out';
  const logoStyle = {
    width: `${INTRO_LOGO_SIZE}px`,
    height: `${INTRO_LOGO_SIZE}px`,
    opacity: collapsing ? 1 : (entered ? 1 : 0),
    transform: collapsing && target
      ? `translate(-50%, -50%) translate(${target.dx}px, ${target.dy}px) scale(${target.scale})`
      : `translate(-50%, -50%) scale(${entered ? 1 : 1.06})`,
    transition: 'transform 640ms cubic-bezier(0.16, 1, 0.3, 1), opacity 420ms ease',
  };

  return (
    <div
      data-testid="intro-splash"
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        backgroundColor: 'var(--offwhite-100, #faf9f6)',
        opacity: collapsing ? 0 : 1,
        transition: 'opacity 640ms ease',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 45%, transparent 42%, rgba(61,12,26,0.06) 100%)' }}
      />
      <img
        src={logoUrl}
        alt=""
        className="absolute left-1/2 top-1/2 rounded-full object-cover shadow-2xl ring-1 ring-pitch-900/10"
        style={logoStyle}
      />
    </div>
  );
}
