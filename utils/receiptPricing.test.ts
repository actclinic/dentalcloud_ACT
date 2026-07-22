import { describe, expect, it } from 'vitest';
import { resolveReceiptTreatmentPricing } from './receiptPricing';

describe('resolveReceiptTreatmentPricing', () => {
  it('keeps standard, discount, and final charge mathematically consistent', () => {
    const pricing = resolveReceiptTreatmentPricing({
      cost: 400000,
      standardCost: 500000,
      discountAmount: 100000,
      description: 'Bridge',
      teeth: [11]
    });

    expect(pricing).toMatchObject({ finalCost: 400000, standardCost: 500000, discountAmount: 100000 });
    expect(pricing.standardCost - pricing.discountAmount).toBe(pricing.finalCost);
  });

  it('repairs inconsistent legacy metadata without changing the final charge', () => {
    const pricing = resolveReceiptTreatmentPricing({
      cost: 450000,
      standardCost: 450000,
      discountAmount: 50000,
      description: 'Bridge',
      teeth: [11]
    });

    expect(pricing).toMatchObject({ finalCost: 450000, standardCost: 500000, discountAmount: 50000 });
  });

  it('normalizes invalid amounts and preserves FOC semantics', () => {
    const pricing = resolveReceiptTreatmentPricing({
      cost: Number.NaN,
      standardCost: 100000,
      discountAmount: Number.POSITIVE_INFINITY,
      pricingNote: 'FOC',
      description: 'Consultation',
      teeth: []
    });

    expect(pricing).toEqual({ finalCost: 0, standardCost: 100000, discountAmount: 100000, note: 'FOC' });
  });
});
