import React from 'react';
import PageHeader from '../components/PageHeader';
import PhotoGallery from '../components/PhotoGallery';

export default function GalleryPage({ photos, onOpenLightbox }) {
  return (
    <div data-testid="gallery-page">
      <PageHeader title="Gallery" />
      <PhotoGallery photos={photos} onOpenLightbox={onOpenLightbox} />
    </div>
  );
}
