import { describe, expect, it } from 'vitest';
import { DEFAULT_RECEIPT_PREFERENCES, normalizeReceiptPreferences, resolveReceiptHeaderTitle } from './receiptPreferences';

describe('receipt preferences', () => {
  it('normalizes valid shared settings', () => {
    expect(normalizeReceiptPreferences({
      receipt_header_title: '  My Dentist Receipt  ',
      currency_unit: 'MMK',
      receipt_size: 'THERMAL_55MM'
    })).toEqual({
      headerTitle: 'My Dentist Receipt',
      currency: 'MMK',
      receiptSize: 'THERMAL_55MM'
    });
  });

  it('uses production-safe defaults for invalid database values', () => {
    expect(normalizeReceiptPreferences({
      receipt_header_title: null,
      currency_unit: 'EUR',
      receipt_size: 'LETTER'
    })).toEqual(DEFAULT_RECEIPT_PREFERENCES);
  });

  it('uses the shared title and falls back to the application name when blank', () => {
    expect(resolveReceiptHeaderTitle('  My Dentist Official Receipt  ', 'DentalCloud Pro')).toBe('My Dentist Official Receipt');
    expect(resolveReceiptHeaderTitle('   ', 'DentalCloud Pro')).toBe('DentalCloud Pro');
  });
});
