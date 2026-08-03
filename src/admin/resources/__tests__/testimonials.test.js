import {
  describe, it, expect, vi,
} from 'vitest';

const mockQueries = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  reorder: vi.fn(),
};
const makeResourceQueries = vi.fn(() => mockQueries);

vi.mock('../../../lib/queries/adminContent', () => ({
  makeResourceQueries: (...args) => makeResourceQueries(...args),
}));

const { testimonialsResource, testimonialsQueries } = await import('../testimonials.js');

describe('testimonialsResource config', () => {
  it('points at the testimonials table, sorted by sort_order', () => {
    expect(testimonialsResource.table).toBe('testimonials');
    expect(testimonialsResource.defaultSort).toBe('sort_order');
    expect(testimonialsResource.key).toBe('testimonials');
  });

  it('is built on makeResourceQueries with its own table and columns', () => {
    expect(makeResourceQueries).toHaveBeenCalledWith('testimonials', testimonialsResource.columns);
  });

  it('never puts status in fields — every resource has it, but ResourceList owns the toggle', () => {
    expect(testimonialsResource.fields.some((f) => f.name === 'status')).toBe(false);
  });

  // CLAUDE.md's content-integrity rule (PS-002): the seeded testimonials table
  // already attributes a quote to real people who never gave it. This help
  // text is what stands between an admin and repeating that mistake — losing
  // it is losing the one guard this form has against it.
  it('requires the quote and warns, in its help text, against attributing it to someone who did not say it', () => {
    const field = testimonialsResource.fields.find((f) => f.name === 'quote');
    expect(field).toBeDefined();
    expect(field.type).toBe('textarea');
    expect(field.required).toBe(true);
    expect(field.help).toMatch(/actually gave|did not say/i);
  });

  it('requires couple, but not event', () => {
    const coupleField = testimonialsResource.fields.find((f) => f.name === 'couple');
    const eventField = testimonialsResource.fields.find((f) => f.name === 'event');
    expect(coupleField.required).toBe(true);
    expect(eventField.required).toBe(false);
  });

  it('lists couple, event, and status — not the quote itself — as the columns an admin sees at a glance', () => {
    expect(testimonialsResource.listColumns.map((c) => c.name)).toEqual(
      expect.arrayContaining(['couple', 'event', 'status']),
    );
    expect(testimonialsResource.listColumns.some((c) => c.name === 'quote')).toBe(false);
  });

  it('requires exactly quote and couple', () => {
    const required = testimonialsResource.fields.filter((f) => f.required).map((f) => f.name);
    expect(required.sort()).toEqual(['couple', 'quote'].sort());
  });
});

describe('testimonialsQueries', () => {
  it('is exactly the base factory\'s queries, unwrapped — testimonials need no create-time derivation the way weddings.slug does', () => {
    expect(testimonialsQueries).toBe(mockQueries);
  });
});
