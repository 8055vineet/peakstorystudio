import {
  useId, useMemo, useState,
} from 'react';
import { useResource } from '../hooks/useResource';
import { listMedia } from '../lib/queries/media';
import MediaPicker from './MediaPicker.jsx';
import UploadField from './UploadField.jsx';

// The create/edit screen every content type in this admin shares. A
// resource config drives it entirely — Tasks 8 and 9 write nothing but one
// of these (see src/admin/resources/testimonials.js in the Task 7 brief for
// the exact shape) and reuse ResourceForm unchanged:
//
//   {
//     key, label, table,
//     columns: [...snake_case Postgres columns...],
//     defaultSort: 'sort_order',
//     listColumns: [{ name, label }],   // consumed by ResourceList, not here
//     fields: [{ name, label, type, required, help?, options? }],
//   }
//
// `status` is deliberately never one of `fields` — every resource has it,
// and ResourceList renders its publish toggle straight off `item.status`
// (see ResourceList.jsx). Keeping it out of `fields` means a form
// submission here can never accidentally revert a published row to draft;
// the only path that changes status is that toggle, via a separate
// `mutate('update', id, { status })` call one level up.
//
// field.type is one of: 'text', 'textarea', 'date', 'number', 'select'
// (carries `options: [{ value, label }]`), 'tags' (a comma-separated text
// input reading and writing a real string[], for a Postgres text[] column
// such as weddings.tags), or 'media' (renders MediaPicker + UploadField
// from Task 6 and stores a media id).
//
// This component derives its editable `values` from `initial` — see
// `initialKey`/the render-time reset below for how it stays correct even if
// a caller reuses one mounted ResourceForm across two different records
// without remounting it (Task 7 review: verified experimentally that
// without this, editing record A then re-rendering with record B left A's
// edited values on screen while `initial` was B — a submission in that
// state would silently overwrite B's row with A's content). Prefer
// `key={initial?.id ?? 'new'}` at the call site regardless — it avoids the
// wasted render this fallback needs — but this component must be correct
// without it.
function buildInitialValues(config, initial) {
  const values = {};
  config.fields.forEach((field) => {
    const raw = initial ? initial[field.name] : undefined;
    if (field.type === 'number') {
      values[field.name] = raw === null || raw === undefined ? '' : String(raw);
    } else if (field.type === 'tags') {
      values[field.name] = Array.isArray(raw) ? raw.join(', ') : '';
    } else {
      values[field.name] = raw ?? '';
    }
  });
  return values;
}

// The key that identifies "which record" ResourceForm is currently editing
// — matches the `key={initial?.id ?? 'new'}` a call site is asked to use,
// so the render-time reset below fires in exactly the cases a remount
// would have covered, and no others (switching between two *unsaved* create
// flows, both with `initial: null`, is not treated as a record change).
//
// Keying on the id alone is a deliberate choice with a consequence worth
// naming: if the SAME record's values change underneath an admin who is
// mid-edit — a background reload landing while they type — their typing is
// kept and the newer server values are not shown until they save or cancel.
// The alternative discards work someone is in the middle of doing, which is
// the worse failure: a stale field they are about to overwrite anyway costs
// nothing, while losing a half-written description costs their afternoon.
// Nothing here writes silently, so the save still goes through the same
// confirm-before-success path as every other mutation.
function initialKey(initial) {
  return initial?.id ?? null;
}

// Splits a typed "a, b, b, c" into ['a', 'b', 'c']: each piece trimmed,
// empty pieces dropped (so a blank field, or a trailing comma, never
// becomes ['']), duplicates removed while keeping first-seen order. A comma
// inside a single tag is not supported — there is no escaping scheme for
// it, and the tags field's help text says so rather than silently
// mangling one.
//
// De-duplication is deliberately case-SENSITIVE: "Beach" and "beach" are
// kept as two tags. These render on the public site, so casing is the
// studio's editorial choice, and silently folding one into the other would
// change published copy on their behalf. The help text says so, because a
// rule the admin cannot see is a rule they will be surprised by.
function parseTags(raw) {
  if (!raw) return [];
  const seen = new Set();
  const tags = [];
  raw.split(',').map((tag) => tag.trim()).filter(Boolean).forEach((tag) => {
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  });
  return tags;
}

function validate(config, values) {
  const fieldErrors = {};
  config.fields.forEach((field) => {
    if (!field.required) return;
    const value = values[field.name];
    const isEmpty = value === undefined || value === null || String(value).trim() === '';
    if (isEmpty) fieldErrors[field.name] = `${field.label} is required.`;
  });
  return fieldErrors;
}

function buildPayload(config, values) {
  const payload = {};
  config.fields.forEach((field) => {
    const raw = values[field.name];
    if (field.type === 'number') {
      payload[field.name] = raw === '' ? null : Number(raw);
    } else if (field.type === 'tags') {
      payload[field.name] = parseTags(raw);
    } else {
      payload[field.name] = raw;
    }
  });
  return payload;
}

const LABEL_CLASS = 'block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-semibold';
const CONTROL_CLASS = 'w-full px-4 py-3 rounded-lg bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900';

// One text/textarea/date/number/select control, wired the way BookingForm
// wires its inputs: htmlFor/id joins the label to the control, and an
// invalid control carries aria-invalid plus aria-describedby pointing at
// its own inline error message.
function Field({
  field, value, error, onChange,
}) {
  const inputId = useId();
  const errorId = useId();
  const describedBy = error ? errorId : undefined;

  let control;
  if (field.type === 'textarea') {
    control = (
      <textarea
        id={inputId}
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={CONTROL_CLASS}
      />
    );
  } else if (field.type === 'select') {
    control = (
      <select
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={CONTROL_CLASS}
      >
        <option value="">Select…</option>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  } else {
    // 'text', 'date', 'number' all render as a single <input>, differing
    // only in `type` — and 'date' never touches the Date constructor
    // anywhere in this file: `value` is whatever ISO string buildInitialValues
    // read straight off `initial`, and onChange stores back e.target.value
    // exactly as the browser hands it over. That is the whole guard against
    // the timezone-shift bug this project has already lost a day to (see
    // src/admin/formatDate.js's own module comment for the fuller story) —
    // there is simply no Date object in this path for a timezone to apply to.
    control = (
      <input
        id={inputId}
        type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={CONTROL_CLASS}
      />
    );
  }

  return (
    <div>
      <label htmlFor={inputId} className={LABEL_CLASS}>
        {field.label}{field.required && ' *'}
      </label>
      {control}
      {field.type === 'tags' && (
        // Fixed, not config-authored: every 'tags' field gets the same
        // explanation, since the parsing rule (split on comma, no escaping)
        // is a property of this component, not something a resource config
        // should have to restate. Comma-inside-a-tag was deliberately not
        // supported — no escaping scheme was worth adding for it — so this
        // says so rather than a tag silently getting split in two.
        <p className="mt-1 text-xs text-charcoal-500">
          Comma-separated — separate each tag with a comma. A tag cannot itself contain a comma.
          Capitalisation is kept as you type it, so “Beach” and “beach” count as two tags.
        </p>
      )}
      {field.help && <p className="mt-1 text-xs text-charcoal-500">{field.help}</p>}
      {error && <p id={errorId} role="alert" className="mt-2 text-xs font-semibold text-pitch-900">{error}</p>}
    </div>
  );
}

// The one field type with no single control to attach a <label> to — it
// embeds two of Task 6's components (an upload control and a picker grid)
// rather than one input. A <fieldset>/<legend> pair is the accessible
// grouping for exactly this shape, native to HTML rather than anything
// bespoke: it gives the group an accessible name without inventing an
// aria-labelledby wiring scheme this is the only field type that would need.
function MediaField({
  field, value, error, onChange, mediaResource,
}) {
  const errorId = useId();
  const {
    items, status, error: loadError, reload,
  } = mediaResource;
  const selected = items.find((item) => item.id === value);

  return (
    <fieldset
      className="border border-pitch-900/10 rounded-xl p-4 space-y-4"
      aria-describedby={error ? errorId : undefined}
    >
      <legend className={LABEL_CLASS}>{field.label}{field.required && ' *'}</legend>
      <p className="text-xs text-charcoal-700">
        {selected
          ? `Selected: ${selected.altText || selected.id}`
          : value
            ? `Selected media id: ${value}`
            : 'No photograph selected yet.'}
      </p>
      {field.help && <p className="text-xs text-charcoal-500">{field.help}</p>}
      <UploadField onUploaded={(media) => { onChange(media.id); reload(); }} />
      <MediaPicker
        items={items}
        status={status}
        error={loadError}
        onRetry={reload}
        onSelect={(media) => onChange(media.id)}
      />
      {error && <p id={errorId} role="alert" className="text-xs font-semibold text-pitch-900">{error}</p>}
    </fieldset>
  );
}

export default function ResourceForm({
  config, initial, onSubmit, onCancel, pending, error,
}) {
  // `values` and `fieldErrors` are bundled with the key of the record they
  // belong to, so the check below can tell "the record being edited
  // changed" apart from "a field on the current record changed" — those
  // must not be handled the same way; only the first should ever discard
  // in-progress edits.
  const [formState, setFormState] = useState(() => ({
    key: initialKey(initial),
    values: buildInitialValues(config, initial),
    fieldErrors: {},
  }));

  // Re-derives `values` (and drops any leftover `fieldErrors`) the moment
  // `initial` identifies a different record than what `formState` was built
  // from — comparing during render and conditionally calling setState is
  // the documented React pattern for state that must reset when a specific
  // prop changes (https://react.dev/learn/you-might-not-need-an-effect
  // #adjusting-some-state-when-a-prop-changes), not a side effect: it does
  // not loop, because the branch is only taken when the keys actually
  // differ, and it resolves before this render commits, so the DOM never
  // shows a frame of record A's stale values under record B's id. This is
  // what keeps ResourceForm correct even when a call site forgets the
  // `key={initial?.id ?? 'new'}` remount this component's own module
  // comment recommends — Task 7 review confirmed experimentally that
  // without it, A's edited values survived a swap to B and would have been
  // submitted under B's id.
  const currentKey = initialKey(initial);
  if (formState.key !== currentKey) {
    setFormState({
      key: currentKey,
      values: buildInitialValues(config, initial),
      fieldErrors: {},
    });
  }
  const { values, fieldErrors } = formState;

  const hasMediaField = config.fields.some((field) => field.type === 'media');
  // A resource with no `media` field must never fetch the media library —
  // memoized so useResource's mount effect (which reloads only when the
  // `list` function it was given changes identity) fetches exactly once,
  // per src/admin/App.jsx's own useMemo(() => ({ list: ... }), []) pattern.
  const mediaQueries = useMemo(
    () => (hasMediaField ? { list: listMedia } : { list: async () => [] }),
    [hasMediaField],
  );
  const mediaResource = useResource(mediaQueries);

  const isEditing = Boolean(initial);

  function handleFieldChange(name, next) {
    setFormState((prev) => ({ ...prev, values: { ...prev.values, [name]: next } }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validate(config, values);
    setFormState((prev) => ({ ...prev, fieldErrors: nextErrors }));
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit?.(buildPayload(config, values));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {config.fields.map((field) => (
        field.type === 'media' ? (
          <MediaField
            key={field.name}
            field={field}
            value={values[field.name]}
            error={fieldErrors[field.name]}
            onChange={(next) => handleFieldChange(field.name, next)}
            mediaResource={mediaResource}
          />
        ) : (
          <Field
            key={field.name}
            field={field}
            value={values[field.name]}
            error={fieldErrors[field.name]}
            onChange={(next) => handleFieldChange(field.name, next)}
          />
        )
      ))}

      {error && (
        <div role="alert" className="p-4 rounded-lg border border-pitch-900/20 bg-offwhite-50">
          <p className="text-xs font-semibold text-pitch-900">{error.message ?? 'Something went wrong. Please try again.'}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-6 py-3 rounded-lg border border-pitch-900/20 text-pitch-900 text-xs uppercase tracking-widest font-semibold hover:bg-offwhite-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
