import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Navbar from '../Navbar';

const noop = () => {};
const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar user={null} onOpenAuthModal={noop} onOpenClientGallery={noop} onLogout={noop} />
      <Routes>
        <Route path="/contact" element={<div data-testid="contact-route" />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

describe('Navbar', () => {
  it('renders the wordmark and all six page links', () => {
    renderAt('/');
    expect(screen.getByText(/Peak Story Studio/i)).toBeInTheDocument();
    for (const name of ['Home', 'Gallery', 'Films', 'Stories', 'About', 'Contact']) {
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0);
    }
  });

  it('marks the current page link as the active one', () => {
    renderAt('/films');
    const filmsLink = screen.getAllByRole('link', { name: 'Films' })[0];
    expect(filmsLink.getAttribute('aria-current')).toBe('page'); // NavLink sets this
  });

  it('Book Date navigates to /contact', () => {
    renderAt('/');
    fireEvent.click(screen.getAllByRole('button', { name: /book date/i })[0]);
    expect(screen.getByTestId('contact-route')).toBeInTheDocument();
  });
});
