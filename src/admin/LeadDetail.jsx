import { useRef, useState } from 'react';
import { INQUIRY_STATUSES } from '../lib/queries/adminInquiries';

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
  const [updateError, setUpdateError] = useState(null);
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
    setUpdateError(null);
    try {
      await onUpdateStatus(inquiry.id, nextStatus);
    } catch (err) {
      setUpdateError(err?.message || 'Could not update this status. Please try again.');
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
          <p className="text-sm text-pitch-900">{inquiry.weddingDate || 'Not specified'}</p>
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
        {updateError && (
          <p id={ERROR_ID} role="alert" className="mt-3 text-xs font-semibold text-pitch-900">
            Could not update status: {updateError}. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
