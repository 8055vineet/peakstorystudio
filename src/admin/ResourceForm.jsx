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
// (carries `options: [{ value, label }]`), or 'media' (renders MediaPicker
// + UploadField from Task 6 and stores a media id).
//
// Like useResource's queries object (see that hook's own module comment)
// and MediaPicker's items, this component derives its editable `values`
// from `initial` exactly once, via useState's lazy initializer, on mount —
// it does not watch `initial` for later identity changes. A caller
// switching which item is being edited (or from editing to creating) must
// remount this component — e.g. `key={initial?.id ?? 'new'}` — the same
// discipline useResource's own module comment asks of a caller switching
// which resource's queries it is handed.
function buildInitialValues(config, initial) {
  const values = {};
  config.fields.forEach((field) => {
    const raw = initial ? initial[field.name] : undefined;
    if (field.type === 'number') {
      values[field.name] = raw === null || raw === undefined ? '' : String(raw);
    } else {
      values[field.name] = raw ?? '';
    }
  });
  return values;
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
  const [values, setValues] = useState(() => buildInitialValues(config, initial));
  const [fieldErrors, setFieldErrors] = useState({});

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
    setValues((prev) => ({ ...prev, [name]: next }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validate(config, values);
    setFieldErrors(nextErrors);
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
