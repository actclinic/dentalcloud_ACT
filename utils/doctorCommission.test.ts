import { describe, expect, it } from 'vitest';

import { calculateDoctorEarnings, usesFlatVisitCommission } from './doctorCommission';

describe('doctor commission', () => {
  it('uses flat per-visit commission only for Ortho, Implant, and Surgery', () => {
    expect(usesFlatVisitCommission('Ortho')).toBe(true);
    expect(calculateDoctorEarnings({ cost: 1000, specialization: 'Ortho', commissionRate: 50, commissionPerVisit: 120 })).toBe(120);
    expect(calculateDoctorEarnings({ cost: 1000, specialization: 'General', commissionRate: 50, commissionPerVisit: 120 })).toBe(500);
  });
});