import React, { useState, useEffect } from 'react';
import CustomCursor from './components/CustomCursor';
import Navbar from './components/Navbar';
import SplashScreen from './components/SplashScreen';
import ScrollProgressBar from './components/ScrollProgressBar';
import Hero from './components/Hero';
import FeaturedStories from './components/FeaturedStories';
import FilmsGallery from './components/FilmsGallery';
import ColorGradingSlider from './components/ColorGradingSlider';
import HorizontalGallery from './components/HorizontalGallery';
import PhotoGallery from './components/PhotoGallery';
import FilmStrip from './components/FilmStrip';
import LightboxModal from './components/LightboxModal';
import AuthModal from './components/AuthModal';
import ClientGalleryModal from './components/ClientGalleryModal';
import AboutSection from './components/AboutSection';
import Testimonials from './components/Testimonials';
import BookingForm from './components/BookingForm';
import Footer from './components/Footer';
import SectionDivider from './components/SectionDivider';

import { useWeddings, useGalleryPhotos, useFilms, useTestimonials } from './hooks/useContent';
import { X } from 'lucide-react';

export default function App() {
  const { data: stories } = useWeddings();
  const { data: photos } = useGalleryPhotos();
  const { data: films } = useFilms();
  const { data: testimonials } = useTestimonials();

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('peak_story_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('peak_story_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('peak_story_user');
    }
  }, [user]);

  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    activeUrl: '',
    activeIndex: 0,
    imagesList: []
  });

  const [videoModalUrl, setVideoModalUrl] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [clientGalleryOpen, setClientGalleryOpen] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  const handleOpenLightbox = (url, index = 0, list = []) => {
    setLightboxState({
      isOpen: true,
      activeUrl: url,
      activeIndex: index,
      imagesList: list.length ? list : photos
    });
  };

  const handleCloseLightbox = () => {
    setLightboxState({
      isOpen: false,
      activeUrl: '',
      activeIndex: 0,
      imagesList: []
    });
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    if (userData.role === 'client') {
      setClientGalleryOpen(true);
    }
  };

  const handleLogout = () => {
    setUser(null);
  };

  const scrollToBooking = () => {
    const el = document.getElementById('contact');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-offwhite-100 text-pitch-900 font-sans relative selection:bg-pitch-900 selection:text-offwhite-50">
      
      {/* Branded Splash Screen */}
      {!splashDone && <SplashScreen onComplete={() => setSplashDone(true)} />}

      {/* Scroll Progress Bar */}
      <ScrollProgressBar />

      {/* Custom Minimalist Magnetic Cursor */}
      <CustomCursor />

      {/* Floating Navbar */}
      <Navbar
        onOpenBooking={scrollToBooking}
        user={user}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onOpenClientGallery={() => setClientGalleryOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Sections */}
      <main>
        <Hero
          onOpenBooking={scrollToBooking}
          onOpenFilmModal={(url) => setVideoModalUrl(url)}
        />

        <FeaturedStories
          stories={stories}
          onOpenLightbox={(url) => handleOpenLightbox(url)}
          onOpenVideo={(url) => setVideoModalUrl(url)}
        />

        <SectionDivider color="#faf9f6" bgColor="#ffffff" />

        <FilmsGallery
          films={films}
          onOpenVideoModal={(url) => setVideoModalUrl(url)}
        />

        <ColorGradingSlider />

        <SectionDivider color="#ffffff" bgColor="#faf9f6" />

        <HorizontalGallery />

        <SectionDivider color="#faf9f6" bgColor="#ffffff" />

        <PhotoGallery
          photos={photos}
          onOpenLightbox={handleOpenLightbox}
        />

        <FilmStrip />

        <AboutSection />

        <SectionDivider color="#ffffff" bgColor="#faf9f6" />

        <Testimonials testimonials={testimonials} />

        <SectionDivider color="#faf9f6" bgColor="#ffffff" />

        <BookingForm />
      </main>

      <Footer />

      {/* Modals */}
      {lightboxState.isOpen && (
        <LightboxModal
          activeImage={lightboxState.activeUrl}
          activeIndex={lightboxState.activeIndex}
          imagesList={lightboxState.imagesList}
          onClose={handleCloseLightbox}
        />
      )}

      {videoModalUrl && (
        <div className="fixed inset-0 z-50 bg-pitch-950/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8 animate-fade-in">
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-pitch-900/30">
            <button
              onClick={() => setVideoModalUrl(null)}
              className="absolute top-4 right-4 z-20 p-2.5 bg-offwhite-50 text-pitch-900 hover:bg-pitch-900 hover:text-offwhite-50 rounded-full border border-pitch-900/10 transition-all shadow-md"
            >
              <X className="w-6 h-6" />
            </button>
            <iframe
              src={videoModalUrl}
              title="Cinematic Film Preview"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <ClientGalleryModal
        isOpen={clientGalleryOpen}
        onClose={() => setClientGalleryOpen(false)}
        user={user}
        photos={photos}
      />

    </div>
  );
}
