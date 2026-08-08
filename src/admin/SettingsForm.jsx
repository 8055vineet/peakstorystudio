import { useId, useState } from 'react';
import MediaSlot from './MediaSlot.jsx';
import { HEADING_FONTS, BODY_FONTS } from '../data/fontOptions';

// The Settings tab's form: the site's singular content — quote, Brand
// Story, the three Home images, contact and social details — as one
// controlled form over the camelCase settings row (see
// src/lib/queries/adminSettings.js). Presentational: data arrives via
// `initial`/`media`, writes leave via `onSave(values)`; the dashboard in
// App.jsx owns every fetch and the save lifecycle.

const LABEL_CLASS = 'block text-[10px] uppercase tracking-widest text-charcoal-500 font-bold mb-1.5';
const INPUT_CLASS = 'w-full rounded-lg border border-pitch-900/20 bg-offwhite-50 px-3 py-2 text-sm text-pitch-900 focus:outline-none focus:border-pitch-900';
const SECTION_CLASS = 'border border-pitch-900/10 rounded-2xl bg-offwhite-50 p-6 space-y-5';

// Same permissive address rule the inquiry validator uses — the email is
// confirmed by mail actually arriving, not by a regex.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DIGITS_PATTERN = /^\d*$/;
const URL_PATTERN = /^https?:\/\//i;

const REQUIRED = [
  ['quoteText', 'Please keep a quote — the Home page opens with it.'],
  ['quoteCredit', 'Please credit the quote.'],
  ['brandStoryHeading', 'Please keep a heading.'],
  ['brandStoryP1', 'The Brand Story needs its first paragraph.'],
  ['brandStoryP2', 'The Brand Story needs its second paragraph.'],
  ['studioAddress', 'Visitors need the studio address.'],
  ['studioEmail', 'Visitors need an email address.'],
  ['studioPhone', 'Visitors need a phone number.'],
];

function validate(values) {
  const errors = {};
  REQUIRED.forEach(([field, message]) => {
    if (!String(values[field] ?? '').trim()) errors[field] = message;
  });
  if (!errors.studioEmail && !EMAIL_PATTERN.test(values.studioEmail.trim())) {
    errors.studioEmail = 'That email address does not look right.';
  }
  if (!DIGITS_PATTERN.test(values.whatsappNumber ?? '')) {
    errors.whatsappNumber = 'Digits only, country code first — or leave it empty.';
  }
  ['instagramUrl', 'youtubeUrl'].forEach((field) => {
    const value = String(values[field] ?? '').trim();
    if (value && !URL_PATTERN.test(value)) {
      errors[field] = 'Must start with http:// or https:// — or stay empty.';
    }
  });
  return errors;
}

const IMAGE_SLOTS = [
  { key: 'heroMediaId', label: 'Hero image', help: 'The full-width photograph the Home page opens with.' },
  { key: 'brandStoryMediaId', label: 'Brand Story portrait', help: 'Shown beside the Brand Story text on Home and About.' },
  { key: 'closingMediaId', label: 'Closing image', help: 'The full-width photograph that ends the Home page.' },
  { key: 'logoMediaId', label: 'Logo', help: 'Shown as a circular badge in the navbar. A square image works best.' },
];

function Field({ id, label, error, children, help }) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>{label}</label>
      {children}
      {help && <p className="mt-1 text-xs text-charcoal-500">{help}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-semibold text-pitch-900">{error}</p>}
    </div>
  );
}

export default function SettingsForm({
  initial, media, mediaStatus, mediaError, onRetryMedia, onUploaded,
  onSave, pending, error, saved,
}) {
  const uid = useId();
  const [values, setValues] = useState(() => ({ ...initial }));
  const [errors, setErrors] = useState({});

  const set = (field, value) => setValues((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave(values);
  };

  const text = (field, label, { textarea = false, help } = {}) => {
    const id = `${uid}-${field}`;
    const shared = {
      id,
      value: values[field] ?? '',
      onChange: (e) => set(field, e.target.value),
      className: INPUT_CLASS,
      'aria-invalid': errors[field] ? true : undefined,
    };
    return (
      <Field id={id} label={label} error={errors[field]} help={help}>
        {textarea ? <textarea rows={3} {...shared} /> : <input type="text" {...shared} />}
      </Field>
    );
  };

  const fontSelect = (field, label, options) => {
    const id = `${uid}-${field}`;
    return (
      <Field id={id} label={label} error={errors[field]}>
        <select
          id={id}
          value={values[field] ?? ''}
          onChange={(e) => set(field, e.target.value)}
          className={INPUT_CLASS}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>{opt.label}</option>
          ))}
        </select>
      </Field>
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8 max-w-3xl">
      <section className={SECTION_CLASS}>
        <h2 className="font-cinzel text-lg font-bold text-pitch-900">Home Content</h2>
        {text('quoteText', 'Quote', { textarea: true })}
        {text('quoteCredit', 'Quote credit')}
        {text('brandStoryHeading', 'Brand Story heading')}
        {text('brandStoryP1', 'Brand Story — first paragraph', { textarea: true })}
        {text('brandStoryP2', 'Brand Story — second paragraph', { textarea: true })}

        {/* Every slot is optional by design: all three media columns are
            nullable, and src/lib/queries/siteSettings.js falls back to the
            shipped static image on null — which is why each keeps Remove. */}
        {IMAGE_SLOTS.map(({ key, label, help }) => (
          <MediaSlot
            key={key}
            label={label}
            help={help}
            required={false}
            value={values[key] ?? null}
            media={media}
            mediaStatus={mediaStatus}
            mediaError={mediaError}
            onRetryMedia={onRetryMedia}
            onUploaded={onUploaded}
            onChange={(next) => set(key, next)}
          />
        ))}
      </section>

      <section className={SECTION_CLASS}>
        <h2 className="font-cinzel text-lg font-bold text-pitch-900">Typography</h2>
        <p className="text-xs text-charcoal-500">
          The fonts the public site uses for headings and body text.
        </p>
        {fontSelect('headingFont', 'Heading font', HEADING_FONTS)}
        {fontSelect('bodyFont', 'Body font', BODY_FONTS)}
      </section>

      <section className={SECTION_CLASS}>
        <h2 className="font-cinzel text-lg font-bold text-pitch-900">Contact &amp; Social</h2>
        {text('studioAddress', 'Studio address')}
        {text('studioEmail', 'Email address')}
        {text('studioPhone', 'Phone number')}
        {text('whatsappNumber', 'WhatsApp number', { help: 'Digits only, country code first (e.g. 918881621021). Empty hides the WhatsApp button.' })}
        {text('instagramUrl', 'Instagram URL', { help: 'Empty keeps the footer icon unlinked.' })}
        {text('youtubeUrl', 'YouTube URL', { help: 'Empty keeps the footer icon unlinked.' })}
      </section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <p role="status" className="text-xs font-semibold text-pitch-900">Saved — the site shows this now.</p>}
        {error && <p role="alert" className="text-xs font-semibold text-pitch-900">Could not save: {error.message}</p>}
      </div>
    </form>
  );
}
