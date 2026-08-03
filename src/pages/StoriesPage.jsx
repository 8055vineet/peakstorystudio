import React from 'react';
import FeaturedStories from '../components/FeaturedStories';

export default function StoriesPage({ stories, onOpenLightbox, onOpenVideo }) {
  return (
    <div data-testid="stories-page">
      <FeaturedStories stories={stories} onOpenLightbox={onOpenLightbox} onOpenVideo={onOpenVideo} />
    </div>
  );
}
