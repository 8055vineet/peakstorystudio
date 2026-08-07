import { describe, it, expect } from 'vitest';
import {
  validateInquiry,
  SERVICES,
  FIELD_LIMITS,
} from '../inquiry-validation.js';

const TODAY = '2026-07-31';

function valid(overrides = {}) {
  return {
    name: 'Ananya & Rohan',
    email: 'couple@example.com',
    phone: '+91 98200 00000',
    weddingDate: '2027-02-14',
    venue: 'Umaid Bhawan Palace, Jodhpur',
    services: ['Cinematic Film'],
    message: 'Three days, two venues.',
    ...overrides,
  };
}

describe('validateInquiry', () => {
  it('accepts a complete inquiry and returns trimmed values', () => {
    const result = validateInquiry(valid({ name: '  Ananya & Rohan  ' }), { today: TODAY });
    expect(result.valid).toBe(true);
    expect(result.fields).toEqual({});
    expect(result.value.name).toBe('Ananya & Rohan');
    expect(result.value.services).toEqual(['Cinematic Film']);
  });

  it('rejects a non-object payload without throwing', () => {
    const result = validateInquiry(null, { today: TODAY });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.fields).length).toBeGreaterThan(0);
  });

  it.each([
    ['name', ''],
    ['name', 'A'],
    ['email', ''],
    ['email', 'not-an-email'],
    ['email', 'missing@domain'],
    ['phone', ''],
    ['phone', 'call me'],
    ['venue', ''],
    ['weddingDate', ''],
    ['weddingDate', '14-02-2027'],
    ['weddingDate', '2027-02-30'],
  ])('rejects %s = %j', (field, value) => {
    const result = validateInquiry(valid({ [field]: value }), { today: TODAY });
    expect(result.valid).toBe(false);
    expect(result.fields[field]).toBeTruthy();
  });

  it('rejects a wedding date in the past', () => {
    const result = validateInquiry(valid({ weddingDate: '2026-07-30' }), { today: TODAY });
    expect(result.fields.weddingDate).toBeTruthy();
  });

  it('accepts a wedding date of today', () => {
    const result = validateInquiry(valid({ weddingDate: TODAY }), { today: TODAY });
    expect(result.valid).toBe(true);
  });

  it('rejects a wedding date more than five years ahead', () => {
    const result = validateInquiry(valid({ weddingDate: '2032-07-31' }), { today: TODAY });
    expect(result.fields.weddingDate).toBeTruthy();
  });

  it('skips date range checks when today is not supplied', () => {
    const result = validateInquiry(valid({ weddingDate: '1999-01-01' }));
    expect(result.valid).toBe(true);
  });

  it.each([
    ['name', FIELD_LIMITS.name],
    ['venue', FIELD_LIMITS.venue],
    ['message', FIELD_LIMITS.message],
  ])('rejects %s longer than its limit', (field, limit) => {
    const result = validateInquiry(valid({ [field]: 'x'.repeat(limit + 1) }), { today: TODAY });
    expect(result.fields[field]).toBeTruthy();
  });

  it('accepts services beyond the built-in list — the list is admin-managed now', () => {
    const result = validateInquiry(valid({ services: ['Skywriting'] }), { today: TODAY });
    expect(result.fields.services).toBeUndefined();
    expect(result.value.services).toEqual(['Skywriting']);
  });

  it('keeps submitted order and drops duplicates', () => {
    const result = validateInquiry(valid({ services: ['Drone Aerials', 'Cinematic Film', 'Drone Aerials'] }), { today: TODAY });
    expect(result.value.services).toEqual(['Drone Aerials', 'Cinematic Film']);
  });

  it('rejects more than 12 services', () => {
    const many = Array.from({ length: 13 }, (_, i) => `Service ${i}`);
    const result = validateInquiry(valid({ services: many }), { today: TODAY });
    expect(result.fields.services).toBeTruthy();
  });

  it('rejects a service over 80 characters or empty after cleaning', () => {
    expect(validateInquiry(valid({ services: ['x'.repeat(81)] }), { today: TODAY }).fields.services).toBeTruthy();
    expect(validateInquiry(valid({ services: ['   '] }), { today: TODAY }).fields.services).toBeTruthy();
  });

  it('rejects services that is not an array', () => {
    const result = validateInquiry(valid({ services: 'Cinematic Film' }), { today: TODAY });
    expect(result.fields.services).toBeTruthy();
  });

  it('accepts every offered service at once and de-duplicates', () => {
    const result = validateInquiry(
      valid({ services: [...SERVICES, SERVICES[0]] }),
      { today: TODAY },
    );
    expect(result.valid).toBe(true);
    expect(result.value.services).toEqual(SERVICES);
  });

  it('treats services and message as optional', () => {
    const result = validateInquiry(
      valid({ services: undefined, message: undefined }),
      { today: TODAY },
    );
    expect(result.valid).toBe(true);
    expect(result.value.services).toEqual([]);
    expect(result.value.message).toBeNull();
  });

  it('strips a null byte from a text field instead of failing', () => {
    const withNullByte = `Ma${String.fromCharCode(0)}llory`;
    const result = validateInquiry(valid({ name: withNullByte }), { today: TODAY });
    expect(result.valid).toBe(true);
    expect(result.value.name).toBe('Mallory');
  });

  it('strips other C0 control characters (e.g. DEL) from a text field', () => {
    const withDel = `Ma${String.fromCharCode(0x7f)}llory`;
    const result = validateInquiry(valid({ venue: withDel }), { today: TODAY });
    expect(result.valid).toBe(true);
    expect(result.value.venue).toBe('Mallory');
  });

  it('keeps a newline and tab inside message intact', () => {
    const message = 'Day one:\n\tceremony at dawn.';
    const result = validateInquiry(valid({ message }), { today: TODAY });
    expect(result.valid).toBe(true);
    expect(result.value.message).toBe(message);
  });
});
