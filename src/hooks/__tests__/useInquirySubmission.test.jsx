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
  // Block body, not an implicit-return arrow: mockReset() returns the mock
  // itself, and Vitest treats a beforeEach's returned function as a cleanup
  // callback to invoke at teardown. An implicit return here would hand it
  // submitInquiry, which it would then call — replaying whatever rejection
  // a test had just installed with mockRejectedValue and reporting that as
  // a failure of its own.
  beforeEach(() => { submitInquiry.mockReset(); });

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

  it('ignores a second submit while the first is still in flight', async () => {
    let resolve;
    submitInquiry.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useInquirySubmission());

    let firstOutcome;
    let secondOutcome;
    act(() => {
      result.current.submit(PAYLOAD).then((v) => { firstOutcome = v; });
    });
    await waitFor(() => expect(result.current.status).toBe('pending'));

    // The double-click: a second submit while the token from the first has
    // already been spent. It must not reach the query layer at all — a
    // second call to Cloudflare with the same token can only fail.
    await act(async () => { secondOutcome = await result.current.submit(PAYLOAD); });

    expect(submitInquiry).toHaveBeenCalledTimes(1);
    expect(secondOutcome).toBe(false);
    expect(result.current.status).toBe('pending');

    await act(async () => { resolve({ id: 'abc' }); });
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(firstOutcome).toBe(true);
  });

  it('does not let a stale response overwrite state after reset', async () => {
    let resolve;
    submitInquiry.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useInquirySubmission());

    act(() => { result.current.submit(PAYLOAD); });
    await waitFor(() => expect(result.current.status).toBe('pending'));

    act(() => { result.current.reset(); });
    expect(result.current.status).toBe('idle');

    // The first request's response arrives after the couple has already
    // moved on (reset ran). It must not resurrect stale state.
    await act(async () => { resolve({ id: 'abc' }); });

    expect(result.current.status).toBe('idle');
    expect(result.current.errorCode).toBeNull();
  });

  it('does not let a stale response overwrite a newer submission', async () => {
    let resolveFirst;
    submitInquiry.mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }));
    const { result } = renderHook(() => useInquirySubmission());

    act(() => { result.current.submit(PAYLOAD); });
    await waitFor(() => expect(result.current.status).toBe('pending'));

    act(() => { result.current.reset(); });

    submitInquiry.mockRejectedValueOnce(new InquiryError('VALIDATION_FAILED', { email: 'bad' }));
    await act(async () => { await result.current.submit(PAYLOAD); });
    await waitFor(() => expect(result.current.status).toBe('error'));

    // The stale first response settles after the second submission has
    // already reported its own (different) outcome. It must not clobber it.
    await act(async () => { resolveFirst({ id: 'abc' }); });

    expect(result.current.status).toBe('error');
    expect(result.current.errorCode).toBe('VALIDATION_FAILED');
  });
});
