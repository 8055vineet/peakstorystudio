import { describe, it, expect } from 'vitest';
import { HOME_QUOTE, BRAND_STORY, HOME_IMAGES } from '../homeContent';

describe('home page content', () => {
  it('carries the owner-approved quote verbatim', () => {
    expect(HOME_QUOTE.text).toBe(
      'Every journey builds toward a single, breathless moment. We are here to capture the story when it reaches its absolute peak.',
    );
    expect(HOME_QUOTE.credit).toBe('by abhinav');
  });

  it('carries both Brand Story paragraphs verbatim', () => {
    expect(BRAND_STORY.heading).toBe('The Brand Story');
    expect(BRAND_STORY.paragraphs).toHaveLength(2);
    expect(BRAND_STORY.paragraphs[0]).toMatch(/^At Peak Story Studio, we believe/);
    expect(BRAND_STORY.paragraphs[0]).toContain('lived—they unfold like a masterpiece');
    expect(BRAND_STORY.paragraphs[1]).toMatch(/relive forever\.$/);
  });

  it('points every image slot at the owner-swappable files', () => {
    expect(HOME_IMAGES.hero.src).toBe('/images/home/hero.webp');
    expect(HOME_IMAGES.brandStory.src).toBe('/images/home/brand-story.webp');
    expect(HOME_IMAGES.closing.src).toBe('/images/home/closing.webp');
    for (const slot of Object.values(HOME_IMAGES)) expect(slot.alt).toBeTruthy();
  });
});
