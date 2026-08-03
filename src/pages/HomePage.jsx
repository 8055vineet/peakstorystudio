import React from 'react';
import { HOME_IMAGES } from '../data/homeContent';

// Skeleton — Task 5 builds the full page from the approved screenshot.
export default function HomePage() {
  return (
    <div data-testid="home-page">
      <img src={HOME_IMAGES.hero.src} alt={HOME_IMAGES.hero.alt} className="w-full object-cover" />
    </div>
  );
}
