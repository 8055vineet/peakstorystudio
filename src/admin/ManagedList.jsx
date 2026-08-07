import { useMemo, useState } from 'react';

// The one add/rename/reorder/delete list manager, used for gallery
// categories (Gallery tab) and booking services (Settings tab).
// Presentational throughout: every mutation is a callback prop, and this
// component never assumes how (or whether) the write happened — the
// dashboard that mounts it owns the useResource instance and the error
// copy, exactly like ResourceList's division of labour.
//
// Callback contract: onAdd(name), onRename(item, nextName),
// onReorder(orderedIds), onDelete(item) — the ITEM, not just its id,
// because the two consumers key their mutations differently (categories
// rename by name through an RPC; services rename by id).
const SMALL_BUTTON_CLASS = 'px-3 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed';
const ARROW_BUTTON_CLASS = 'px-2 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-xs hover:bg-offwhite-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed';
const INPUT_CLASS = 'px-3 py-2 rounded-lg bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900';

export default function ManagedList({
  title, itemNoun, items, status, error, onRetry, onAdd, onRename, onReorder, onDelete,
  pending = false, actionError = null,
}) {
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Sorted defensively by sortOrder — same reasoning as ResourceList's own
  // module comment: the arrows must land on the correct neighbour even if a
  // caller supplies items from somewhere that didn't pre-sort them.
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [items],
  );

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    onAdd(name);
    setNewName('');
  }

  function handleMove(index, direction) {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    onReorder(reordered.map((item) => item.id));
  }

  function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    onDelete(item);
  }

  function handleSaveRename(item) {
    const next = renameDraft.trim();
    setRenamingId(null);
    if (!next || next === item.name) return;
    onRename(item, next);
  }

  return (
    <section className="border border-pitch-900/10 rounded-2xl bg-offwhite-50 p-5 mb-6 max-w-2xl">
      <h3 className="text-xs uppercase tracking-widest text-charcoal-500 font-bold mb-4">{title}</h3>

      {status === 'error' && (
        <div role="alert" className="p-6 text-center">
          <p className="text-sm font-semibold text-pitch-900 mb-4">
            Could not load{error?.message ? `: ${error.message}` : '.'}
          </p>
          <button
            type="button"
            onClick={() => onRetry?.()}
            className="px-6 py-2.5 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {status !== 'error' && status === 'loading' && sorted.length === 0 && (
        <p className="py-4 text-sm text-charcoal-700">Loading…</p>
      )}

      {status !== 'error' && sorted.length > 0 && (
        <ul className="space-y-2 mb-4">
          {sorted.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2">
              {renamingId === item.id ? (
                <>
                  <input
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    aria-label={`Rename ${item.name}`}
                    className={`flex-1 ${INPUT_CLASS}`}
                  />
                  <button type="button" onClick={() => handleSaveRename(item)} disabled={pending} className={SMALL_BUTTON_CLASS}>
                    Save
                  </button>
                  <button type="button" onClick={() => setRenamingId(null)} className={SMALL_BUTTON_CLASS}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-pitch-900">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => { setRenamingId(item.id); setRenameDraft(item.name); }}
                    disabled={pending}
                    className={SMALL_BUTTON_CLASS}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0 || pending}
                    aria-label={`Move up: ${item.name}`}
                    className={ARROW_BUTTON_CLASS}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === sorted.length - 1 || pending}
                    aria-label={`Move down: ${item.name}`}
                    className={ARROW_BUTTON_CLASS}
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => handleDelete(item)} disabled={pending} className={SMALL_BUTTON_CLASS}>
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {status !== 'error' && (
        <div className="flex items-center gap-2">
          <label htmlFor={`managed-list-add-${itemNoun}`} className="sr-only">{`New ${itemNoun}`}</label>
          <input
            id={`managed-list-add-${itemNoun}`}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`New ${itemNoun}…`}
            className={`flex-1 ${INPUT_CLASS}`}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="px-5 py-2 rounded-lg bg-pitch-900 text-offwhite-50 text-[10px] uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors disabled:opacity-60"
          >
            Add
          </button>
        </div>
      )}

      {actionError && (
        <p role="alert" className="mt-3 text-xs font-semibold text-pitch-900">{actionError.message}</p>
      )}
    </section>
  );
}
