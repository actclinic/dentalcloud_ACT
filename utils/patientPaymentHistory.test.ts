import { describe, expect, it } from 'vitest';
import type { PaymentRecord } from '../types';
import { getPatientPaymentHistory } from './patientPaymentHistory';

const payment = (overrides: Partial<PaymentRecord>): PaymentRecord => ({
  id: 'payment-1', patientId: 'patient-1', amount: 100, date: '2026-08-01',
  type: 'FULL', remainingBalance: 0, paymentMethod: 'CASH', ...overrides
});

describe('patient payment history', () => {
  it('keeps only the selected patient and sorts newest first', () => {
    const result = getPatientPaymentHistory([
      payment({ id: 'older', date: '2026-07-01' }),
      payment({ id: 'other', patientId: 'patient-2', date: '2026-09-01' }),
      payment({ id: 'newer', date: '2026-08-01' })
    ], 'patient-1');
    expect(result.map((item) => item.id)).toEqual(['newer', 'older']);
  });

  it('uses creation time for same-day ordering and preserves receipt snapshots', () => {
    const snapshot = { receiptNumber: 'REC-2' } as PaymentRecord['receiptSnapshot'];
    const result = getPatientPaymentHistory([
      payment({ id: 'morning', createdAt: '2026-08-01T08:00:00Z' }),
      payment({ id: 'afternoon', createdAt: '2026-08-01T14:00:00Z', receiptSnapshot: snapshot })
    ], 'patient-1');
    expect(result.map((item) => item.id)).toEqual(['afternoon', 'morning']);
    expect(result[0].receiptSnapshot).toBe(snapshot);
  });

  it('deduplicates database and local records by patient and receipt number', () => {
    const result = getPatientPaymentHistory([
      payment({ id: 'db', receiptNumber: 'REC-1' }),
      payment({ id: 'local', receiptNumber: 'REC-1' })
    ], 'patient-1');
    expect(result).toHaveLength(1);
  });
});