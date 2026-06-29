import { describe, expect, it } from 'vitest';
import type { Appointment, ClinicalRecord, Expense, Patient, PaymentRecord } from '../types';
import {
  buildDailyAppointmentData,
  buildDailyFinancialData,
  buildMonthlyProfitData,
  calculateDashboardRangeSummary,
  countPatientsCreatedInRange
} from './dashboardMath';

const patient = (overrides: Partial<Patient>): Patient => ({
  id: overrides.id || 'patient-1',
  location_id: 'loc-1',
  name: overrides.name || 'Patient',
  email: '',
  phone: '',
  balance: 0,
  loyalty_points: 0,
  ...overrides
});

const treatment = (overrides: Partial<ClinicalRecord>): ClinicalRecord => ({
  id: overrides.id || 'record-1',
  location_id: 'loc-1',
  patient_id: overrides.patient_id || 'patient-1',
  patient_name: overrides.patient_name || 'Patient',
  teeth: [],
  description: overrides.description || 'Filling',
  cost: overrides.cost ?? 0,
  date: overrides.date || '2026-06-10',
  ...overrides
});

const payment = (overrides: Partial<PaymentRecord>): PaymentRecord => ({
  id: overrides.id || 'payment-1',
  location_id: 'loc-1',
  patientId: overrides.patientId || 'patient-1',
  amount: overrides.amount ?? 0,
  date: overrides.date || '2026-06-10',
  type: overrides.type || 'FULL',
  remainingBalance: overrides.remainingBalance ?? 0,
  ...overrides
});

const expense = (overrides: Partial<Expense>): Expense => ({
  id: overrides.id || 'expense-1',
  location_id: 'loc-1',
  description: overrides.description || 'Rent',
  amount: overrides.amount ?? 0,
  category: overrides.category || 'Office',
  date: overrides.date || '2026-06-10',
  ...overrides
});

const appointment = (overrides: Partial<Appointment>): Appointment => ({
  id: overrides.id || 'appointment-1',
  location_id: 'loc-1',
  date: overrides.date || '2026-06-10',
  time: overrides.time || '09:00',
  type: overrides.type || 'Consult',
  status: overrides.status || 'Scheduled',
  ...overrides
});

describe('dashboard math', () => {
  it('keeps production revenue and collections separate to avoid double counting', () => {
    const summary = calculateDashboardRangeSummary({
      filteredTreatmentRecords: [
        treatment({ id: 'r1', cost: 100 }),
        treatment({ id: 'r2', cost: 50 })
      ],
      filteredPaymentRecords: [payment({ amount: 100 })],
      filteredExpenses: [expense({ amount: 40 })],
      filteredAppointments: [appointment({ id: 'a1' }), appointment({ id: 'a2' })],
      patients: [
        patient({ id: 'p1', created_at: '2026-06-10T08:00:00Z' }),
        patient({ id: 'p2', created_at: '2026-06-12T08:00:00Z' })
      ],
      dateFrom: '2026-06-10',
      dateTo: '2026-06-11',
      rangeDates: ['2026-06-10', '2026-06-11']
    });

    expect(summary.treatmentRevenue).toBe(150);
    expect(summary.collectedPayments).toBe(100);
    expect(summary.revenue).toBe(150);
    expect(summary.profit).toBe(110);
    expect(summary.avgDailyRevenue).toBe(75);
    expect(summary.appointments).toBe(2);
    expect(summary.newPatients).toBe(1);
  });

  it('builds daily financial data with production, collections, expenses, and profit as separate metrics', () => {
    const daily = buildDailyFinancialData({
      chartDates: ['2026-06-10', '2026-06-11'],
      filteredTreatmentRecords: [
        treatment({ id: 'r1', date: '2026-06-10', cost: 100 }),
        treatment({ id: 'r2', date: '2026-06-11', cost: 80 })
      ],
      filteredPaymentRecords: [payment({ date: '2026-06-10', amount: 100 })],
      filteredExpenses: [expense({ date: '2026-06-10', amount: 30 })],
      formatDateLabel: (date) => date
    });

    expect(daily).toEqual([
      {
        name: '2026-06-10',
        revenue: 100,
        collections: 100,
        expenses: 30,
        profit: 70,
        date: '2026-06-10'
      },
      {
        name: '2026-06-11',
        revenue: 80,
        collections: 0,
        expenses: 0,
        profit: 80,
        date: '2026-06-11'
      }
    ]);
  });

  it('builds daily appointment data without adding collections to production', () => {
    const daily = buildDailyAppointmentData({
      chartDates: ['2026-06-10'],
      filteredTreatmentRecords: [treatment({ date: '2026-06-10', cost: 120 })],
      filteredPaymentRecords: [payment({ date: '2026-06-10', amount: 120 })],
      filteredAppointments: [appointment({ date: '2026-06-10' }), appointment({ id: 'a2', date: '2026-06-10' })],
      formatDateLabel: (date) => date
    });

    expect(daily[0]).toEqual({
      name: '2026-06-10',
      revenue: 120,
      collections: 120,
      appointments: 2,
      date: '2026-06-10'
    });
  });

  it('counts new patients only inside the selected date range, not the entire month', () => {
    const patients = [
      patient({ id: 'before', created_at: '2026-06-01T08:00:00Z' }),
      patient({ id: 'inside', created_at: '2026-06-15T08:00:00Z' }),
      patient({ id: 'after', created_at: '2026-06-25T08:00:00Z' })
    ];

    expect(countPatientsCreatedInRange(patients, '2026-06-10', '2026-06-20')).toBe(1);
  });

  it('calculates monthly profit from production revenue minus expenses', () => {
    const monthly = buildMonthlyProfitData({
      rangeMonths: [{ key: '2026-06', label: 'Jun 2026' }],
      filteredTreatmentRecords: [treatment({ cost: 200, date: '2026-06-10' })],
      filteredExpenses: [expense({ amount: 45, date: '2026-06-11' })]
    });

    expect(monthly).toEqual([
      {
        label: 'Jun 2026',
        revenue: 200,
        expenses: 45,
        profit: 155
      }
    ]);
  });
});