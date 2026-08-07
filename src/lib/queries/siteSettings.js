import { supabase } from '../supabase';
import { publicMediaUrl } from '../mediaUrl';
import { HOME_IMAGES } from '../../data/homeContent';

// The one place the site's singular content (site_settings, one row) is
// read. Resilience lives in useSiteSettings (src/hooks/useContent.js),
// which falls back to src/data/siteSettingsFallback.js — this module only
// reads and maps.
const SETTINGS_SELECT = `
  quote_text, quote_credit, brand_story_heading, brand_story_p1, brand_story_p2,
  studio_address, studio_email, studio_phone, whatsapp_number, instagram_url, youtube_url,
  heading_font, body_font,
  hero:hero_media_id (storage_path, alt_text),
  brand_story:brand_story_media_id (storage_path, alt_text),
  closing:closing_media_id (storage_path, alt_text)
`;

// A slot with no media row yet falls back to the shipped static image —
// the site looks identical until the owner changes something.
function slot(media, fallback) {
  if (!media?.storage_path) return { ...fallback };
  return {
    src: publicMediaUrl(media.storage_path),
    alt: media.alt_text || fallback.alt,
  };
}

export async function getSiteSettings() {
  const { data, error } = await supabase
    .from('site_settings')
    .select(SETTINGS_SELECT)
    .eq('id', 1)
    .single();

  if (error) throw new Error(`getSiteSettings: ${error.message}`);

  return {
    quote: { text: data.quote_text, credit: data.quote_credit },
    brandStory: {
      heading: data.brand_story_heading,
      paragraphs: [data.brand_story_p1, data.brand_story_p2],
    },
    images: {
      hero: slot(data.hero, HOME_IMAGES.hero),
      brandStory: slot(data.brand_story, HOME_IMAGES.brandStory),
      closing: slot(data.closing, HOME_IMAGES.closing),
    },
    contact: {
      address: data.studio_address,
      email: data.studio_email,
      phone: data.studio_phone,
      whatsappNumber: data.whatsapp_number,
      instagramUrl: data.instagram_url,
      youtubeUrl: data.youtube_url,
    },
    fonts: { heading: data.heading_font, body: data.body_font },
  };
}
