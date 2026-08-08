import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Navbar from '../Navbar';

const noop = () => {};
const renderAt = (path, props = {}) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar user={null} onOpenAuthModal={noop} onOpenClientGallery={noop} onLogout={noop} {...props} />
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

describe('More dropdown', () => {
  const PAGES = [
    { title: 'Travels', slug: 'travels' },
    { title: 'Behind the Scenes', slug: 'behind-the-scenes' },
  ];

  it('renders no More item at all when there are no pages', () => {
    renderAt('/');
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it('opens a menu of page links and closes on Escape', async () => {
    const user = userEvent.setup();
    renderAt('/', { morePages: PAGES });
    const trigger = screen.getByRole('button', { name: 'More' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Travels' })).toHaveAttribute('href', '/more/travels');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('link', { name: 'Travels' })).toBeNull();
  });

  it('closes when clicking outside the menu', async () => {
    const user = userEvent.setup();
    renderAt('/', { morePages: PAGES });
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('link', { name: 'Travels' })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('link', { name: 'Travels' })).toBeNull();
  });

  it('lists the pages as a labelled group in the mobile drawer', async () => {
    const user = userEvent.setup();
    renderAt('/', { morePages: PAGES });
    await user.click(screen.getByRole('button', { name: /toggle navigation menu/i }));
    // Two "More"s on screen now: the desktop trigger and the drawer's group label.
    expect(screen.getAllByText('More').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: 'Behind the Scenes' })).toHaveAttribute('href', '/more/behind-the-scenes');
  });
});

describe('logo badge', () => {
  it('renders a circular logo before the wordmark when a logo is set', () => {
    renderAt('/', { logo: '/images/logo.png' });
    const img = document.querySelector('header img');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('/images/logo.png');
    expect(img.className).toMatch(/rounded-full/);
  });

  it('renders no logo image when none is set', () => {
    renderAt('/');
    expect(document.querySelector('header img')).toBeNull();
  });
});
