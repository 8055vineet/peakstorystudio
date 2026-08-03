import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import CustomCursor from '../CustomCursor';

const mediaStub = (resolver) => (query) => ({
  matches: resolver(query),
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CustomCursor', () => {
  it('renders nothing for coarse pointers (the jsdom default)', () => {
    const { queryByTestId } = render(<CustomCursor />);
    expect(queryByTestId('custom-cursor')).toBeNull();
    expect(document.documentElement.classList.contains('custom-cursor-active')).toBe(false);
  });

  it('renders nothing when the visitor prefers reduced motion, even on a fine pointer', () => {
    vi.stubGlobal('matchMedia', mediaStub(() => true)); // both queries match
    const { queryByTestId } = render(<CustomCursor />);
    expect(queryByTestId('custom-cursor')).toBeNull();
  });

  it('renders dot and ring on a fine pointer and cleans its class up on unmount', () => {
    vi.stubGlobal('matchMedia', mediaStub((q) => q.includes('pointer: fine')));
    const { getByTestId, unmount } = render(<CustomCursor />);
    const layer = getByTestId('custom-cursor');
    expect(layer.querySelector('.cursor-dot')).not.toBeNull();
    expect(layer.querySelector('.cursor-ring')).not.toBeNull();
    expect(document.documentElement.classList.contains('custom-cursor-active')).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains('custom-cursor-active')).toBe(false);
  });
});
