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

// This vitest/jsdom pairing (vitest 2.1, jsdom 26) exposes no localStorage at
// all — `typeof localStorage` is 'undefined', not merely empty. App's session
// persistence reads and writes it on every render, so any test that renders
// App (the routing suite does) crashes without a stand-in. In-memory is
// enough: no test asserts persistence across environments.
class LocalStorageStub {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new LocalStorageStub(),
    configurable: true,
  });
}

// jsdom defines window.scrollTo but logs a noisy "Not implemented" error on
// every call; ScrollToTop calls it on each route change. Make it a no-op.
Object.defineProperty(window, 'scrollTo', { value: () => {}, configurable: true });

// This jsdom also exposes no matchMedia; CustomCursor queries it on mount.
// Everything matches false by default — a coarse-pointer, no-preference
// environment — and individual tests stub their own variants when they need
// a fine pointer or reduced motion.
if (typeof window.matchMedia === 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }),
  });
}
