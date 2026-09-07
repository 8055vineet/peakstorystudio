import React from 'react';
import PageHeader from '../components/PageHeader';
import PhotoGallery from '../components/PhotoGallery';

export default function GalleryPage({ photos, loading = false, onOpenLightbox, categoryOrder }) {
  return (
    <div data-testid="gallery-page">
      <PageHeader title="Gallery" />
      <PhotoGallery photos={photos} loading={loading} onOpenLightbox={onOpenLightbox} categoryOrder={categoryOrder} />
    </div>
  );
}
