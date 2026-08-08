import { HOME_QUOTE, BRAND_STORY, HOME_IMAGES } from './homeContent';
import {
  STUDIO_ADDRESS, STUDIO_EMAIL, STUDIO_PHONE, WHATSAPP_NUMBER,
  STUDIO_INSTAGRAM_URL, STUDIO_YOUTUBE_URL,
} from './contact';
import { DEFAULT_HEADING_FONT, DEFAULT_BODY_FONT } from './fontOptions';
import { DEFAULT_WARMTH } from './surfaceTint';

// The shape useSiteSettings resolves, built from the shipped constants —
// what the site renders before the settings query resolves, when it fails,
// and what components default to when rendered unwired (tests). Pure data
// on purpose: components import this as a prop default, and a component
// must never (even transitively) import the Supabase client.
export const SITE_SETTINGS_FALLBACK = {
  quote: { text: HOME_QUOTE.text, credit: HOME_QUOTE.credit },
  brandStory: { heading: BRAND_STORY.heading, paragraphs: [...BRAND_STORY.paragraphs] },
  images: {
    hero: { ...HOME_IMAGES.hero },
    brandStory: { ...HOME_IMAGES.brandStory },
    closing: { ...HOME_IMAGES.closing },
  },
  contact: {
    address: STUDIO_ADDRESS,
    email: STUDIO_EMAIL,
    phone: STUDIO_PHONE,
    whatsappNumber: WHATSAPP_NUMBER,
    instagramUrl: STUDIO_INSTAGRAM_URL,
    youtubeUrl: STUDIO_YOUTUBE_URL,
  },
  fonts: { heading: DEFAULT_HEADING_FONT, body: DEFAULT_BODY_FONT },
  appearance: { warmth: DEFAULT_WARMTH },
  logo: null,
};
