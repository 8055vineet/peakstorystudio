import React, { useState, useEffect } from 'react';
import { Camera, Menu, X, Calendar, User, LogOut, Heart, ShieldCheck } from 'lucide-react';

export default function Navbar({
  onOpenBooking,
  user,
  onOpenAuthModal,
  onOpenClientGallery,
  onLogout
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '#hero' },
    { name: 'Featured Stories', href: '#stories' },
    { name: 'Films', href: '#films' },
    { name: 'Gallery', href: '#gallery' },
    { name: 'About', href: '#about' },
    { name: 'Contact', href: '#contact' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled
        ? 'py-3.5 bg-offwhite-50/90 backdrop-blur-xl border-b border-pitch-900/10 shadow-sm'
        : 'py-6 bg-gradient-to-b from-offwhite-100/90 via-offwhite-100/40 to-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        
        {/* Brand Logo */}
        <a href="#hero" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-full border border-pitch-900/20 flex items-center justify-center bg-offwhite-50 group-hover:border-pitch-900 group-hover:bg-pitch-900 group-hover:text-offwhite-50 transition-all duration-300">
            <Camera className="w-4 h-4 text-pitch-900 group-hover:text-offwhite-50 transition-colors" />
          </div>
          <div>
            <span className="font-cinzel text-lg sm:text-xl font-bold tracking-[0.2em] text-pitch-900 block leading-none">
              PEAK STORY
            </span>
            <span className="text-[9px] uppercase tracking-[0.4em] text-charcoal-700 font-semibold block mt-1">
              STUDIO
            </span>
          </div>
        </a>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-xs uppercase tracking-[0.2em] text-pitch-900/80 hover:text-pitch-900 font-medium transition-colors relative py-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1.5px] after:bg-pitch-900 hover:after:w-full after:transition-all after:duration-300"
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="hidden lg:flex items-center space-x-3">
          
          {/* User Auth Badge or Sign In Trigger */}
          {user ? (
            <div className="flex items-center space-x-2 bg-offwhite-200 border border-pitch-900/15 p-1 pr-3 rounded-full">
              {user.role === 'admin' ? (
                <div className="flex items-center space-x-1.5 bg-pitch-900 text-offwhite-50 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin Mode</span>
                </div>
              ) : (
                <button
                  onClick={onOpenClientGallery}
                  className="flex items-center space-x-1.5 bg-pitch-900 text-offwhite-50 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider"
                >
                  <Heart className="w-3.5 h-3.5 text-red-400 fill-current" />
                  <span>{user.name}</span>
                </button>
              )}

              <button
                onClick={onLogout}
                className="p-1.5 text-charcoal-500 hover:text-pitch-900 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center space-x-2 text-xs uppercase tracking-wider text-pitch-900/80 hover:text-pitch-900 bg-offwhite-50 hover:bg-offwhite-200 border border-pitch-900/15 px-4 py-2.5 rounded-full transition-all duration-300 shadow-sm"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In / Portal</span>
            </button>
          )}

          <button
            onClick={onOpenBooking}
            className="flex items-center space-x-2 bg-pitch-900 hover:bg-pitch-800 text-offwhite-50 font-semibold px-5 py-2.5 rounded-full text-xs uppercase tracking-[0.15em] hover:shadow-lg transition-all duration-300"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Book Date</span>
          </button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-pitch-900 hover:text-charcoal-700 focus:outline-none"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-offwhite-50 border-t border-pitch-900/10 px-6 py-6 mt-3 space-y-4 shadow-xl animate-fade-in">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm uppercase tracking-widest text-pitch-900 hover:text-charcoal-700 py-2 border-b border-pitch-900/5 font-medium"
            >
              {link.name}
            </a>
          ))}

          {/* User Status in Mobile */}
          <div className="pt-2 flex flex-col space-y-3">
            {user ? (
              <div className="flex items-center justify-between bg-offwhite-200 p-3 rounded-2xl border border-pitch-900/10">
                <span className="text-xs uppercase tracking-wider font-bold text-pitch-900">
                  {user.role === 'admin' ? '👑 Admin Mode' : `💍 ${user.name}`}
                </span>
                <button
                  onClick={() => { setMobileMenuOpen(false); onLogout(); }}
                  className="text-xs text-red-600 font-bold uppercase"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setMobileMenuOpen(false); onOpenAuthModal(); }}
                className="w-full bg-offwhite-200 border border-pitch-900/20 text-pitch-900 py-3 rounded-full text-xs uppercase tracking-widest font-bold"
              >
                Sign In / Client Portal
              </button>
            )}

            <button
              onClick={() => { setMobileMenuOpen(false); onOpenBooking(); }}
              className="w-full bg-pitch-900 text-offwhite-50 font-bold py-3 rounded-full text-xs uppercase tracking-widest"
            >
              Book Consultation
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
