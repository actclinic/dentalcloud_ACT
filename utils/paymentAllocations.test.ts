import { describe, expect, it } from 'vitest';
import {
  formatPaymentAllocations,
  getPaymentAllocationTotal,
  getPaymentHeaderMethod,
  normalizePaymentAllocations,
  validatePaymentAllocations
} from './paymentMethods';

describe('payment allocations', () => {
  it('normalizes and merges duplicate methods without changing the total', () => {
    const allocations = normalizePaymentAllocations([
      { method: 'cash', amount: 40 },
      { payment_method: 'CASH', amount: 10 },
      { method: 'kpay', amount: 50 }
    ]);
    expect(allocations).toEqual([{ method: 'CASH', amount: 50 }, { method: 'KPAY', amount: 50 }]);
    expect(getPaymentAllocationTotal(allocations)).toBe(100);
    expect(getPaymentHeaderMethod(allocations)).toBe('MIXED');
  });

  it('synthesizes a legacy single-method allocation', () => {
    expect(normalizePaymentAllocations(null, 'CASH', 100)).toEqual([{ method: 'CASH', amount: 100 }]);
  });

  it('requires valid unique allocations that exactly match the payment', () => {
    expect(validatePaymentAllocations([{ method: 'CASH', amount: 40 }, { method: 'KPAY', amount: 60 }], 100)).toBeNull();
    expect(validatePaymentAllocations([{ method: 'CASH', amount: 40 }], 100)).toMatch(/exactly equal/);
    expect(validatePaymentAllocations([{ method: 'CASH', amount: 50 }, { method: 'CASH', amount: 50 }], 100)).toMatch(/only be used once/);
    expect(validatePaymentAllocations([{ method: 'MIXED', amount: 100 }], 100)).toMatch(/valid payment method/);
  });

  it('formats a concise tender breakdown', () => {
    expect(formatPaymentAllocations([{ method: 'CASH', amount: 40 }, { method: 'KPAY', amount: 60 }])).toBe('Cash 40 + KPay 60');
  });
});