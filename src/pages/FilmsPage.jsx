import React from 'react';
import PageHeader from '../components/PageHeader';
import FilmsGallery from '../components/FilmsGallery';

export default function FilmsPage({ films, onOpenVideoModal }) {
  return (
    <div data-testid="films-page">
      <PageHeader title="Films" />
      <FilmsGallery films={films} onOpenVideoModal={onOpenVideoModal} />
    </div>
  );
}
