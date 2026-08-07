import React from 'react';
import { Outlet } from 'react-router-dom';
import ScrollToTop from './ScrollToTop';
import PetalsBackground from './PetalsBackground';
import Navbar from './Navbar';
import Footer from './Footer';

// The frame every public page shares. State stays in App (the convention);
// this component only arranges the frame around the routed page. The petals
// layer sits at z-0 beneath the z-10 content wrapper, so it shows through
// the page's open cream areas but never over a photograph or control.
export default function Layout({ user, onOpenAuthModal, onOpenClientGallery, onLogout, contact, morePages = [] }) {
  return (
    <div className="relative min-h-screen bg-offwhite-100 text-pitch-900 font-sans selection:bg-pitch-900 selection:text-offwhite-50">
      <PetalsBackground />
      <div className="relative z-10">
        <ScrollToTop />
        <Navbar
          morePages={morePages}
          user={user}
          onOpenAuthModal={onOpenAuthModal}
          onOpenClientGallery={onOpenClientGallery}
          onLogout={onLogout}
        />
        <main><Outlet /></main>
        <Footer contact={contact} />
      </div>
    </div>
  );
}
