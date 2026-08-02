import { describe, it, expect, vi } from 'vitest';
import { sendInquiryEmails, RESEND_URL } from '../email.js';

const INQUIRY = {
  id: '11111111-2222-3333-4444-555555555555',
  name: 'Ananya & Rohan',
  email: 'couple@example.com',
  phone: '+91 98200 00000',
  weddingDate: '2027-02-14',
  venue: 'Umaid Bhawan Palace',
  services: ['Cinematic Film'],
  message: 'Three days, two venues.',
};

const CONFIG = {
  apiKey: 'key',
  fromAddress: 'Studio <hello@example.com>',
  studioEmail: 'studio@example.com',
};

function okFetch() {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'sent' }) });
}

describe('sendInquiryEmails', () => {
  it.each([
    ['apiKey', { apiKey: '' }],
    ['fromAddress', { fromAddress: '' }],
    ['studioEmail', { studioEmail: '' }],
  ])('skips without sending when %s is missing', async (_name, override) => {
    const fetchImpl = okFetch();
    const result = await sendInquiryEmails(INQUIRY, { ...CONFIG, ...override, fetchImpl });
    expect(result.status).toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends the studio notification and the couple acknowledgement', async () => {
    const fetchImpl = okFetch();
    const result = await sendInquiryEmails(INQUIRY, { ...CONFIG, fetchImpl });
    expect(result.status).toBe('sent');
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const [studioUrl, studioInit] = fetchImpl.mock.calls[0];
    expect(studioUrl).toBe(RESEND_URL);
    expect(studioInit.headers.Authorization).toBe('Bearer key');
    const studioBody = JSON.parse(studioInit.body);
    expect(studioBody.to).toEqual(['studio@example.com']);
    expect(studioBody.reply_to).toBe('couple@example.com');
    expect(studioBody.html).toContain('Umaid Bhawan Palace');
    expect(studioBody.html).toContain('+91 98200 00000');

    const coupleBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(coupleBody.to).toEqual(['couple@example.com']);
  });

  it('escapes HTML in submitted values', async () => {
    const fetchImpl = okFetch();
    await sendInquiryEmails(
      { ...INQUIRY, venue: '<script>alert(1)</script>' },
      { ...CONFIG, fetchImpl },
    );
    const html = JSON.parse(fetchImpl.mock.calls[0][1].body).html;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('reports failed when the studio notification is rejected', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false, status: 422, text: async () => 'invalid from address',
    });
    const result = await sendInquiryEmails(INQUIRY, { ...CONFIG, fetchImpl });
    expect(result.status).toBe('failed');
  });

  it('reports failed rather than throwing when the request throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await sendInquiryEmails(INQUIRY, { ...CONFIG, fetchImpl });
    expect(result.status).toBe('failed');
  });

  it('still reports sent when only the couple acknowledgement fails', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'a' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' });
    const result = await sendInquiryEmails(INQUIRY, { ...CONFIG, fetchImpl });
    expect(result.status).toBe('sent');
  });
});
