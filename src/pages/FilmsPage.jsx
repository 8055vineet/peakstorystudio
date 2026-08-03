import React from 'react';
import FilmsGallery from '../components/FilmsGallery';

export default function FilmsPage({ films, onOpenVideoModal }) {
  return (
    <div data-testid="films-page">
      <FilmsGallery films={films} onOpenVideoModal={onOpenVideoModal} />
    </div>
  );
}
