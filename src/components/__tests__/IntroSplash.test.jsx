import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IntroSplash from '../IntroSplash';

beforeEach(() => { window.sessionStorage.clear(); });

describe('IntroSplash', () => {
  it('plays and marks the session when a logo is set and motion is allowed', () => {
    render(<IntroSplash logoUrl="/images/home/logo.jpg" />);
    expect(screen.getByTestId('intro-splash')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('peak_intro_played')).toBe('1');
  });

  it('renders nothing when it already played this session', () => {
    window.sessionStorage.setItem('peak_intro_played', '1');
    render(<IntroSplash logoUrl="/images/home/logo.jpg" />);
    expect(screen.queryByTestId('intro-splash')).toBeNull();
  });

  it('renders nothing with no logo', () => {
    render(<IntroSplash logoUrl={null} />);
    expect(screen.queryByTestId('intro-splash')).toBeNull();
  });

  it('renders nothing under prefers-reduced-motion', () => {
    const original = window.matchMedia;
    window.matchMedia = (q) => ({
      matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    });
    render(<IntroSplash logoUrl="/images/home/logo.jpg" />);
    expect(screen.queryByTestId('intro-splash')).toBeNull();
    window.matchMedia = original;
  });

  it('dismisses on a click and calls onDone', () => {
    const onDone = vi.fn();
    render(<IntroSplash logoUrl="/images/home/logo.jpg" onDone={onDone} />);
    fireEvent.click(document.body);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('intro-splash')).toBeNull();
  });

  it('dismisses on a keypress', () => {
    const onDone = vi.fn();
    render(<IntroSplash logoUrl="/images/home/logo.jpg" onDone={onDone} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
