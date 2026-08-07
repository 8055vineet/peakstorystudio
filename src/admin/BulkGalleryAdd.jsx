import { useState } from 'react';
import UploadField from './UploadField.jsx';

// The Gallery tab's bulk-add panel: pick a category, then bulk-upload — each
// uploaded photograph becomes a draft gallery row (the dashboard's onUpload
// does the create). Presentational: the category list and the last run's
// summary arrive as props; the only state here is which category is picked.
const LABEL_CLASS = 'block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-semibold';

export default function BulkGalleryAdd({
  categories, onUpload, pending, summary, onPublishAll, onDismiss,
}) {
  const [category, setCategory] = useState('');

  return (
    <section className="border border-pitch-900/10 rounded-2xl bg-offwhite-50 p-5 mb-6 max-w-2xl">
      <h3 className="text-xs uppercase tracking-widest text-charcoal-500 font-bold mb-4">Bulk add to Gallery</h3>

      <div className="mb-4">
        <label htmlFor="bulk-gallery-category" className={LABEL_CLASS}>Category</label>
        <select
          id="bulk-gallery-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
        >
          <option value="">Select a category…</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <p className="mt-1 text-xs text-charcoal-500">
          Every photograph you add becomes a draft in this category — publish when you are ready.
        </p>
      </div>

      {/* Gated on a chosen category: a bulk upload with no category would
          create rows the public gallery can't file under any section. Before
          a category is picked, a disabled stand-in keeps the control visible
          (and its label queryable) without wiring UploadField to a run.
          key={category} remounts UploadField per category so a fresh run
          starts clean. */}
      {category ? (
        <UploadField
          key={category}
          onUploaded={(media, file) => onUpload(media, file, category)}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <label className="px-4 py-2.5 rounded-lg border border-pitch-900/20 text-pitch-900/50 text-xs uppercase tracking-widest font-semibold">
            Choose images
          </label>
          <input aria-label="Choose images" type="file" disabled className="sr-only" />
        </div>
      )}

      {summary && (
        <div role="status" className="mt-4 p-4 rounded-lg border border-gold-500 bg-offwhite-50 space-y-2">
          <p className="text-xs font-bold text-pitch-900">
            {summary.created} draft photos created in {summary.category}
          </p>
          {summary.notAdded > 0 && (
            <p className="text-xs text-charcoal-700">
              {summary.notAdded} uploaded but not added — find them in the Media Library.
            </p>
          )}
          <div className="flex gap-3">
            {summary.created > 0 && (
              <button
                type="button"
                onClick={onPublishAll}
                disabled={pending}
                className="px-5 py-2 rounded-lg bg-pitch-900 text-offwhite-50 text-[10px] uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors disabled:opacity-60"
              >
                {pending ? 'Publishing…' : `Publish all ${summary.created}`}
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="px-5 py-2 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
