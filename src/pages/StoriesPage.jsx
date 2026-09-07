import React from 'react';
import PageHeader from '../components/PageHeader';
import FeaturedStories from '../components/FeaturedStories';

// The index of wedding stories. Each card links to the wedding's own page
// (`/stories/:slug`, `StoryPage`), which is where the album, lightbox, and
// film live now — so this page needs no modal callbacks of its own.
export default function StoriesPage({ stories }) {
  return (
    <div data-testid="stories-page">
      <PageHeader title="Stories" />
      <FeaturedStories stories={stories} />
    </div>
  );
}
