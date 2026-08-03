import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

beforeEach(() => {
  vi.resetModules();
  mockFrom.mockReset();
});

const ROW = {
  id: 1,
  quote_text: 'Q', quote_credit: 'C',
  brand_story_heading: 'H', brand_story_p1: 'P1', brand_story_p2: 'P2',
  hero_media_id: 'm-1', brand_story_media_id: null, closing_media_id: 'm-3',
  studio_address: 'A', studio_email: 'e@x.test', studio_phone: '+91 1',
  whatsapp_number: '911', instagram_url: '', youtube_url: '',
};

function readChain(row, error = null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve({ data: row, error }),
  };
  return chain;
}

function updateChain(captured, row, error = null) {
  const chain = {
    update: (values) => { captured.values = values; return chain; },
    eq: (col, val) => { captured.eq = [col, val]; return chain; },
    select: () => chain,
    single: () => Promise.resolve({ data: row, error }),
  };
  return chain;
}

describe('getSettingsRow', () => {
  it('maps snake_case columns to camelCase', async () => {
    mockFrom.mockReturnValue(readChain(ROW));
    const { getSettingsRow } = await import('../adminSettings');
    const item = await getSettingsRow();
    expect(item.quoteText).toBe('Q');
    expect(item.brandStoryP2).toBe('P2');
    expect(item.heroMediaId).toBe('m-1');
    expect(item.brandStoryMediaId).toBeNull();
    expect(item.whatsappNumber).toBe('911');
  });

  it('throws a prefixed error on failure', async () => {
    mockFrom.mockReturnValue(readChain(null, { message: 'nope' }));
    const { getSettingsRow } = await import('../adminSettings');
    await expect(getSettingsRow()).rejects.toThrow('site_settings: read failed: nope');
  });
});

describe('updateSiteSettings', () => {
  it('sends only known columns, targets id 1, drops id and unknown keys', async () => {
    const captured = {};
    mockFrom.mockReturnValue(updateChain(captured, ROW));
    const { updateSiteSettings } = await import('../adminSettings');
    await updateSiteSettings({
      id: 99, quoteText: 'New', unknownKey: 'x', heroMediaId: 'm-9',
    });
    expect(captured.values).toEqual({ quote_text: 'New', hero_media_id: 'm-9' });
    expect(captured.eq).toEqual(['id', 1]);
  });

  it('throws a prefixed error on failure', async () => {
    const captured = {};
    mockFrom.mockReturnValue(updateChain(captured, null, { message: 'denied' }));
    const { updateSiteSettings } = await import('../adminSettings');
    await expect(updateSiteSettings({ quoteText: 'x' })).rejects.toThrow('site_settings: update failed: denied');
  });
});
