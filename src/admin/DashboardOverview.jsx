import { useEffect, useState } from 'react';
import { getOverviewCounts } from '../lib/queries/adminOverview';

// The admin's landing screen: the studio's numbers at a glance, each card a
// shortcut into its tab. Fetches once per mount (and per retry) — counts
// are cheap head-only queries, but nothing here polls.

const CARD_CLASS = 'w-full text-left border border-pitch-900/10 rounded-2xl bg-offwhite-50 p-6 hover:border-pitch-900/40 transition-colors';

function StatusCard({ label, pair, onClick }) {
  return (
    <button type="button" onClick={onClick} className={CARD_CLASS}>
      <p className="text-[10px] uppercase tracking-widest text-charcoal-500 font-bold mb-2">{label}</p>
      <p className="text-2xl font-bold text-pitch-900">{pair.published}<span className="text-sm font-semibold text-charcoal-500"> published</span></p>
      <p className="text-xs font-semibold text-charcoal-700 mt-1">{pair.draft} draft{pair.draft === 1 ? '' : 's'}</p>
    </button>
  );
}

export default function DashboardOverview({ onNavigate }) {
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getOverviewCounts()
      .then((result) => { if (!cancelled) setCounts(result); })
      .catch((err) => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  function retry() {
    setError(null);
    setCounts(null);
    setReloadKey((key) => key + 1);
  }

  if (error) {
    return (
      <div role="alert" className="p-8 text-center border border-pitch-900/15 rounded-2xl bg-offwhite-50 max-w-xl">
        <p className="text-sm font-semibold text-pitch-900 mb-4">Could not load the overview: {error.message}</p>
        <button
          type="button"
          onClick={retry}
          className="px-6 py-2.5 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!counts) {
    return <p className="p-8 text-sm text-charcoal-700">Loading the overview…</p>;
  }

  return (
    <div>
      <h1 className="font-cinzel text-2xl font-bold text-pitch-900 mb-6">Dashboard</h1>

      {counts.newLeads > 0 && (
        <button
          type="button"
          onClick={() => onNavigate('leads')}
          className="mb-6 flex w-full items-center gap-3 rounded-2xl border-2 border-gold-500 bg-offwhite-50 px-5 py-4 text-left hover:border-gold-400 transition-colors"
        >
          <span className="text-xl" aria-hidden="true">✉</span>
          <span className="text-sm font-bold text-pitch-900">
            {counts.newLeads === 1
              ? 'A new lead is waiting — open Booking Inquiries.'
              : `${counts.newLeads} new leads are waiting — open Booking Inquiries.`}
          </span>
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button type="button" onClick={() => onNavigate('leads')} className={CARD_CLASS}>
          <p className="text-[10px] uppercase tracking-widest text-charcoal-500 font-bold mb-2">New Leads</p>
          <p className="text-2xl font-bold text-pitch-900">{counts.newLeads}</p>
          <p className="text-xs font-semibold text-charcoal-700 mt-1">awaiting first contact</p>
        </button>
        <StatusCard label="Weddings" pair={counts.weddings} onClick={() => onNavigate('weddings')} />
        <StatusCard label="Gallery Photos" pair={counts.gallery} onClick={() => onNavigate('gallery')} />
        <StatusCard label="Films" pair={counts.films} onClick={() => onNavigate('films')} />
        <StatusCard label="Testimonials" pair={counts.testimonials} onClick={() => onNavigate('testimonials')} />
        <button type="button" onClick={() => onNavigate('settings')} className={CARD_CLASS}>
          <p className="text-[10px] uppercase tracking-widest text-charcoal-500 font-bold mb-2">Site Settings</p>
          <p className="text-sm font-semibold text-pitch-900 mt-1">Quote · Brand Story · Home images · Contact</p>
        </button>
      </div>
    </div>
  );
}
