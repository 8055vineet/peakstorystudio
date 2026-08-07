import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// SettingsForm's slots open MediaPickerDialog, which embeds UploadField —
// its pipeline is proven elsewhere, so the hook is mocked wholesale, same
// as ResourceForm.test.jsx.
vi.mock('../../hooks/useMediaUpload', () => ({
  useMediaUpload: () => ({
    status: 'idle', progress: 0, error: null, upload: vi.fn(), reset: vi.fn(),
  }),
}));

// The dialog's grid imports mediaUrl.js (env at module load) — same
// dynamic-import hygiene as MediaPicker's own tests.
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
  headingFont: 'Cormorant Garamond',
  bodyFont: 'Plus Jakarta Sans',
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

  it('shows each image slot as a compact thumbnail control — never an inline grid', async () => {
    await renderForm();
    expect(screen.getByAltText('Hero')).toBeInTheDocument();
    expect(screen.getByAltText('Portrait')).toBeInTheDocument();
    expect(screen.getByAltText('Closing')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^change$/i })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /^select$/i })).toBeNull();
  });

  it('changes the hero slot through the picker dialog and submits the new id', async () => {
    const { props } = await renderForm();
    fireEvent.click(screen.getAllByRole('button', { name: /^change$/i })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Choose a photograph' });
    fireEvent.click(within(dialog).getByRole('button', { name: /select photograph: portrait/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(props.onSave.mock.calls[0][0]).toMatchObject({ heroMediaId: 'm-brand' });
  });

  it('removes the hero photograph and submits null, falling back to the shipped image', async () => {
    const { props } = await renderForm();
    fireEvent.click(screen.getAllByRole('button', { name: /^remove$/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(props.onSave.mock.calls[0][0]).toMatchObject({ heroMediaId: null });
  });

  it.each([
    ['Quote', '', /keep a quote/i],
    ['Email address', 'not-an-email', /does not look right/i],
    ['WhatsApp number', 'abc', /or leave it empty/i],
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

  it('renders the Typography selects with the current fonts and submits a change', async () => {
    const { props } = await renderForm();
    expect(screen.getByLabelText(/heading font/i)).toHaveValue('Cormorant Garamond');
    expect(screen.getByLabelText(/body font/i)).toHaveValue('Plus Jakarta Sans');
    fireEvent.change(screen.getByLabelText(/heading font/i), { target: { value: 'Playfair Display' } });
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(props.onSave.mock.calls[0][0]).toMatchObject({ headingFont: 'Playfair Display' });
  });

  it('shows the saved confirmation and the error message', async () => {
    await renderForm({ saved: true });
    expect(screen.getByRole('status')).toHaveTextContent(/saved/i);
    vi.resetModules();
    await renderForm({ error: new Error('denied') });
    expect(screen.getByRole('alert')).toHaveTextContent(/could not save: denied/i);
  });
});
