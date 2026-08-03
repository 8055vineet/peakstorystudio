import React from 'react';
import PhotoGallery from '../components/PhotoGallery';

export default function GalleryPage({ photos, onOpenLightbox }) {
  return (
    <div data-testid="gallery-page">
      <PhotoGallery photos={photos} onOpenLightbox={onOpenLightbox} />
    </div>
  );
}
