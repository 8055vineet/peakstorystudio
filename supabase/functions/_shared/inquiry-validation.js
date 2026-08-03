// The one definition of a valid booking inquiry.
//
// Imported by the submit-inquiry Edge Function (relatively) and by the browser
// (through the @shared Vite alias). Two copies of these rules would drift, and
// drift here means showing a couple an inline message the server contradicts.
// Keep this file free of Deno and browser globals so both runtimes can load it.

// The honeypot's field name. It lives here because the form and the Edge
// Function must agree on it exactly, and a second copy would drift.
//
// Deliberately NOT `website`, `url`, `company`, or anything else a browser or
// password manager recognises. That is not a style preference. The field was
// called `website`; on this site's first contact with a real visitor their
// password manager autofilled it, the server classified them as a bot, and a
// genuine booking inquiry was discarded while the couple was shown "Inquiry
// Received". Any semantically meaningful name here is a name autofill may
// decide it knows how to complete.
export const HONEYPOT_FIELD = 'preferred_contact_window';

export const SERVICES = [
  'Cinematic Film',
  'Fine Art Photography',
  'Drone Aerials',
  'Pre-Wedding Shoot',
];

export const FIELD_LIMITS = {
  name: 100,
  email: 254,
  phone: 20,
  venue: 200,
  message: 2000,
};

export const MAX_YEARS_AHEAD = 5;

// Deliberately permissive. The address is confirmed by the acknowledgement
// email actually arriving, not by a regex trying to encode RFC 5322.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[+(\d][\d\s()+-]{6,19}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Char codes for the whitespace a multi-line message legitimately uses: tab,
// line feed, carriage return. Everything else at or below 0x1F, plus 0x7F
// (DEL), is a control character with no legitimate reason to appear in any of
// these fields — Postgres `text` cannot even store a null byte. Comparing
// numeric char codes (rather than a regex literal containing escaped or raw
// control characters) keeps this readable and keeps ESLint's no-control-regex
// rule out of the picture entirely.
const ALLOWED_WHITESPACE_CODES = new Set([9, 10, 13]);

function isControlCharCode(code) {
  return (code <= 0x1f && !ALLOWED_WHITESPACE_CODES.has(code)) || code === 0x7f;
}

function stripControlChars(value) {
  let result = '';
  for (const ch of value) {
    if (!isControlCharCode(ch.codePointAt(0))) {
      result += ch;
    }
  }
  return result;
}

function text(value) {
  return typeof value === 'string' ? stripControlChars(value).trim() : '';
}

function isRealIsoDate(value) {
  // Date.parse silently rolls an out-of-range day/month forward (2027-02-30
  // becomes 2027-03-02) instead of producing NaN, so it cannot detect an
  // impossible calendar date on its own. Building the date from its parsed
  // components and reading them back exposes any rollover: a real date's
  // components survive the round trip, a rolled-forward one does not.
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateInquiry(input, { today } = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const fields = {};

  const name = text(source.name);
  if (name.length < 2) {
    fields.name = 'Please tell us who we should address.';
  } else if (name.length > FIELD_LIMITS.name) {
    fields.name = `Please keep this under ${FIELD_LIMITS.name} characters.`;
  }

  const email = text(source.email);
  if (!email) {
    fields.email = 'We need an email address to reply to.';
  } else if (email.length > FIELD_LIMITS.email || !EMAIL_PATTERN.test(email)) {
    fields.email = 'That email address does not look right.';
  }

  const phone = text(source.phone);
  if (!phone) {
    fields.phone = 'We need a phone number.';
  } else if (!PHONE_PATTERN.test(phone)) {
    fields.phone = 'Use digits, spaces, and + ( ) - only.';
  }

  const weddingDate = text(source.weddingDate);
  const reference = isRealIsoDate(text(today)) ? text(today) : null;
  if (!weddingDate) {
    fields.weddingDate = 'Please give us your wedding date.';
  } else if (!isRealIsoDate(weddingDate)) {
    fields.weddingDate = 'Please give a valid date.';
  } else if (reference) {
    // ISO dates compare correctly as strings, which sidesteps every timezone
    // trap in doing this with Date objects.
    const latest = `${Number(reference.slice(0, 4)) + MAX_YEARS_AHEAD}${reference.slice(4)}`;
    if (weddingDate < reference) {
      fields.weddingDate = 'That date has already passed.';
    } else if (weddingDate > latest) {
      fields.weddingDate = `We take bookings up to ${MAX_YEARS_AHEAD} years ahead.`;
    }
  }

  const venue = text(source.venue);
  if (!venue) {
    fields.venue = 'Please tell us where the wedding is.';
  } else if (venue.length > FIELD_LIMITS.venue) {
    fields.venue = `Please keep this under ${FIELD_LIMITS.venue} characters.`;
  }

  let services = [];
  if (source.services === undefined || source.services === null) {
    services = [];
  } else if (!Array.isArray(source.services)) {
    fields.services = 'Please choose from the services offered.';
  } else {
    const chosen = source.services.map(text);
    if (chosen.some((service) => !SERVICES.includes(service))) {
      fields.services = 'Please choose from the services offered.';
    } else {
      services = SERVICES.filter((service) => chosen.includes(service));
    }
  }

  const message = text(source.message);
  if (message.length > FIELD_LIMITS.message) {
    fields.message = `Please keep this under ${FIELD_LIMITS.message} characters.`;
  }

  return {
    valid: Object.keys(fields).length === 0,
    fields,
    value: {
      name,
      email,
      phone,
      weddingDate,
      venue,
      services,
      message: message || null,
    },
  };
}
