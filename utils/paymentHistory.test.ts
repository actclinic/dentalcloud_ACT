import { describe, expect, it } from 'vitest';
import type { PaymentRecord } from '../types';
import { getPatientPaymentHistory, formatPaymentTime, getPaymentBalanceAfter, getPaymentReceiptNumber, getPaymentReceivedAmount } from './paymentHistory';

const payment = (overrides: Partial<PaymentRecord>): PaymentRecord => ({
  id: 'payment-1', location_id: 'branch-1', patientId: 'patient-1', amount: 500,
  date: '2026-08-01', type: 'PARTIAL', remainingBalance: 1000, ...overrides
});

describe('patient payment history', () => {
  it('filters by patient and sorts newest first', () => {
    const result = getPatientPaymentHistory([
      payment({ id: 'older', date: '2026-07-01' }),
      payment({ id: 'other', patientId: 'patient-2' }),
      payment({ id: 'newer', date: '2026-08-01' })
    ], 'patient-1');
    expect(result.map((item) => item.id)).toEqual(['newer', 'older']);
  });

  it('uses corrected values and receipt metadata', () => {
    const record = payment({ amount: 500, clearedAmount: 450, patientCurrentBalance: 1050,
      receiptSnapshot: { receiptNumber: 'REC-1001' } as PaymentRecord['receiptSnapshot'] });
    expect(getPaymentReceivedAmount(record)).toBe(450);
    expect(getPaymentBalanceAfter(record)).toBe(1050);
    expect(getPaymentReceiptNumber(record)).toBe('REC-1001');
  });

  it('rejects invalid times and malformed financial values', () => {
    expect(formatPaymentTime('not-a-date')).toBeNull();
    const record = payment({ amount: Number.NaN, remainingBalance: Number.NaN });
    expect(getPaymentReceivedAmount(record)).toBe(0);
    expect(getPaymentBalanceAfter(record)).toBe(0);
  });
});
