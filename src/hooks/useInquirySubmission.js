import { useCallback, useRef, useState } from 'react';
import { submitInquiry } from '../lib/queries/inquiries';

const IDLE = { status: 'idle', errorCode: null, fieldErrors: {}, retryAfterSeconds: undefined };

// Owns the whole lifecycle of one submission so BookingForm stays
// presentational.
//
// Two ordering hazards this guards against, both real for a paying couple:
// a double-click firing a second submit while the first is still in flight
// (the Turnstile token is single-use, so that second attempt could never
// have succeeded anyway — Cloudflare would reject the replay), and a slow
// response arriving after reset() or after a newer submission has already
// started, which would otherwise overwrite state a couple is already acting
// on. `pendingRef` blocks the former; `generationRef` guards the latter.
//
// THE CONTRACT, because the two halves deliberately disagree in one case:
//
//   The returned boolean is THIS request's outcome. It is true only after a
//   real 200, so it always means the lead reached the database.
//
//   The state is what the UI should show NOW, which is not the same thing:
//   a response belonging to a superseded generation is dropped so it cannot
//   overwrite something the couple is already looking at.
//
// They diverge only when reset() lands mid-flight — unreachable from the
// form, where reset is wired solely to the button on the success panel and
// that panel cannot be on screen while a request is pending. If a caller ever
// does reset mid-flight, a failure would return false while state stayed
// idle, so a caller that renders errors from state alone would say nothing at
// all about a lead that was just lost. **Act on the boolean.** Use state for
// the pending flag, the inline field errors, and the error copy.
export function useInquirySubmission() {
  const [state, setState] = useState(IDLE);
  const pendingRef = useRef(false);
  const generationRef = useRef(0);

  const submit = useCallback(async (payload) => {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    const generation = ++generationRef.current;

    setState({ status: 'pending', errorCode: null, fieldErrors: {}, retryAfterSeconds: undefined });
    try {
      await submitInquiry(payload);
      if (generation === generationRef.current) {
        setState({
          status: 'success', errorCode: null, fieldErrors: {}, retryAfterSeconds: undefined,
        });
      }
      return true;
    } catch (error) {
      if (generation === generationRef.current) {
        setState({
          status: 'error',
          errorCode: error?.code ?? 'SERVER_ERROR',
          fieldErrors: error?.fields ?? {},
          // Only a 429 carries this. Forwarded so the form can tell the
          // couple how long to wait instead of an unbounded "try later".
          retryAfterSeconds: error?.retryAfterSeconds,
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
