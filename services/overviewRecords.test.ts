import { describe, expect, it, vi } from 'vitest';
import type { ClinicalRecord, DoctorEarningEntry } from '../types';
import { loadOverviewRecords, type OverviewRecordsSource } from './overviewRecords';

const record = (id: string, date: string): ClinicalRecord => ({
  id,
  location_id: 'branch-1',
  patient_id: 'patient-1',
  doctor_id: 'doctor-1',
  teeth: [],
  description: 'Treatment',
  cost: 100,
  date
});

const entry = (treatmentId: string, paymentDate: string): DoctorEarningEntry => ({
  paymentId: `payment-${treatmentId}`,
  treatmentId,
  doctorId: 'doctor-1',
  paymentDate,
  treatmentDate: '2026-01-01',
  calculationMode: 'percentage',
  allocatedPayment: 100,
  commissionRate: 10,
  earnings: 10
});

const source = (rangeRows: ClinicalRecord[], entries: DoctorEarningEntry[], olderRows: ClinicalRecord[]): OverviewRecordsSource => ({
  loadTreatmentsInRange: vi.fn().mockResolvedValue(rangeRows),
  loadCommissionEntriesInRange: vi.fn().mockResolvedValue(entries),
  loadTreatmentsByIds: vi.fn().mockResolvedValue(olderRows)
});

describe('loadOverviewRecords', () => {
  it('unions clinical-date treatments with older treatments paid in the range', async () => {
    const current = record('current', '2026-11-16');
    const older = record('older', '2026-01-01');
    const result = await loadOverviewRecords(
      source([current], [entry('older', '2026-11-16')], [older]),
      'branch-1',
      { dateFrom: '2026-11-16', dateTo: '2026-11-16' }
    );
    expect(result.map((row) => row.id).sort()).toEqual(['current', 'older']);
    expect(result.find((row) => row.id === 'older')?.doctorEarningEntries).toHaveLength(1);
  });

  it('rejects invalid ranges and rows from another branch', async () => {
    await expect(loadOverviewRecords(source([], [], []), 'branch-1', {
      dateFrom: '2026-11-17', dateTo: '2026-11-16'
    })).rejects.toThrow('valid overview date range');

    await expect(loadOverviewRecords(source([{ ...record('wrong', '2026-11-16'), location_id: 'branch-2' }], [], []), 'branch-1', {
      dateFrom: '2026-11-16', dateTo: '2026-11-16'
    })).rejects.toThrow('outside the requested branch');
  });

  it('fails instead of publishing partial commission totals when an older treatment is missing', async () => {
    await expect(loadOverviewRecords(
      source([], [entry('missing', '2026-11-16')], []),
      'branch-1',
      { dateFrom: '2026-11-16', dateTo: '2026-11-16' }
    )).rejects.toThrow('could not be loaded');
  });
});
