import { useCallback, useRef, useState } from 'react';
import { submitInquiry } from '../lib/queries/inquiries';

const IDLE = { status: 'idle', errorCode: null, fieldErrors: {} };

// Owns the whole lifecycle of one submission so BookingForm stays
// presentational. Returns true when the inquiry was stored, so the caller can
// decide what to celebrate without inspecting state that has not settled yet.
//
// Two ordering hazards this guards against, both real for a paying couple:
// a double-click firing a second submit while the first is still in flight
// (the Turnstile token is single-use, so that second attempt could never
// have succeeded anyway — Cloudflare would reject the replay), and a slow
// response arriving after reset() or after a newer submission has already
// started, which would otherwise overwrite state a couple is already acting
// on. `pendingRef` blocks the former; `generationRef` guards the latter.
export function useInquirySubmission() {
  const [state, setState] = useState(IDLE);
  const pendingRef = useRef(false);
  const generationRef = useRef(0);

  const submit = useCallback(async (payload) => {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    const generation = ++generationRef.current;

    setState({ status: 'pending', errorCode: null, fieldErrors: {} });
    try {
      await submitInquiry(payload);
      if (generation === generationRef.current) {
        setState({ status: 'success', errorCode: null, fieldErrors: {} });
      }
      return true;
    } catch (error) {
      if (generation === generationRef.current) {
        setState({
          status: 'error',
          errorCode: error?.code ?? 'SERVER_ERROR',
          fieldErrors: error?.fields ?? {},
        });
      }
      return false;
    } finally {
      if (generation === generationRef.current) pendingRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    generationRef.current += 1;
    pendingRef.current = false;
    setState(IDLE);
  }, []);

  return { ...state, submit, reset };
}
