import { describe, expect, it } from 'vitest';
import { enumValue, finiteNumber, strictDateString, strictTimeString, trimOptional, trimRequired } from './validation';

describe('validation helpers', () => {
  it('trims required strings and rejects blank values', () => {
    expect(trimRequired('  Main Clinic  ', 'Name')).toBe('Main Clinic');
    expect(() => trimRequired('   ', 'Name')).toThrow('Name is required.');
  });

  it('normalizes optional strings to null when blank', () => {
    expect(trimOptional('  note  ', 'Note')).toBe('note');
    expect(trimOptional('   ', 'Note')).toBeNull();
    expect(trimOptional(undefined, 'Note')).toBeNull();
  });

  it('validates numeric bounds and integer requirements', () => {
    expect(finiteNumber('10', 'Amount', { min: 0 })).toBe(10);
    expect(() => finiteNumber(Number.NaN, 'Amount')).toThrow('Amount must be a valid number.');
    expect(() => finiteNumber(-1, 'Amount', { min: 0 })).toThrow('Amount must be at least 0.');
    expect(() => finiteNumber(1.5, 'Quantity', { integer: true })).toThrow('Quantity must be a whole number.');
  });

  it('accepts only real YYYY-MM-DD dates', () => {
    expect(strictDateString('2026-07-08', 'Date')).toBe('2026-07-08');
    expect(() => strictDateString('2026-02-30', 'Date')).toThrow('Date must be a real calendar date.');
    expect(() => strictDateString('07/08/2026', 'Date')).toThrow('Date must use YYYY-MM-DD format.');
  });

  it('accepts only valid HH:MM times', () => {
    expect(strictTimeString('09:30', 'Time')).toBe('09:30');
    expect(() => strictTimeString('24:00', 'Time')).toThrow('Time must be a valid time.');
    expect(() => strictTimeString('9:30', 'Time')).toThrow('Time must use HH:MM format.');
  });

  it('validates string enums', () => {
    expect(enumValue('admin', ['admin', 'normal'] as const, 'Role')).toBe('admin');
    expect(() => enumValue('owner', ['admin', 'normal'] as const, 'Role')).toThrow('Role must be one of: admin, normal.');
  });
});