import { describe, expect, it } from 'vitest';
import { calculateAppointmentShortcutDate } from './appointmentDateShortcuts';

describe('calculateAppointmentShortcutDate', () => {
  it('adds week shortcuts as exact calendar weeks', () => {
    const baseDate = new Date(2026, 4, 1);

    expect(calculateAppointmentShortcutDate({ unit: 'weeks', amount: 1 }, baseDate)).toBe('2026-05-08');
    expect(calculateAppointmentShortcutDate({ unit: 'weeks', amount: 2 }, baseDate)).toBe('2026-05-15');
  });

  it('adds month shortcuts as calendar months instead of fixed day counts', () => {
    const baseDate = new Date(2026, 4, 1);

    expect(calculateAppointmentShortcutDate({ unit: 'months', amount: 1 }, baseDate)).toBe('2026-06-01');
    expect(calculateAppointmentShortcutDate({ unit: 'months', amount: 6 }, baseDate)).toBe('2026-11-01');
  });

  it('clamps month-end dates to the last valid day in the target month', () => {
    expect(calculateAppointmentShortcutDate({ unit: 'months', amount: 1 }, new Date(2026, 0, 31))).toBe('2026-02-28');
    expect(calculateAppointmentShortcutDate({ unit: 'months', amount: 1 }, new Date(2028, 0, 31))).toBe('2028-02-29');
  });
});