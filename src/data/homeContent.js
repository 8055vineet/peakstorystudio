// FALLBACK ONLY since Phase 3c: the live values live in the site_settings
// table and are edited in the admin's Settings tab. What is here renders
// when the database is unreachable, and serves as the prop defaults
// components use when rendered unwired (tests). The static files in
// public/images/home/ remain the fallback image slots for the same reason.
// Keep this file in step with the migration's seeded values; do not edit it
// to change the live site — use the admin.
export const HOME_QUOTE = {
  text: 'Every journey builds toward a single, breathless moment. We are here to capture the story when it reaches its absolute peak.',
  credit: 'by abhinav',
};

export const BRAND_STORY = {
  heading: 'The Brand Story',
  paragraphs: [
    "At Peak Story Studio, we believe that life's most profound moments are not just lived—they unfold like a masterpiece. Whether it is the quiet, nervous anticipation right before a wedding ceremony or the soaring crescendo of a cinematic short film, every narrative has a summit.",
    "Our passion lies in recognizing that exact heartbeat. We don't just record events; we wait for the emotion, the light, and the connection to converge at their highest point. By freezing time at the peak of your story, we turn fleeting chapters into timeless memories that you can relive forever.",
  ],
};

export const HOME_IMAGES = {
  hero: { src: '/images/home/hero.jpg', alt: 'A couple embracing beneath the arches of a Lucknow monument at golden hour' },
  brandStory: { src: '/images/home/brand-story.jpg', alt: 'A bride in an embellished navy lehenga, framed by dark leaves' },
  closing: { src: '/images/home/closing.jpg', alt: "A couple's hands holding their two gold wedding rings" },
};
