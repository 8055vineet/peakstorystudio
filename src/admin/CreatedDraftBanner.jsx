// Shown once after every successful Create: every new record deliberately
// starts as a draft (see makeResourceQueries.create's own comment), and this
// is what makes that state impossible to miss — with the publish action
// right where the admin already is instead of hidden in the list row.
export default function CreatedDraftBanner({
  label, onPublish, onDismiss, publishing,
}) {
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border-2 border-gold-500 bg-offwhite-50 px-4 py-3">
      <p className="text-xs font-semibold text-pitch-900">
        Saved as draft — publish when ready{label ? `: ${label}` : ''}
      </p>
      <button
        type="button"
        onClick={onPublish}
        disabled={publishing}
        className="px-4 py-1.5 rounded-lg bg-pitch-900 text-offwhite-50 text-[10px] uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors disabled:opacity-60"
      >
        {publishing ? 'Publishing…' : 'Publish now'}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="px-3 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors"
      >
        Keep as draft
      </button>
    </div>
  );
}
