// FALLBACK + CHOICES for the admin font control (Phase 3g). Pure data: the
// public site applies these via CSS variables and the admin renders them in
// two selects. `value` is the exact CSS family name stored in site_settings
// and set on --font-heading / --font-body; the generic fallback (serif /
// sans-serif) is supplied by tailwind.config.js's font-family stacks.
export const HEADING_FONTS = [
  { value: 'Cormorant Garamond', label: 'Cormorant Garamond' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'EB Garamond', label: 'EB Garamond' },
  { value: 'Libre Baskerville', label: 'Libre Baskerville' },
  { value: 'Marcellus', label: 'Marcellus' },
  { value: 'Cinzel', label: 'Cinzel' },
];

export const BODY_FONTS = [
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Work Sans', label: 'Work Sans' },
  { value: 'Nunito Sans', label: 'Nunito Sans' },
];

export const DEFAULT_HEADING_FONT = 'Cormorant Garamond';
export const DEFAULT_BODY_FONT = 'Plus Jakarta Sans';

export function isKnownFont(value, role) {
  const list = role === 'heading' ? HEADING_FONTS : BODY_FONTS;
  return list.some((font) => font.value === value);
}
