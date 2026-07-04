import type { ReceiptPreferences } from '../types';

export const DEFAULT_RECEIPT_PREFERENCES: ReceiptPreferences = {
  headerTitle: '',
  currency: 'USD',
  receiptSize: 'A4'
};

export const normalizeReceiptPreferences = (row: any): ReceiptPreferences => ({
  headerTitle: typeof row?.receipt_header_title === 'string' ? row.receipt_header_title.trim() : '',
  currency: row?.currency_unit === 'MMK' ? 'MMK' : 'USD',
  receiptSize: row?.receipt_size === 'THERMAL_80MM'
    ? 'THERMAL_80MM'
    : row?.receipt_size === 'THERMAL_55MM'
      ? 'THERMAL_55MM'
      : 'A4'
});

export const resolveReceiptHeaderTitle = (headerTitle: string | null | undefined, appName: string): string =>
  headerTitle?.trim() || appName;
