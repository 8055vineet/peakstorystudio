import React from 'react';
import Testimonials from '../components/Testimonials';

// Task 6 gives this page the Brand Story block; Testimonials now.
export default function AboutPage({ testimonials }) {
  return (
    <div data-testid="about-page">
      <Testimonials testimonials={testimonials} />
    </div>
  );
}
