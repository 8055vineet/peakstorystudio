import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTurnstile } from '../useTurnstile';

// A Turnstile script tag that has already "loaded" plus the global it
// defines, so loadScript() resolves immediately and the hook reaches the
// render step without touching the network.
function installLoadedTurnstile() {
  const tag = document.createElement('script');
  tag.id = 'cf-turnstile-script';
  document.head.appendChild(tag);
  window.turnstile = {
    render: vi.fn(() => 'widget-1'),
    remove: vi.fn(),
    reset: vi.fn(),
  };
}

beforeEach(() => { installLoadedTurnstile(); });
afterEach(() => {
  document.getElementById('cf-turnstile-script')?.remove();
  delete window.turnstile;
});

describe('useTurnstile', () => {
  it('renders the widget into the container once on mount', async () => {
    const { result } = renderHook(() => useTurnstile('site-key'));
    result.current.containerRef.current = document.createElement('div');
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalledTimes(1));
  });

  it('re-renders the widget into a fresh container when the mount generation changes', async () => {
    // The booking form replaces its <form> (and the widget's container) with
    // a success panel, then mounts a brand-new form on "Submit Another
    // Inquiry". The widget must follow the container, or the second form
    // never gets a token and its submit button stays disabled forever.
    const { result, rerender } = renderHook(({ generation }) => useTurnstile('site-key', generation), {
      initialProps: { generation: 0 },
    });
    result.current.containerRef.current = document.createElement('div');
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalledTimes(1));

    rerender({ generation: 1 });
    result.current.containerRef.current = document.createElement('div');
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalledTimes(2));
    expect(window.turnstile.remove).toHaveBeenCalledWith('widget-1');
  });
});
