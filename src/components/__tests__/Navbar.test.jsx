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

  it('separates the navbar from the page with a shadow', () => {
    renderAt('/');
    expect(document.querySelector('header').className).toMatch(/shadow/);
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

  it('marks the badge as the intro-collapse target', () => {
    renderAt('/', { logo: '/images/logo.png' });
    expect(document.querySelector('header [data-logo-badge]')).not.toBeNull();
  });

  it('renders no logo image when none is set', () => {
    renderAt('/');
    expect(document.querySelector('header img')).toBeNull();
  });
});

describe('Navbar on a phone', () => {
  // Measured on the live site (2026-09-11): the centred lockup ran under the
  // absolutely-positioned hamburger at every width from 320 to 414px — the
  // wordmark at text-2xl with 0.25em tracking plus the 56px badge is wider
  // than a phone. The lockup row keeps clear of the hamburger's column, and
  // the wordmark and badge are smaller until sm.
  it('keeps the wordmark lockup clear of the hamburger and shrinks it until sm', () => {
    renderAt('/', { logo: '/images/logo.png' });
    const wordmark = screen.getByRole('link', { name: 'Peak Story Studio' });
    const lockup = wordmark.parentElement;
    expect(lockup.className).toMatch(/\bpx-10\b/);
    expect(lockup.className).toMatch(/\blg:px-0\b/);
    expect(wordmark.className).toMatch(/\btext-lg\b/);
    expect(wordmark.className).toMatch(/\bsm:text-3xl\b/);
    expect(wordmark.className).not.toMatch(/\btext-2xl\b/);
    expect(wordmark.className).toMatch(/\btext-center\b/);
    const badge = document.querySelector('header [data-logo-badge]');
    expect(badge.className).toMatch(/\bw-10\b/);
    expect(badge.className).toMatch(/\bsm:w-16\b/);
  });
});

describe('Navbar between tablet and desktop widths', () => {
  it('keeps the hamburger and drawer until the corner controls appear at lg', () => {
    // The Sign In / Book Date corner controls are `hidden lg:flex`. If the
    // hamburger and drawer vanish at md, an iPad-portrait visitor has neither
    // way to reach the client sign-in or the booking shortcut.
    renderAt('/');
    const toggle = screen.getByRole('button', { name: 'Toggle Navigation Menu' });
    expect(toggle.className).toMatch(/\blg:hidden\b/);
    expect(toggle.className).not.toMatch(/\bmd:hidden\b/);
    fireEvent.click(toggle);
    const drawer = screen.getByTestId('mobile-drawer');
    expect(drawer.className).toMatch(/\blg:hidden\b/);
    expect(drawer.className).not.toMatch(/\bmd:hidden\b/);
  });
});
