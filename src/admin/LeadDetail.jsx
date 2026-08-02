import { useRef, useState } from 'react';
// Deliberately from the shared, Supabase-free module rather than from
// ../lib/queries/adminInquiries — that module imports the Supabase client,
// and this is a presentational component that must not transitively depend
// on it just to read a list of four strings. See @shared/inquiry-status.js
// for the full rationale.
import { INQUIRY_STATUSES } from '@shared/inquiry-status.js';
import { formatDateOnly } from './formatDate.js';

const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  booked: 'Booked',
  archived: 'Archived',
};

const ERROR_ID = 'lead-detail-update-error';

// Presentational: it never sets a local "what the status is now" value.
// Every render reads `inquiry.status` straight from the prop the parent's
// useResource-backed `items` supplies, so there is no optimistic value for
// a rejected onUpdateStatus() to have left behind — the row can only ever
// show what the database last confirmed, because that is the only thing
// this component is capable of showing.
export default function LeadDetail({ inquiry, onUpdateStatus }) {
  const [updating, setUpdating] = useState(false);
  // { message, written } | null. `written` distinguishes two failures
  // useResource's mutate() can produce: a genuine failed write (written:
  // false — the status is unchanged, "try again" is the right thing to
  // say), versus a write that succeeded but whose confirming reload failed
  // (written: true — the status DID change in the database, this panel
  // just cannot prove it yet). Telling the admin "could not update" in the
  // second case would be false; it saved.
  const [updateFailure, setUpdateFailure] = useState(null);
  // Belt-and-suspenders alongside the `disabled` attribute, same reasoning
  // as useInquirySubmission's pendingRef: React's re-render that disables
  // the buttons is not synchronous with the click handler that started it,
  // so a very fast second click could otherwise slip through the gap.
  const pendingRef = useRef(false);

  if (!inquiry) {
    return (
      <div className="p-10 text-center text-sm text-charcoal-700 border border-pitch-900/10 rounded-2xl">
        Select an inquiry to see its details.
      </div>
    );
  }

  const handleTransition = async (nextStatus) => {
    if (pendingRef.current || nextStatus === inquiry.status) return;
    pendingRef.current = true;
    setUpdating(true);
    setUpdateFailure(null);
    try {
      await onUpdateStatus(inquiry.id, nextStatus);
    } catch (err) {
      setUpdateFailure({
        message: err?.message || 'unknown error',
        written: Boolean(err?.written),
      });
    } finally {
      pendingRef.current = false;
      setUpdating(false);
    }
  };

  const isUrgent = inquiry.notificationStatus === 'failed' || inquiry.notificationStatus === 'skipped';

  return (
    <div className="p-6 border border-pitch-900/15 rounded-2xl bg-offwhite-50 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-pitch-900">{inquiry.name}</h2>
        <p className="text-sm text-charcoal-700">{inquiry.email} · {inquiry.phone}</p>
      </div>

      {isUrgent && (
        <p className="px-4 py-3 rounded-lg bg-pitch-900 text-offwhite-50 text-xs font-bold uppercase tracking-widest">
          {inquiry.notificationStatus === 'failed'
            ? 'The studio was not emailed about this inquiry — the notification failed.'
            : 'The studio was not emailed about this inquiry — notifications were skipped.'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs uppercase tracking-widest text-charcoal-500 font-bold mb-1">Wedding Date</h3>
          <p className="text-sm text-pitch-900">{formatDateOnly(inquiry.weddingDate) || 'Not specified'}</p>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-widest text-charcoal-500 font-bold mb-1">Venue</h3>
          <p className="text-sm text-pitch-900">{inquiry.venue || 'Not specified'}</p>
        </div>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-widest text-charcoal-500 font-bold mb-2">Services Requested</h3>
        {inquiry.services?.length ? (
          <ul className="flex flex-wrap gap-2">
            {inquiry.services.map((service) => (
              <li key={service} className="px-2.5 py-1 rounded-full border border-pitch-900/15 text-xs text-pitch-900">
                {service}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-charcoal-700">None specified</p>
        )}
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-widest text-charcoal-500 font-bold mb-2">Message</h3>
        <p className="text-sm text-pitch-900 whitespace-pre-wrap">{inquiry.message || 'No message provided.'}</p>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-widest text-charcoal-500 font-bold mb-3">Update Status</h3>
        {/* No delete control here or anywhere in this screen — 'archived' is
            the exit for a booking inquiry, which is a business record. */}
        <div className="flex flex-wrap gap-2" aria-busy={updating}>
          {INQUIRY_STATUSES.map((candidate) => {
            const isCurrent = candidate === inquiry.status;
            return (
              <button
                key={candidate}
                type="button"
                disabled={updating || isCurrent}
                aria-pressed={isCurrent}
                onClick={() => handleTransition(candidate)}
                className={`px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  isCurrent
                    ? 'bg-pitch-900 text-offwhite-50'
                    : 'border border-pitch-900/20 text-pitch-900 hover:bg-offwhite-200'
                }`}
              >
                {STATUS_LABELS[candidate]}
              </button>
            );
          })}
        </div>
        {updateFailure && (
          <p id={ERROR_ID} role="alert" className="mt-3 text-xs font-semibold text-pitch-900">
            {updateFailure.written
              ? `The status change saved, but this screen could not refresh to confirm it (${updateFailure.message}). Reload to check.`
              : `Could not update status: ${updateFailure.message}. Please try again.`}
          </p>
        )}
      </div>
    </div>
  );
}
