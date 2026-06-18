import { describe, expect, it } from 'vitest';
import { formatPaymentMethod, isSelectablePaymentMethod, normalizePaymentMethod } from './paymentMethods';

describe('payment methods', () => {
  it('normalizes clinic-facing aliases to stored payment methods', () => {
    expect(normalizePaymentMethod('KBZ Pay')).toBe('KPAY');
    expect(normalizePaymentMethod('Wave Pay')).toBe('WAVEPAY');
    expect(normalizePaymentMethod('debit-card')).toBe('DEBIT_CARD');
    expect(normalizePaymentMethod('AYA Pay')).toBe('AYA_PAY');
    expect(normalizePaymentMethod('UABPay')).toBe('UAB_PAY');
  });

  it('keeps unknown legacy values visible but not selectable for new payments', () => {
    expect(normalizePaymentMethod('bank transfer')).toBe('UNKNOWN');
    expect(formatPaymentMethod('UNKNOWN')).toBe('Unknown');
    expect(isSelectablePaymentMethod('UNKNOWN')).toBe(false);
    expect(isSelectablePaymentMethod('MMQR')).toBe(true);
  });
});
