import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// SettingsForm embeds MediaPicker, which imports mediaUrl.js (env at module
// load) — same dynamic-import hygiene as MediaPicker's own tests.
beforeEach(() => vi.resetModules());

const INITIAL = {
  id: 1,
  quoteText: 'Every journey builds toward a single, breathless moment. We are here to capture the story when it reaches its absolute peak.',
  quoteCredit: 'by abhinav',
  brandStoryHeading: 'The Brand Story',
  brandStoryP1: 'First real paragraph.',
  brandStoryP2: 'Second real paragraph.',
  heroMediaId: 'm-hero',
  brandStoryMediaId: 'm-brand',
  closingMediaId: 'm-close',
  studioAddress: '2/231 Vastu Khand, Gomtinagar, Lucknow, UP',
  studioEmail: 'peakstorystudio@gmail.com',
  studioPhone: '+91 8881621021',
  whatsappNumber: '918881621021',
  instagramUrl: '',
  youtubeUrl: '',
};

const MEDIA = [
  { id: 'm-hero', storagePath: '/images/home/hero.jpg', altText: 'Hero' },
  { id: 'm-brand', storagePath: '/images/home/brand-story.jpg', altText: 'Portrait' },
  { id: 'm-close', storagePath: '/images/home/closing.jpg', altText: 'Closing' },
];

async function renderForm(overrides = {}) {
  vi.stubEnv('VITE_MEDIA_BASE_URL', 'https://cdn.peakstorystudio.test');
  const { default: SettingsForm } = await import('../SettingsForm.jsx');
  const props = {
    initial: INITIAL,
    media: MEDIA,
    mediaStatus: 'ready',
    mediaError: null,
    onRetryMedia: vi.fn(),
    onUploaded: vi.fn(),
    onSave: vi.fn(),
    pending: false,
    error: null,
    saved: false,
    ...overrides,
  };
  return { ...render(<SettingsForm {...props} />), props };
}

describe('SettingsForm', () => {
  it('renders every field pre-filled from the settings row', async () => {
    await renderForm();
    expect(screen.getByLabelText('Quote')).toHaveValue(INITIAL.quoteText);
    expect(screen.getByLabelText('Email address')).toHaveValue('peakstorystudio@gmail.com');
    expect(screen.getByLabelText('WhatsApp number')).toHaveValue('918881621021');
  });

  it('highlights the currently selected photograph in each of the three image slots', async () => {
    await renderForm();
    expect(screen.getAllByRole('button', { name: /✓ selected/i })).toHaveLength(3);
  });

  it.each([
    ['Quote', '', /keep a quote/i],
    ['Email address', 'not-an-email', /does not look right/i],
    ['WhatsApp number', 'abc', /digits only/i],
    ['Instagram URL', 'ftp://x', /must start with http/i],
  ])('blocks save when %s is invalid', async (label, badValue, message) => {
    const { props } = await renderForm();
    fireEvent.change(screen.getByLabelText(label), { target: { value: badValue } });
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('submits the full camelCase values object when valid', async () => {
    const { props } = await renderForm();
    fireEvent.change(screen.getByLabelText('Quote credit'), { target: { value: 'by the studio' } });
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave.mock.calls[0][0]).toMatchObject({
      quoteCredit: 'by the studio',
      studioEmail: 'peakstorystudio@gmail.com',
      heroMediaId: 'm-hero',
    });
  });

  it('shows the saved confirmation and the error message', async () => {
    await renderForm({ saved: true });
    expect(screen.getByRole('status')).toHaveTextContent(/saved/i);
    vi.resetModules();
    await renderForm({ error: new Error('denied') });
    expect(screen.getByRole('alert')).toHaveTextContent(/could not save: denied/i);
  });
});
