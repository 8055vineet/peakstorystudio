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

  it('still thanks the couple when only the studio notification fails', async () => {
    // A mistyped STUDIO_NOTIFY_EMAIL should not cost the couple their
    // acknowledgement — they did nothing wrong and silence reads as being
    // ignored. The row still records that the studio was never told.
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'bad studio address' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'couple' }) });

    const result = await sendInquiryEmails(INQUIRY, { ...CONFIG, fetchImpl });

    expect(result.status).toBe('failed');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).to).toEqual(['couple@example.com']);
  });

  it('sends both messages concurrently rather than one after the other', async () => {
    // Sequential sends stack their timeouts, so a slow Resend holds the couple
    // at a disabled button for twice as long as it needs to.
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl = vi.fn().mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return { ok: true, json: async () => ({ id: 'sent' }) };
    });

    await sendInquiryEmails(INQUIRY, { ...CONFIG, fetchImpl });

    expect(maxInFlight).toBe(2);
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
