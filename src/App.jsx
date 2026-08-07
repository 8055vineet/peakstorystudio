import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { X } from 'lucide-react';

import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import GalleryPage from './pages/GalleryPage';
import FilmsPage from './pages/FilmsPage';
import StoriesPage from './pages/StoriesPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import CollectionPage from './pages/CollectionPage';
import NotFoundPage from './pages/NotFoundPage';

import LightboxModal from './components/LightboxModal';
import AuthModal from './components/AuthModal';
import ClientGalleryModal from './components/ClientGalleryModal';

import {
  useWeddings, useGalleryPhotos, useFilms, useTestimonials, useSiteSettings,
  useGalleryCategories, useBookingServices, useCollections,
} from './hooks/useContent';

export default function App() {
  const { data: stories } = useWeddings();
  const { data: photos } = useGalleryPhotos();
  const { data: films } = useFilms();
  const { data: testimonials } = useTestimonials();
  const { data: settings } = useSiteSettings();
  const { data: galleryCategories } = useGalleryCategories();
  const { data: bookingServices } = useBookingServices();
  const { data: collections, loading: collectionsLoading } = useCollections();

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

  return (
    <>
      <Routes>
        <Route
          element={
            <Layout
              user={user}
              onOpenAuthModal={() => setAuthModalOpen(true)}
              onOpenClientGallery={() => setClientGalleryOpen(true)}
              onLogout={handleLogout}
              contact={settings.contact}
              morePages={collections.map(({ title, slug }) => ({ title, slug }))}
            />
          }
        >
          <Route
            index
            element={
              <HomePage
                films={films}
                photos={photos}
                onOpenLightbox={handleOpenLightbox}
                onOpenVideo={(url) => setVideoModalUrl(url)}
                quote={settings.quote}
                brandStory={settings.brandStory}
                images={settings.images}
              />
            }
          />
          <Route path="gallery" element={<GalleryPage photos={photos} onOpenLightbox={handleOpenLightbox} categoryOrder={galleryCategories} />} />
          <Route path="films" element={<FilmsPage films={films} onOpenVideoModal={(url) => setVideoModalUrl(url)} />} />
          <Route
            path="stories"
            element={
              <StoriesPage
                stories={stories}
                onOpenLightbox={(url) => handleOpenLightbox(url)}
                onOpenVideo={(url) => setVideoModalUrl(url)}
              />
            }
          />
          <Route path="about" element={<AboutPage testimonials={testimonials} brandStory={settings.brandStory} portraitImage={settings.images.brandStory} />} />
          <Route path="contact" element={<ContactPage contact={settings.contact} services={bookingServices} />} />
          <Route
            path="more/:slug"
            element={
              <CollectionPage
                collections={collections}
                loading={collectionsLoading}
                onOpenLightbox={handleOpenLightbox}
                onOpenVideo={(url) => setVideoModalUrl(url)}
              />
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>

      {/* Modals live above the routes so they work from every page */}
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
    </>
  );
}
