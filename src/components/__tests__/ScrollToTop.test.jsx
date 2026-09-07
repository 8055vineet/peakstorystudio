import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import ScrollToTop from '../ScrollToTop';

function Shell() {
  const navigate = useNavigate();
  return (
    <>
      <ScrollToTop />
      <Link to="/gallery">Gallery</Link>
      <button type="button" onClick={() => navigate(-1)}>Back</button>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route path="/gallery" element={<div>gallery</div>} />
      </Routes>
    </>
  );
}

describe('ScrollToTop', () => {
  let scrollTo;
  beforeEach(() => { scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
  afterEach(() => { scrollTo.mockRestore(); });

  it('jumps straight to the top when a link opens a new page — never an animated scroll', () => {
    // The document has `scroll-behavior: smooth` for in-page anchors; a route
    // change must not inherit it, or the new page visibly scrolls up from
    // wherever the old one was.
    render(<MemoryRouter initialEntries={['/']}><Shell /></MemoryRouter>);
    scrollTo.mockClear();
    fireEvent.click(screen.getByRole('link', { name: 'Gallery' }));
    expect(screen.getByText('gallery')).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });

  it('leaves back/forward navigation to the browser, which restores the old scroll position', () => {
    render(<MemoryRouter initialEntries={['/', '/gallery']} initialIndex={1}><Shell /></MemoryRouter>);
    scrollTo.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('home')).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
