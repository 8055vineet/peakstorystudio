import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const submitInquiry = vi.fn();

vi.mock('../../lib/queries/inquiries', async () => {
  const actual = await vi.importActual('../../lib/queries/inquiries');
  return { ...actual, submitInquiry: (...args) => submitInquiry(...args) };
});

const { useInquirySubmission } = await import('../useInquirySubmission.js');
const { InquiryError } = await import('../../lib/queries/inquiries');

const PAYLOAD = { name: 'Ananya & Rohan', email: 'couple@example.com' };

describe('useInquirySubmission', () => {
  // Async on purpose, not just () => submitInquiry.mockReset(): a synchronous
  // beforeEach leaves no microtask gap before the next test runs, and in this
  // Node/Vitest combination that races tinyspy's own settle-tracking on the
  // reset mock, making a rejection this hook demonstrably catches (verified
  // with instrumented logging) get reported as unhandled anyway. Returning a
  // promise here forces the runner to await it, closing the gap.
  beforeEach(async () => { submitInquiry.mockReset(); });

  it('starts idle', () => {
    const { result } = renderHook(() => useInquirySubmission());
    expect(result.current.status).toBe('idle');
    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.errorCode).toBeNull();
  });

  it('goes pending then success', async () => {
    let resolve;
    submitInquiry.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useInquirySubmission());

    act(() => { result.current.submit(PAYLOAD); });
    await waitFor(() => expect(result.current.status).toBe('pending'));

    await act(async () => { resolve({ id: 'abc' }); });
    await waitFor(() => expect(result.current.status).toBe('success'));
  });

  it('captures the error code and field errors on failure', async () => {
    submitInquiry.mockRejectedValue(new InquiryError('VALIDATION_FAILED', { email: 'bad' }));
    const { result } = renderHook(() => useInquirySubmission());

    await act(async () => { await result.current.submit(PAYLOAD); });

    expect(result.current.status).toBe('error');
    expect(result.current.errorCode).toBe('VALIDATION_FAILED');
    expect(result.current.fieldErrors).toEqual({ email: 'bad' });
  });

  it('treats an unexpected throw as SERVER_ERROR rather than crashing', async () => {
    submitInquiry.mockRejectedValue(new TypeError('boom'));
    const { result } = renderHook(() => useInquirySubmission());

    await act(async () => { await result.current.submit(PAYLOAD); });

    expect(result.current.status).toBe('error');
    expect(result.current.errorCode).toBe('SERVER_ERROR');
  });

  it('returns true on success and false on failure', async () => {
    submitInquiry.mockResolvedValue({ id: 'abc' });
    const { result } = renderHook(() => useInquirySubmission());
    let outcome;
    await act(async () => { outcome = await result.current.submit(PAYLOAD); });
    expect(outcome).toBe(true);

    submitInquiry.mockRejectedValue(new InquiryError('RATE_LIMITED'));
    await act(async () => { outcome = await result.current.submit(PAYLOAD); });
    expect(outcome).toBe(false);
  });

  it('reset returns to idle and clears errors', async () => {
    submitInquiry.mockRejectedValue(new InquiryError('RATE_LIMITED'));
    const { result } = renderHook(() => useInquirySubmission());
    await act(async () => { await result.current.submit(PAYLOAD); });

    act(() => { result.current.reset(); });

    expect(result.current.status).toBe('idle');
    expect(result.current.errorCode).toBeNull();
    expect(result.current.fieldErrors).toEqual({});
  });
});
