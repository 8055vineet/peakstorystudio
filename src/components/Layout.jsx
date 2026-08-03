import React from 'react';
import { Outlet } from 'react-router-dom';
import ScrollToTop from './ScrollToTop';
import Navbar from './Navbar';
import Footer from './Footer';

// The frame every public page shares. State stays in App (the convention);
// this component only arranges the frame around the routed page.
export default function Layout({ user, onOpenAuthModal, onOpenClientGallery, onLogout }) {
  return (
    <div className="min-h-screen bg-offwhite-100 text-pitch-900 font-sans selection:bg-pitch-900 selection:text-offwhite-50">
      <ScrollToTop />
      <Navbar
        user={user}
        onOpenAuthModal={onOpenAuthModal}
        onOpenClientGallery={onOpenClientGallery}
        onLogout={onLogout}
      />
      <main><Outlet /></main>
      <Footer />
    </div>
  );
}
