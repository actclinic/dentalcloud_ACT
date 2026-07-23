import { describe, expect, it } from 'vitest';
import { buildPatientCreatedAt, toLocalDateInputValue } from './patientCreationDate';

describe('patient creation date', () => {
  it('formats local dates for the date input without UTC shifting', () => {
    expect(toLocalDateInputValue(new Date(2026, 6, 17, 23, 30))).toBe('2026-07-17');
  });

  it('builds a stable timestamp for today and past dates', () => {
    expect(buildPatientCreatedAt('2026-07-17', '2026-07-17')).toBe('2026-07-17T12:00:00.000Z');
    expect(buildPatientCreatedAt('2024-02-29', '2026-07-17')).toBe('2024-02-29T12:00:00.000Z');
  });

  it('rejects impossible, future, and unreasonably old dates', () => {
    expect(() => buildPatientCreatedAt('2026-02-30', '2026-07-17')).toThrow('real calendar date');
    expect(() => buildPatientCreatedAt('2026-07-18', '2026-07-17')).toThrow('cannot be in the future');
    expect(() => buildPatientCreatedAt('1899-12-31', '2026-07-17')).toThrow('on or after 1900-01-01');
  });
});