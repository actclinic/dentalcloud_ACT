import { describe, expect, it } from 'vitest';
import type { Appointment, ClinicalRecord } from '../types';
import {
  buildDoctorReportingSummary,
  getThisMonthReportingRange,
  getThisWeekReportingRange,
  getTodayReportingRange,
  isDateInDoctorReportingRange,
  validateDoctorReportingRange
} from './doctorDashboardReporting';

const appointment = (overrides: Partial<Appointment>): Appointment => ({
  id: 'appointment-1', location_id: 'branch-1', patient_id: 'patient-1', doctor_id: 'doctor-1',
  date: '2026-08-10', time: '09:00', type: 'Checkup', status: 'Completed', ...overrides
});

const treatment = (overrides: Partial<ClinicalRecord>): ClinicalRecord => ({
  id: 'treatment-1', location_id: 'branch-1', patient_id: 'patient-1', doctor_id: 'doctor-1',
  teeth: [], description: 'Filling', cost: 100, date: '2026-08-10', ...overrides
});

describe('doctor dashboard reporting', () => {
  it('defaults to the local calendar day', () => {
    expect(getTodayReportingRange(new Date(2026, 7, 10, 23, 30))).toEqual({ startDate: '2026-08-10', endDate: '2026-08-10' });
  });

  it('builds Monday-to-Sunday and full-month presets', () => {
    const now = new Date(2026, 7, 12);
    expect(getThisWeekReportingRange(now)).toEqual({ startDate: '2026-08-10', endDate: '2026-08-16' });
    expect(getThisMonthReportingRange(now)).toEqual({ startDate: '2026-08-01', endDate: '2026-08-31' });
  });

  it('validates complete chronological ranges', () => {
    expect(validateDoctorReportingRange({ startDate: '', endDate: '2026-08-10' })).toMatch(/both/i);
    expect(validateDoctorReportingRange({ startDate: '2026-02-30', endDate: '2026-08-10' })).toMatch(/valid/i);
    expect(validateDoctorReportingRange({ startDate: '2026-08-11', endDate: '2026-08-10' })).toMatch(/after/i);
    expect(validateDoctorReportingRange({ startDate: '2026-08-01', endDate: '2026-08-10' })).toBeNull();
  });

  it('includes both range boundaries', () => {
    const range = { startDate: '2026-08-01', endDate: '2026-08-10' };
    expect(isDateInDoctorReportingRange('2026-08-01', range)).toBe(true);
    expect(isDateInDoctorReportingRange('2026-08-10', range)).toBe(true);
    expect(isDateInDoctorReportingRange('2026-08-11', range)).toBe(false);
  });

  it('summarizes treatments, distinct patients, completed appointments, and production in range', () => {
    const summary = buildDoctorReportingSummary(
      [appointment({ id: 'inside' }), appointment({ id: 'outside', date: '2026-08-11' }), appointment({ id: 'scheduled', status: 'Scheduled' })],
      [treatment({ id: 'one' }), treatment({ id: 'two', patient_id: 'patient-2', location_id: 'branch-2', cost: 250 }), treatment({ id: 'outside', date: '2026-08-11', cost: 999 })],
      { startDate: '2026-08-10', endDate: '2026-08-10' }
    );
    expect(summary.treatedPatientCount).toBe(2);
    expect(summary.treatmentCount).toBe(2);
    expect(summary.completedAppointmentCount).toBe(1);
    expect(summary.production).toBe(350);
  });

  it('filters commission by payment date rather than treatment date', () => {
    const summary = buildDoctorReportingSummary([], [
      treatment({
        date: '2026-07-20',
        doctorEarningEntries: [{ paymentId: 'p-1', treatmentId: 'treatment-1', doctorId: 'doctor-1', paymentDate: '2026-08-10', treatmentDate: '2026-07-20', calculationMode: 'percentage', allocatedPayment: 100, commissionRate: 20, earnings: 20 }]
      }),
      treatment({
        id: 'treatment-2',
        date: '2026-08-10',
        doctorEarningEntries: [{ paymentId: 'p-2', treatmentId: 'treatment-2', doctorId: 'doctor-1', paymentDate: '2026-08-11', treatmentDate: '2026-08-10', calculationMode: 'percentage', allocatedPayment: 100, commissionRate: 20, earnings: 20 }]
      })
    ], { startDate: '2026-08-10', endDate: '2026-08-10' });
    expect(summary.commission).toBe(20);
    expect(summary.legacyCommissionEntryCount).toBe(0);
    expect(summary.commissionEntries.map((entry) => entry.paymentId)).toEqual(['p-1']);
  });

  it('identifies legacy commission that uses treatment date as its fallback date', () => {
    const summary = buildDoctorReportingSummary([], [treatment({
      doctorEarningEntries: [{ paymentId: 'legacy-treatment-1', treatmentId: 'treatment-1', doctorId: 'doctor-1', paymentDate: '2026-08-10', treatmentDate: '2026-08-10', calculationMode: 'percentage', allocatedPayment: 100, commissionRate: 20, earnings: 20 }]
    })], { startDate: '2026-08-10', endDate: '2026-08-10' });
    expect(summary.commission).toBe(20);
    expect(summary.legacyCommissionEntryCount).toBe(1);
  });

  it('returns zero values for a period without data', () => {
    const summary = buildDoctorReportingSummary([], [], { startDate: '2026-08-10', endDate: '2026-08-10' });
    expect(summary).toMatchObject({ treatedPatientCount: 0, completedAppointmentCount: 0, treatmentCount: 0, production: 0, commission: 0 });
  });

  it('does not include operational today and tomorrow appointments outside the reporting range', () => {
    const summary = buildDoctorReportingSummary(
      [appointment({ id: 'today', date: '2026-08-10' }), appointment({ id: 'tomorrow', date: '2026-08-11' })],
      [],
      { startDate: '2026-07-01', endDate: '2026-07-31' }
    );
    expect(summary.appointments).toEqual([]);
    expect(summary.completedAppointmentCount).toBe(0);
  });
});