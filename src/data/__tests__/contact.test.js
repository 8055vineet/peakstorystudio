import { describe, it, expect } from 'vitest';
import {
  STUDIO_PHONE, STUDIO_EMAIL, STUDIO_ADDRESS,
  WHATSAPP_NUMBER, STUDIO_INSTAGRAM_URL, STUDIO_YOUTUBE_URL,
} from '../contact';

describe('studio contact details (confirmed by the owner 2026-08-03)', () => {
  it('carries the real Lucknow details, not the seeded Mumbai placeholders', () => {
    expect(STUDIO_PHONE).toBe('+91 8881621021');
    expect(STUDIO_EMAIL).toBe('peakstorystudio@gmail.com');
    expect(STUDIO_ADDRESS).toBe('2/231 Vastu Khand, Gomtinagar, Lucknow, UP');
  });

  it('has a WhatsApp number in wa.me digit form', () => {
    expect(WHATSAPP_NUMBER).toBe('918881621021');
  });

  it('leaves social URLs empty until the owner supplies them', () => {
    expect(STUDIO_INSTAGRAM_URL).toBe('');
    expect(STUDIO_YOUTUBE_URL).toBe('');
  });
});
