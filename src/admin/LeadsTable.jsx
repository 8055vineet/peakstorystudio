import { useMemo, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { formatDateOnly, formatTimestamp } from './formatDate.js';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'booked', label: 'Booked' },
  { value: 'archived', label: 'Archived' },
];

const FILTER_ID = 'leads-status-filter';

// notification_status is the reason this whole screen exists: it is the
// only record of whether the studio was actually told about a lead. Three
// distinct treatments, not two:
//   - 'failed'/'skipped' — the studio was DEFINITELY never told. Solid,
//     filled, impossible to scan past.
//   - 'pending' — the studio does not yet know either way. Written by
//     submit-inquiry BEFORE the notification attempt, and only updated
//     to sent/failed AFTER it — a function that dies in between (or a
//     future caller that forgets to set it) leaves a row at 'pending'
//     forever. This is meant to last milliseconds; on a row sitting for
//     hours it carries the same "go find out" urgency as 'failed', so it
//     gets its own visibly-unconfirmed treatment, not the quiet one
//     'sent' gets.
//   - 'sent' — confirmed delivered. The only status that earns the quiet
//     badge.
function NotificationBadge({ notificationStatus }) {
  if (notificationStatus === 'failed' || notificationStatus === 'skipped') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pitch-900 text-offwhite-50 text-[10px] uppercase tracking-widest font-bold">
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
        Not Notified — {notificationStatus === 'failed' ? 'Send Failed' : 'Skipped'}
      </span>
    );
  }
  if (notificationStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-gold-500 text-gold-600 text-[10px] uppercase tracking-widest font-bold">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        Notification Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-pitch-900/15 text-charcoal-700 text-[10px] uppercase tracking-widest font-semibold">
      Notified
    </span>
  );
}

// Presentational only: fetching, filtering-at-the-database-layer, and the
// no-optimistic-update discipline all live one level up in useResource /
// adminInquiries.js. This component's own statusFilter is UI-only state
// that never needs to escape it, same as Navbar's `scrolled`.
export default function LeadsTable({
  items, status, error, onRetry, selectedId, onSelectLead,
}) {
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(
    () => (statusFilter ? items.filter((item) => item.status === statusFilter) : items),
    [items, statusFilter],
  );

  // status wins over whatever `items` currently holds. useResource keeps the
  // last known-good list around through a failed reload (so a transient
  // error doesn't wipe a screen full of real data), which means `items` can
  // be non-empty even while status === 'error' — rendering the table in
  // that case would show stale data as if it were current.
  if (status === 'error') {
    return (
      <div role="alert" className="p-10 text-center border border-pitch-900/15 rounded-2xl bg-offwhite-50">
        <p className="text-sm font-semibold text-pitch-900 mb-4">
          Could not load inquiries{error?.message ? `: ${error.message}` : '.'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="px-6 py-2.5 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (status === 'loading' && items.length === 0) {
    return <p className="p-10 text-center text-sm text-charcoal-700">Loading inquiries…</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <label htmlFor={FILTER_ID} className="text-xs uppercase tracking-widest text-charcoal-500 font-bold mr-3">
          Filter by status
        </label>
        <select
          id={FILTER_ID}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-pitch-900/15 bg-offwhite-50 text-pitch-900 text-xs uppercase tracking-widest font-semibold focus:outline-none focus:border-pitch-900"
        >
          {STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {/* Distinct from the error state above, and distinct from each other:
          "nothing has ever come in" and "nothing matches this filter" are
          different facts too, even though neither is a failure. */}
      {filtered.length === 0 ? (
        <p className="p-10 text-center text-sm text-charcoal-700 border border-pitch-900/10 rounded-2xl">
          {items.length === 0 ? 'No inquiries yet.' : 'No inquiries match this filter.'}
        </p>
      ) : (
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="border-b border-pitch-900/15 text-[10px] uppercase tracking-widest text-charcoal-500">
              <th scope="col" className="py-3 pr-4 font-bold">Name</th>
              <th scope="col" className="py-3 pr-4 font-bold">Wedding Date</th>
              <th scope="col" className="py-3 pr-4 font-bold">Venue</th>
              <th scope="col" className="py-3 pr-4 font-bold">Submitted</th>
              <th scope="col" className="py-3 pr-4 font-bold">Status</th>
              <th scope="col" className="py-3 pr-4 font-bold">Notification</th>
              <th scope="col" className="py-3 pr-4 font-bold">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr
                key={item.id}
                className={`border-b border-pitch-900/10 ${item.id === selectedId ? 'bg-offwhite-200' : ''}`}
              >
                <td className="py-3 pr-4 font-semibold text-pitch-900">{item.name}</td>
                <td className="py-3 pr-4 text-charcoal-700">{formatDateOnly(item.weddingDate) || '—'}</td>
                <td className="py-3 pr-4 text-charcoal-700">{item.venue || '—'}</td>
                <td className="py-3 pr-4 text-charcoal-700">{formatTimestamp(item.createdAt) || '—'}</td>
                <td className="py-3 pr-4 text-charcoal-700 capitalize">{item.status}</td>
                <td className="py-3 pr-4"><NotificationBadge notificationStatus={item.notificationStatus} /></td>
                <td className="py-3 pr-4">
                  <button
                    type="button"
                    onClick={() => onSelectLead?.(item.id)}
                    aria-pressed={item.id === selectedId}
                    className="px-3 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
