import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();

vi.mock('../../supabase', () => ({
  supabase: { functions: { invoke: (...args) => invoke(...args) } },
  isSupabaseConfigured: true,
}));

const PAYLOAD = {
  name: 'Ananya & Rohan',
  email: 'couple@example.com',
  phone: '+91 98200 00000',
  weddingDate: '2027-02-14',
  venue: 'Umaid Bhawan Palace',
  services: ['Cinematic Film'],
  message: '',
  website: '',
  turnstileToken: 'tok',
};

describe('submitInquiry', () => {
  beforeEach(() => {
    invoke.mockReset();
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    vi.resetModules();
  });

  it('invokes the submit-inquiry function with the payload', async () => {
    invoke.mockResolvedValue({ data: { ok: true, id: 'abc' }, error: null });
    const { submitInquiry } = await import('../inquiries.js');

    const result = await submitInquiry(PAYLOAD);

    expect(invoke).toHaveBeenCalledWith('submit-inquiry', { body: PAYLOAD });
    expect(result).toEqual({ id: 'abc' });
  });

  it('surfaces field errors from a 400 response', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          json: async () => ({ ok: false, error: 'VALIDATION_FAILED', fields: { email: 'bad' } }),
        },
      },
    });
    const { submitInquiry, InquiryError } = await import('../inquiries.js');

    const failure = await submitInquiry(PAYLOAD).catch((error) => error);

    expect(failure).toBeInstanceOf(InquiryError);
    expect(failure.code).toBe('VALIDATION_FAILED');
    expect(failure.fields).toEqual({ email: 'bad' });
  });

  it('falls back to NETWORK_ERROR when the error carries no readable body', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('failed to fetch') });
    const { submitInquiry } = await import('../inquiries.js');

    const failure = await submitInquiry(PAYLOAD).catch((error) => error);

    expect(failure.code).toBe('NETWORK_ERROR');
    expect(failure.fields).toEqual({});
  });

  it('throws SERVER_ERROR when the function answers 200 without ok', async () => {
    invoke.mockResolvedValue({ data: { ok: false }, error: null });
    const { submitInquiry } = await import('../inquiries.js');

    const failure = await submitInquiry(PAYLOAD).catch((error) => error);

    expect(failure.code).toBe('SERVER_ERROR');
  });

  it('reports the backend unconfigured when the Turnstile site key is missing', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    vi.resetModules();
    const { submitInquiry, isInquiryBackendConfigured } = await import('../inquiries.js');

    expect(isInquiryBackendConfigured).toBe(false);
    const failure = await submitInquiry(PAYLOAD).catch((error) => error);
    expect(failure.code).toBe('BACKEND_UNCONFIGURED');
    expect(invoke).not.toHaveBeenCalled();
  });
});
