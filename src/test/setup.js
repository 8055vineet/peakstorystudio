// Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveClass, …)
// for every test file. Referenced by vite.config.js -> test.setupFiles.
import '@testing-library/jest-dom/vitest';

// jsdom has no IntersectionObserver implementation. useScrollReveal (consumed
// by ScrollReveal, which wraps most page sections) calls `new
// IntersectionObserver(...)` on every mount, so any test that renders a
// section wrapped in ScrollReveal throws without this stub. Children always
// render regardless of the observed visibility state, so a no-op observer is
// enough — no test here depends on the reveal animation actually firing.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = IntersectionObserverStub;
