import { useCallback, useState } from 'react';
import { submitInquiry } from '../lib/queries/inquiries';

const IDLE = { status: 'idle', errorCode: null, fieldErrors: {} };

// Owns the whole lifecycle of one submission so BookingForm stays
// presentational. Returns true when the inquiry was stored, so the caller can
// decide what to celebrate without inspecting state that has not settled yet.
export function useInquirySubmission() {
  const [state, setState] = useState(IDLE);

  const submit = useCallback(async (payload) => {
    setState({ status: 'pending', errorCode: null, fieldErrors: {} });
    try {
      await submitInquiry(payload);
      setState({ status: 'success', errorCode: null, fieldErrors: {} });
      return true;
    } catch (error) {
      setState({
        status: 'error',
        errorCode: error?.code ?? 'SERVER_ERROR',
        fieldErrors: error?.fields ?? {},
      });
      return false;
    }
  }, []);

  const reset = useCallback(() => setState(IDLE), []);

  return { ...state, submit, reset };
}
