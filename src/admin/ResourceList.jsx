import { useMemo } from 'react';
import { formatDateOnly } from './formatDate.js';

// Small, self-contained duplicate of adminContent.js's toCamel — not
// imported from there. adminContent.js opens with `import { supabase } from
// '../supabase'`, so importing anything from it — even a pure string
// helper — would pull the real Supabase client into every module graph that
// renders ResourceList, which is exactly what CLAUDE.md's "components never
// import the Supabase client" rule (and every existing admin component
// test's lack of a supabase mock) depends on not happening.
function toCamel(column) {
  return column.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

// A human-readable stand-in for a row, used only in the delete confirmation
// and the reorder buttons' accessible names — never sent anywhere. Falls
// back to the id so a resource whose first listColumn happens to be blank
// still reads as *something* rather than an empty string.
function primaryLabel(item, config) {
  const first = config.listColumns[0]?.name;
  const value = first ? item[first] : null;
  return value || item.id;
}

function StatusToggle({ item, onToggleStatus }) {
  const isPublished = item.status === 'published';
  return (
    <button
      type="button"
      onClick={() => onToggleStatus?.(item.id, isPublished ? 'draft' : 'published')}
      aria-pressed={isPublished}
      className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-colors ${
        isPublished
          ? 'bg-pitch-900 text-offwhite-50'
          : 'border-2 border-gold-500 text-pitch-900'
      }`}
    >
      {isPublished ? 'Published' : 'Draft'}
    </button>
  );
}

// Never called for the 'status' column — the tbody map below renders
// StatusToggle for that one directly, without going through this function.
// `status` is deliberately not a field in any resource config either (see
// ResourceForm's own module comment); every resource has it regardless.
function renderCell(item, column, config) {
  const field = config.fields.find((candidate) => candidate.name === column.name);
  const value = item[column.name];

  if (field?.type === 'date') return formatDateOnly(value) || '—';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

// The one list/create/edit/publish/reorder/delete screen every content type
// in this admin shares — Tasks 8 and 9 write only a resource config (see
// ResourceForm.jsx's module comment for the config shape) and reuse this
// component unchanged. Presentational throughout: every action a click
// produces is a callback prop, and this component never assumes how (or
// whether) the write it asked for actually happened — that is
// useResource's job, one level up, in whatever screen wires
// onToggleStatus/onDelete/onReorder to mutate().
export default function ResourceList({
  config, items, status, error, onEdit, onCreate, onDelete, onToggleStatus, onReorder, onRetry,
}) {
  const label = config.label ?? 'Items';
  const singularLabel = label.toLowerCase();

  // Sorted here, defensively, by config.defaultSort — the snake_case
  // Postgres column (e.g. 'sort_order') the resource orders on — rather
  // than trusted to already arrive that way. makeResourceQueries' list()
  // already orders server-side by that same column, but a caller supplying
  // items from anywhere else (a test fixture, a future cache) should not
  // have to also get the ordering right for reorder's up/down buttons to
  // land on the correct neighbour.
  const sortKey = toCamel(config.defaultSort);
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a[sortKey] ?? 0) - (b[sortKey] ?? 0)),
    [items, sortKey],
  );

  function handleDelete(item) {
    const name = primaryLabel(item, config);
    // A mis-click here can destroy a published wedding — this confirmation
    // is not decoration. Declining must do nothing at all: no callback, no
    // side effect, not even an optimistic anything.
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    onDelete?.(item.id);
  }

  function handleMove(index, direction) {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    onReorder?.(reordered.map((item) => item.id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs uppercase tracking-widest text-charcoal-500 font-bold">{label}</h2>
        <button
          type="button"
          onClick={() => onCreate?.()}
          className="px-4 py-2 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors"
        >
          Add New
        </button>
      </div>

      {status === 'error' && (
        <div role="alert" className="p-10 text-center border border-pitch-900/15 rounded-2xl bg-offwhite-50">
          <p className="text-sm font-semibold text-pitch-900 mb-4">
            Could not load {singularLabel}{error?.message ? `: ${error.message}` : '.'}
          </p>
          {/* A broken load must never be visually mistaken for "nothing
              published yet" — the studio needs to be able to tell its own
              site is actually empty apart from this screen having failed. */}
          <button
            type="button"
            onClick={() => onRetry?.()}
            className="px-6 py-2.5 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {status !== 'error' && status === 'loading' && items.length === 0 && (
        <p className="p-10 text-center text-sm text-charcoal-700">Loading {singularLabel}…</p>
      )}

      {status !== 'error' && !(status === 'loading' && items.length === 0) && sorted.length === 0 && (
        <p className="p-10 text-center text-sm text-charcoal-700 border border-pitch-900/10 rounded-2xl">
          No {singularLabel} yet.
        </p>
      )}

      {status !== 'error' && !(status === 'loading' && items.length === 0) && sorted.length > 0 && (
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="border-b border-pitch-900/15 text-[10px] uppercase tracking-widest text-charcoal-500">
              {config.listColumns.map((column) => (
                <th key={column.name} scope="col" className="py-3 pr-4 font-bold">{column.label}</th>
              ))}
              <th scope="col" className="py-3 pr-4 font-bold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, index) => {
              const name = primaryLabel(item, config);
              return (
                <tr key={item.id} className="border-b border-pitch-900/10">
                  {config.listColumns.map((column) => (
                    <td key={column.name} className="py-3 pr-4 text-charcoal-700">
                      {column.name === 'status'
                        ? <StatusToggle item={item} onToggleStatus={onToggleStatus} />
                        : renderCell(item, column, config)}
                    </td>
                  ))}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        aria-label={`Move up: ${name}`}
                        className="px-2 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-xs hover:bg-offwhite-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === sorted.length - 1}
                        aria-label={`Move down: ${name}`}
                        className="px-2 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-xs hover:bg-offwhite-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit?.(item)}
                        className="px-3 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="px-3 py-1.5 rounded-lg border border-pitch-900/20 text-pitch-900 text-[10px] uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
