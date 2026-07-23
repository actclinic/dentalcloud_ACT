import { describe, expect, it } from 'vitest';
import type { ClinicalRecord } from '../types';
import { buildTreatmentAnalysis } from './treatmentAnalytics';

const treatment = (overrides: Partial<ClinicalRecord>): ClinicalRecord => ({
  id: overrides.id || 'record-1',
  location_id: 'location-1',
  patient_id: overrides.patient_id || 'patient-1',
  teeth: [],
  description: 'Filling',
  cost: 0,
  date: '2026-07-20',
  ...overrides
});

describe('treatment analytics', () => {
  it('counts every performance and calculates patient, production, pricing, doctor, and tooth metrics', () => {
    const result = buildTreatmentAnalysis([
      treatment({ id: '1', treatment_type_id: 'filling', patient_id: 'p1', doctor_id: 'd1', doctor_name: 'Dr A', cost: 100, standardCost: 120, discountAmount: 20, pricingNote: 'DISCOUNT', teeth: [11, 11, 12] }),
      treatment({ id: '2', treatment_type_id: 'filling', patient_id: 'p1', doctor_id: 'd2', doctor_name: 'Dr B', cost: 0, standardCost: 100, discountAmount: 100, pricingNote: 'FOC', teeth: [11] }),
      treatment({ id: '3', treatment_type_id: 'crown', description: 'Crown', patient_id: 'p2', doctor_id: 'd1', doctor_name: 'Dr A', cost: 300, date: '2026-07-21' })
    ]);

    expect(result.totalTreatments).toBe(3);
    expect(result.uniquePatients).toBe(2);
    expect(result.repeatPatients).toBe(1);
    expect(result.production).toBe(400);
    expect(result.averageValue).toBeCloseTo(133.33, 1);
    expect(result.discountTotal).toBe(20);
    expect(result.discountedCount).toBe(1);
    expect(result.focCount).toBe(1);
    expect(result.rows[0]).toMatchObject({ name: 'Filling', count: 2, uniquePatients: 1, doctorCount: 2, focCount: 1 });
    expect(result.rows[0].share).toBeCloseTo(200 / 3, 10);
    expect(result.doctors[0]).toMatchObject({ name: 'Dr A', count: 2, production: 400 });
    expect(result.teeth).toEqual([{ tooth: '11', count: 2 }, { tooth: '12', count: 1 }]);
  });

  it('does not count unassigned records as doctors while keeping an unassigned chart bucket', () => {
    const result = buildTreatmentAnalysis([
      treatment({ id: '1', doctor_id: 'doctor-1', doctor_name: 'Dr A' }),
      treatment({ id: '2', doctor_id: undefined, doctor_name: undefined })
    ]);

    expect(result.rows[0].doctorCount).toBe(1);
    expect(result.doctors).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Dr A', count: 1 }),
      expect.objectContaining({ name: 'Unassigned', count: 1 })
    ]));
  });

  it('combines matching branch-local services only in all-branches analysis', () => {
    const records = [
      treatment({ id: '1', location_id: 'branch-a', treatment_type_id: 'type-a', description: 'Cleaning', cost: 100 }),
      treatment({ id: '2', location_id: 'branch-b', treatment_type_id: 'type-b', description: ' cleaning ', cost: 200 })
    ];

    expect(buildTreatmentAnalysis(records).rows).toHaveLength(2);
    expect(buildTreatmentAnalysis(records, { combineAcrossLocations: true }).rows).toEqual([
      expect.objectContaining({ name: 'Cleaning', count: 2, production: 300 })
    ]);
  });

  it('uses stable treatment IDs while grouping case and whitespace variants for legacy records', () => {
    const result = buildTreatmentAnalysis([
      treatment({ id: '1', treatment_type_id: 'type-1', description: 'Old Filling Name' }),
      treatment({ id: '2', treatment_type_id: 'type-1', description: 'New Filling Name' }),
      treatment({ id: '3', treatment_type_id: null, description: '  Cleaning  ' }),
      treatment({ id: '4', treatment_type_id: null, description: 'cleaning' })
    ]);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.count)).toEqual([2, 2]);
    expect(result.rows.find((row) => row.key === 'legacy:cleaning')?.count).toBe(2);
  });

  it('handles empty and malformed optional values without returning NaN or throwing', () => {
    const malformed = treatment({
      patient_id: '',
      description: '   ',
      cost: Number.NaN,
      discountAmount: Number.POSITIVE_INFINITY,
      doctor_name: '',
      teeth: undefined as unknown as number[],
      date: 'not-a-date'
    });

    const result = buildTreatmentAnalysis([malformed]);
    expect(result).toMatchObject({ totalTreatments: 1, uniquePatients: 0, production: 0, averageValue: 0, discountTotal: 0 });
    expect(result.rows[0]).toMatchObject({ name: 'Unspecified treatment', count: 1, production: 0, latestDate: '' });
    expect(result.trend).toEqual([]);
    expect(result.teeth).toEqual([]);
  });

  it('returns a complete zero state for no treatments', () => {
    expect(buildTreatmentAnalysis([])).toEqual({
      totalTreatments: 0,
      uniquePatients: 0,
      repeatPatients: 0,
      production: 0,
      averageValue: 0,
      discountTotal: 0,
      discountedCount: 0,
      focCount: 0,
      rows: [],
      trend: [],
      doctors: [],
      teeth: []
    });
  });
});