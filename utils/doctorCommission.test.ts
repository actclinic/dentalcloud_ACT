import { describe, expect, it } from 'vitest';

import { calculateDoctorEarnings, usesFlatVisitCommission } from './doctorCommission';

describe('doctor commission', () => {
  it('uses flat per-visit commission only for Ortho, Implant, and Surgery', () => {
    expect(usesFlatVisitCommission('Ortho')).toBe(true);
    expect(calculateDoctorEarnings({ collectedPayment: 1000, specialization: 'Ortho', commissionPercentage: 50, commissionPerVisit: 120 })).toBe(120);
    expect(calculateDoctorEarnings({ collectedPayment: 1000, specialization: 'General', commissionPercentage: 50, commissionPerVisit: 120 })).toBe(500);
  });

  it('uses collected payment minus material cost as the percentage commission base', () => {
    expect(calculateDoctorEarnings({
      collectedPayment: 200_000,
      materialCost: 20_000,
      specialization: 'General',
      commissionPercentage: 10
    })).toBe(18_000);
  });

  it('does not pay flat per-visit commission before payment is collected', () => {
    expect(calculateDoctorEarnings({
      collectedPayment: 0,
      specialization: 'Surgery',
      commissionPerVisit: 15_000
    })).toBe(0);
  });
});
