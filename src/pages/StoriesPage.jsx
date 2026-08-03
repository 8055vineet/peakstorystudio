import React from 'react';
import PageHeader from '../components/PageHeader';
import FeaturedStories from '../components/FeaturedStories';

export default function StoriesPage({ stories, onOpenLightbox, onOpenVideo }) {
  return (
    <div data-testid="stories-page">
      <PageHeader title="Stories" />
      <FeaturedStories stories={stories} onOpenLightbox={onOpenLightbox} onOpenVideo={onOpenVideo} />
    </div>
  );
}
