import React from 'react';

// Rose petals drifting down behind the page content — the owner-approved
// background animation. Sits at z-0 under the z-10 content wrapper in
// Layout, so petals appear in the page's cream gaps and behind nothing-
// covered areas, never over a photograph, and never intercept a click.
// The .petal styling and keyframes live in src/index.css; a visitor with
// prefers-reduced-motion sees no petals at all (CSS hides them).
const PETAL_COUNT = 20;

// Randomized once per page load, at module scope (render must stay pure):
// sizes, positions, speeds, drift, and depth vary petal to petal, but stay
// stable across route changes rather than reshuffling mid-visit.
const PETALS = Array.from({ length: PETAL_COUNT }, (_, i) => {
  const size = 9 + Math.random() * 13;
  return {
    id: i,
    size,
    left: Math.random() * 99,
    drift: Math.random() * 160 - 80,
    opacity: 0.5 + Math.random() * 0.35,
    duration: 10 + Math.random() * 10,
    delay: -Math.random() * 20,
  };
});

export default function PetalsBackground() {
  const petals = PETALS;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      data-testid="petals-background"
    >
      {petals.map((p) => (
        <span
          key={p.id}
          className="petal"
          style={{
            width: `${p.size}px`,
            height: `${p.size * 1.3}px`,
            left: `${p.left}%`,
            '--drift': `${p.drift}px`,
            '--petal-opacity': p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
