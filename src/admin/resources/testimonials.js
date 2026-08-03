import { makeResourceQueries } from '../../lib/queries/adminContent';

// The simplest of the three Task 9 resources — no media field, no select, just the pattern
// Task 7 built plus one help-text line that carries real weight (see below).
export const testimonialsResource = {
  key: 'testimonials',
  label: 'Testimonials',
  table: 'testimonials',
  columns: ['id', 'quote', 'couple', 'event', 'sort_order', 'status'],
  defaultSort: 'sort_order',
  listColumns: [
    { name: 'couple', label: 'Couple' },
    { name: 'event', label: 'Event' },
    { name: 'status', label: 'Status' },
  ],
  fields: [
    // CLAUDE.md's content-integrity rule (PS-002, docs/KNOWN-ISSUES.md) is a standing rule,
    // not phase-scoped: never attribute a quote to a real person who did not give it. The
    // seeded testimonials table already violates it — a quote attributed to "Deepika &
    // Ranveer," the real names of a real married Bollywood couple, scheduled for removal in
    // Phase 7 — and this admin must not make that mistake easy to repeat in the meantime.
    // This help text is the one line standing between an admin and writing a plausible-sounding
    // quote for a couple who never said it.
    {
      name: 'quote',
      label: 'Quote',
      type: 'textarea',
      required: true,
      help: 'Use only words someone actually gave you. Never attribute a quote to a real person who did not say it.',
    },
    { name: 'couple', label: 'Couple', type: 'text', required: true },
    { name: 'event', label: 'Event', type: 'text', required: false },
    { name: 'sortOrder', label: 'Order', type: 'number', required: false },
  ],
};

export const testimonialsQueries = makeResourceQueries(
  testimonialsResource.table,
  testimonialsResource.columns,
);
