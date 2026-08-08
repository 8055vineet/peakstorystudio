import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, ShieldCheck, Heart, ChevronDown } from 'lucide-react';

// The site's shared header, per the owner's approved design: the wordmark
// centered, the six page links in a row beneath it, and the Sign In / Book
// Date controls kept quiet in the top-right corner. Deliberately NOT fixed
// and with no scroll-condensing behavior — it is a calm block that scrolls
// away like the rest of the page. `morePages` (the admin's published
// collections, threaded App → Layout → here) renders a More dropdown after
// Contact — no pages, no More item at all.
export default function Navbar({
  user,
  onOpenAuthModal,
  onOpenClientGallery,
  onLogout,
  morePages = [],
  logo = null
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const onMorePage = location.pathname.startsWith('/more/');

  // Close on Escape and on any click outside the dropdown. Listeners exist
  // only while the menu is open, and the effect only ever tears down its
  // own listeners — state changes here come from user events alone.
  useEffect(() => {
    if (!moreOpen) return undefined;
    function onKeyDown(e) { if (e.key === 'Escape') setMoreOpen(false); }
    function onClick(e) { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClick);
    };
  }, [moreOpen]);

  const navLinks = [
    { name: 'Home', to: '/', end: true },
    { name: 'Gallery', to: '/gallery' },
    { name: 'Films', to: '/films' },
    { name: 'Stories', to: '/stories' },
    { name: 'About', to: '/about' },
    { name: 'Contact', to: '/contact' },
  ];

  const linkClass = ({ isActive }) =>
    `text-xs uppercase tracking-[0.2em] font-medium transition-colors py-1 ${
      isActive
        ? 'text-pitch-900 underline underline-offset-8'
        : 'text-pitch-900/70 hover:text-pitch-900'
    }`;

  const goToBooking = () => {
    setMobileMenuOpen(false);
    navigate('/contact');
  };

  return (
    <header className="relative bg-offwhite-100 border-b border-pitch-900/10">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-9 pb-6">

        {/* Wordmark lockup, centered — the studio logo as a circular badge
            just before the wordmark when one has been uploaded in the admin. */}
        <div className="flex items-center justify-center gap-3">
          {logo && (
            <img
              src={logo}
              alt=""
              data-logo-badge
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover ring-1 ring-pitch-900/15 shrink-0"
            />
          )}
          <Link
            to="/"
            className="inline-block font-garamond text-2xl sm:text-3xl tracking-[0.25em] text-pitch-900"
          >
            Peak Story Studio
          </Link>
        </div>

        {/* Page links, centered beneath the wordmark */}
        <div className="hidden md:flex items-center justify-center gap-8 mt-6">
          {navLinks.map((link) => (
            <NavLink key={link.name} to={link.to} end={link.end} className={linkClass}>
              {link.name}
            </NavLink>
          ))}
          {morePages.length > 0 && (
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                aria-expanded={moreOpen}
                aria-haspopup="true"
                className={`flex items-center gap-1 text-xs uppercase tracking-[0.2em] font-medium transition-colors py-1 ${
                  onMorePage
                    ? 'text-pitch-900 underline underline-offset-8'
                    : 'text-pitch-900/70 hover:text-pitch-900'
                }`}
              >
                More
                <ChevronDown className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {moreOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 min-w-[12rem] bg-offwhite-50 border border-pitch-900/10 shadow-xl py-2 z-40">
                  {morePages.map((page) => (
                    <NavLink
                      key={page.slug}
                      to={`/more/${page.slug}`}
                      onClick={() => setMoreOpen(false)}
                      className="block px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-pitch-900/80 hover:text-pitch-900 hover:bg-offwhite-200 transition-colors"
                    >
                      {page.title}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quiet corner controls */}
        <div className="hidden lg:flex items-center gap-4 absolute top-9 right-8">
          {user ? (
            <div className="flex items-center gap-3">
              {user.role === 'admin' ? (
                <span className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-pitch-900 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </span>
              ) : (
                <button
                  onClick={onOpenClientGallery}
                  className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-pitch-900 font-semibold hover:text-pitch-700 transition-colors"
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>{user.name}</span>
                </button>
              )}
              <button
                onClick={onLogout}
                className="p-1.5 text-charcoal-500 hover:text-pitch-900 transition-colors"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="text-xs uppercase tracking-[0.15em] text-pitch-900/70 hover:text-pitch-900 transition-colors"
            >
              Sign In
            </button>
          )}

          <button
            onClick={goToBooking}
            className="bg-pitch-900 hover:bg-pitch-800 text-offwhite-50 px-4 py-2 text-xs uppercase tracking-[0.15em] font-semibold transition-colors"
          >
            Book Date
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden absolute top-9 right-4 p-2 text-pitch-900 hover:text-charcoal-700 focus:outline-none"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-offwhite-50 border-t border-pitch-900/10 px-6 py-6 space-y-4 shadow-xl animate-fade-in">
          {navLinks.map((link) => (
            <NavLink
              key={link.name}
              to={link.to}
              end={link.end}
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm uppercase tracking-widest text-pitch-900 hover:text-charcoal-700 py-2 border-b border-pitch-900/5 font-medium"
            >
              {link.name}
            </NavLink>
          ))}

          {morePages.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] uppercase tracking-[0.25em] text-charcoal-500 font-bold pb-1">More</p>
              {morePages.map((page) => (
                <NavLink
                  key={page.slug}
                  to={`/more/${page.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-sm uppercase tracking-widest text-pitch-900 hover:text-charcoal-700 py-2 border-b border-pitch-900/5 font-medium"
                >
                  {page.title}
                </NavLink>
              ))}
            </div>
          )}

          <div className="pt-2 flex flex-col space-y-3">
            {user ? (
              <div className="flex items-center justify-between bg-offwhite-200 p-3 border border-pitch-900/10">
                <span className="text-xs uppercase tracking-wider font-bold text-pitch-900">
                  {user.role === 'admin' ? 'Admin' : user.name}
                </span>
                <button
                  onClick={() => { setMobileMenuOpen(false); onLogout(); }}
                  className="text-xs text-pitch-700 font-bold uppercase"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setMobileMenuOpen(false); onOpenAuthModal(); }}
                className="w-full border border-pitch-900/20 text-pitch-900 py-3 text-xs uppercase tracking-widest font-bold"
              >
                Sign In
              </button>
            )}

            <button
              onClick={goToBooking}
              className="w-full bg-pitch-900 text-offwhite-50 font-bold py-3 text-xs uppercase tracking-widest"
            >
              Book Date
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
