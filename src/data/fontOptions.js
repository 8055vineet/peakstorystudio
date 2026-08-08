// FALLBACK + CHOICES for the admin font control (Phase 3g; quote role added
// Phase 3j). Pure data: the public site applies these via CSS variables and
// the admin renders them in selects. `value` is the exact CSS family name
// stored in site_settings and set on --font-heading / --font-body /
// --font-quote; the generic fallback (serif / sans-serif) is supplied by
// tailwind.config.js's font-family stacks. Every family here is loaded in
// index.html.
export const HEADING_FONTS = [
  { value: 'Cormorant Garamond', label: 'Cormorant Garamond' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'EB Garamond', label: 'EB Garamond' },
  { value: 'Libre Baskerville', label: 'Libre Baskerville' },
  { value: 'Marcellus', label: 'Marcellus' },
  { value: 'Cinzel', label: 'Cinzel' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'Josefin Sans', label: 'Josefin Sans' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Raleway', label: 'Raleway' },
  { value: 'Quicksand', label: 'Quicksand' },
];

export const BODY_FONTS = [
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Work Sans', label: 'Work Sans' },
  { value: 'Nunito Sans', label: 'Nunito Sans' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Raleway', label: 'Raleway' },
  { value: 'Quicksand', label: 'Quicksand' },
  { value: 'Josefin Sans', label: 'Josefin Sans' },
  { value: 'Merriweather', label: 'Merriweather' },
];

// The Home quote can be a script, an elegant serif, a display face, or a
// clean sans — a curated spread, defaulting to Quicksand (Phase 3j).
export const QUOTE_FONTS = [
  { value: 'Quicksand', label: 'Quicksand' },
  { value: 'Cinzel', label: 'Cinzel' },
  { value: 'Dancing Script', label: 'Dancing Script' },
  { value: 'EB Garamond', label: 'EB Garamond' },
  { value: 'Cormorant Garamond', label: 'Cormorant Garamond' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Marcellus', label: 'Marcellus' },
  { value: 'Josefin Sans', label: 'Josefin Sans' },
];

export const DEFAULT_HEADING_FONT = 'Cormorant Garamond';
export const DEFAULT_BODY_FONT = 'Plus Jakarta Sans';
export const DEFAULT_QUOTE_FONT = 'Quicksand';

export function isKnownFont(value, role) {
  const list = role === 'heading' ? HEADING_FONTS
    : role === 'quote' ? QUOTE_FONTS
      : BODY_FONTS;
  return list.some((font) => font.value === value);
}
