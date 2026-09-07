import { DEFAULT_HEADING_FONT, DEFAULT_BODY_FONT, DEFAULT_QUOTE_FONT } from '../data/fontOptions';

// Builds the Google Fonts css2 URL for the families the admin has chosen
// beyond the three shipped defaults (Phase 5). index.html loads only those
// defaults; App.jsx maintains one extra <link id="site-fonts"> from this
// module, so a visitor downloads the eighteen selectable families' CSS only
// when one of them is actually in use. Pure — no DOM — so it is unit-tested
// directly and usable from a build script.

// The axis spec per family, in the css2 API's own syntax. Only weights and
// styles the family actually offers on Google Fonts: the endpoint answers
// HTTP 400 for the WHOLE request when any family names a weight it lacks
// (Marcellus has only 400; Cinzel and Quicksand have no italic), so one
// wrong tuple would silently unload every family in the link. The heading
// role is rendered italic in several places (`font-garamond italic`), so
// families with an italic face get it; the weight range covers the
// utilities the site uses (font-light 300 … font-extrabold 800). Tuples
// must be sorted (upright ascending, then italic ascending) or the API
// rejects the request.
export const FONT_AXES = {
  'Cinzel': 'wght@400;500;600;700;800;900',
  'Cormorant Garamond': 'ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'Dancing Script': 'wght@400;500;600;700',
  'EB Garamond': 'ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800',
  'Inter': 'ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800',
  'Josefin Sans': 'ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'Lato': 'ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900',
  'Libre Baskerville': 'ital,wght@0,400;0,700;1,400',
  'Marcellus': '',
  'Merriweather': 'ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900',
  'Montserrat': 'ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800',
  'Nunito Sans': 'ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800',
  'Playfair Display': 'ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800',
  'Plus Jakarta Sans': 'wght@300;400;500;600;700;800',
  'Poppins': 'ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800',
  'Quicksand': 'wght@300;400;500;600;700',
  'Raleway': 'ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800',
  'Work Sans': 'ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800',
};

const DEFAULT_FAMILIES = [DEFAULT_HEADING_FONT, DEFAULT_BODY_FONT, DEFAULT_QUOTE_FONT];

// One `family=` value: "Playfair+Display:ital,wght@0,400;…". A family with
// no spec (unknown, or single-weight like Marcellus) is requested bare,
// which the API serves as its regular face.
export function familySpec(family) {
  const name = String(family).trim().replace(/\s+/g, '+');
  const axes = FONT_AXES[family];
  return axes ? `${name}:${axes}` : name;
}

// The stylesheet URL for the given families (deduplicated, blanks dropped),
// or '' when there is nothing to load — the caller removes the link then.
export function googleFontsHref(families = []) {
  const unique = [...new Set(families.filter((f) => typeof f === 'string' && f.trim()))];
  if (unique.length === 0) return '';
  const params = unique.map((family) => `family=${familySpec(family)}`);
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}

// The families a settings.fonts object resolves to that index.html does not
// already load, in role order (heading, body, quote), each once.
export function nonDefaultFamilies(fonts) {
  const chosen = [fonts?.heading, fonts?.body, fonts?.quote].filter((f) => typeof f === 'string' && f.trim());
  return [...new Set(chosen)].filter((family) => !DEFAULT_FAMILIES.includes(family));
}
