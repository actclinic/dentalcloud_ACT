import { describe, expect, it } from 'vitest';
import type { MedicineSale } from '../types';
import { formatMedicineQuantity, getPatientMedicineHistory } from './medicineHistory';

const sale = (overrides: Partial<MedicineSale>): MedicineSale => ({
  id: 'sale-1',
  location_id: 'location-1',
  patient_id: 'patient-1',
  medicine_id: 'medicine-1',
  medicine_name: 'Amoxicillin 500mg',
  medicine_unit: 'capsules',
  quantity: 1,
  unit_price: 500,
  total_price: 500,
  date: '2026-07-17',
  ...overrides
});

describe('medicine history helpers', () => {
  it('keeps only the selected patient records and sorts newest first', () => {
    const result = getPatientMedicineHistory([
      sale({ id: 'older', date: '2026-06-01' }),
      sale({ id: 'other-patient', patient_id: 'patient-2', date: '2026-07-20' }),
      sale({ id: 'newer', date: '2026-07-17' })
    ], 'patient-1');

    expect(result.map((item) => item.id)).toEqual(['newer', 'older']);
  });

  it('uses dispense time to order records created on the same day', () => {
    const result = getPatientMedicineHistory([
      sale({ id: 'morning', created_at: '2026-07-17T08:00:00Z' }),
      sale({ id: 'afternoon', created_at: '2026-07-17T14:00:00Z' })
    ], 'patient-1');

    expect(result.map((item) => item.id)).toEqual(['afternoon', 'morning']);
  });

  it('formats whole and decimal dispense quantities without trailing zeroes', () => {
    expect(formatMedicineQuantity(2, 'tablets')).toBe('2 tablets');
    expect(formatMedicineQuantity(1.5, 'cards')).toBe('1.5 cards');
  });

  it('still formats historical records when inventory unit metadata is unavailable', () => {
    expect(formatMedicineQuantity(3, undefined)).toBe('3');
  });
});