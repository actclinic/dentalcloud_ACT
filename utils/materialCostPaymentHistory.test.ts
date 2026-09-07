import { describe, expect, it } from 'vitest';

import type { ClinicalRecord, DoctorEarningEntry, PaymentRecord } from '../types';
import { buildAuditLogRows } from './auditLogExport';
import { calculateCollectedByTreatmentId } from './materialCostCalculations';
import {
  buildMaterialCostPaymentHistoryRows,
  filterMaterialCostPaymentHistoryRows
} from './materialCostPaymentHistory';

const treatment = (overrides: Partial<ClinicalRecord> = {}): ClinicalRecord => ({
  id: 'treatment-1',
  location_id: 'location-1',
  patient_id: 'patient-1',
  patient_name: 'Mya Mya',
  doctor_id: 'doctor-1',
  doctor_name: 'Aung',
  treatment_type_id: 'type-1',
  teeth: [],
  description: 'Scaling',
  cost: 80_000,
  date: '2026-09-01',
  ...overrides
});

const payment = (overrides: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: 'payment-1',
  patientId: 'patient-1',
  patient_name: 'Mya Mya',
  amount: 80_000,
  clearedAmount: 80_000,
  treatmentIds: ['treatment-1'],
  date: '2026-09-01',
  type: 'FULL',
  remainingBalance: 0,
  paymentMethod: 'CASH',
  receiptNumber: 'R-001',
  ...overrides
});

const earning = (overrides: Partial<DoctorEarningEntry> = {}): DoctorEarningEntry => ({
  id: 'earning-1',
  paymentId: 'payment-1',
  treatmentId: 'treatment-1',
  doctorId: 'doctor-1',
  paymentDate: '2026-09-01',
  treatmentDate: '2026-09-01',
  calculationMode: 'percentage',
  allocatedPayment: 80_000,
  commissionRate: 5,
  earnings: 4_000,
  ...overrides
});

describe('MLS payment history rows', () => {
  it('shows 300,000 and 700,000 collections as separate rows with their own 10% ledger earnings', () => {
    const record = treatment({
      cost: 1_000_000,
      doctorEarningEntries: [
        earning({ id: 'earning-1', paymentId: 'payment-1', allocatedPayment: 300_000, commissionRate: 10, earnings: 30_000 }),
        earning({ id: 'earning-2', paymentId: 'payment-2', paymentDate: '2026-09-02', allocatedPayment: 700_000, commissionRate: 10, earnings: 70_000 })
      ]
    });
    const payments = [
      payment({ id: 'payment-1', amount: 300_000, clearedAmount: 300_000, type: 'PARTIAL', remainingBalance: 700_000 }),
      payment({ id: 'payment-2', date: '2026-09-02', receiptNumber: 'R-002', amount: 700_000, clearedAmount: 700_000 })
    ];

    const rows = buildMaterialCostPaymentHistoryRows([record], payments);

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.paymentId === 'payment-1')).toMatchObject({
      totalPaid: 300_000,
      appliedToTreatment: 300_000,
      paymentStatus: 'PARTIAL',
      balanceAfter: 700_000,
      doctorEarned: 30_000
    });
    expect(rows.find((row) => row.paymentId === 'payment-2')).toMatchObject({
      totalPaid: 700_000,
      appliedToTreatment: 700_000,
      paymentStatus: 'FULL',
      balanceAfter: 0,
      doctorEarned: 70_000
    });

    const operationRows = buildAuditLogRows([record], [], false, [], []).filter((row) => row.kind === 'treatment');
    expect(operationRows).toHaveLength(1);
    expect(calculateCollectedByTreatmentId([record], payments)).toEqual({ 'treatment-1': 1_000_000 });
  });

  it('keeps partial collections as separate payment events and excludes excess unallocated money', () => {
    const records = [treatment({
      doctorEarningEntries: [
        earning({ id: 'earning-1', paymentId: 'payment-1', allocatedPayment: 30_000, earnings: 1_500 }),
        earning({ id: 'earning-2', paymentId: 'payment-2', paymentDate: '2026-09-02', allocatedPayment: 50_000, earnings: 2_500 })
      ]
    })];
    const payments = [
      payment({ id: 'payment-1', amount: 30_000, clearedAmount: 30_000, type: 'PARTIAL', remainingBalance: 50_000 }),
      payment({ id: 'payment-2', date: '2026-09-02', receiptNumber: 'R-002', amount: 50_000, clearedAmount: 50_000 }),
      payment({ id: 'payment-3', date: '2026-09-03', receiptNumber: 'R-003', amount: 10_000, clearedAmount: 10_000 })
    ];

    const rows = buildMaterialCostPaymentHistoryRows(records, payments);

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.paymentId === 'payment-1')).toMatchObject({
      totalPaid: 30_000,
      appliedToTreatment: 30_000,
      paymentStatus: 'PARTIAL',
      balanceAfter: 50_000,
      doctorEarned: 1_500
    });
    expect(rows.find((row) => row.paymentId === 'payment-2')).toMatchObject({
      totalPaid: 50_000,
      appliedToTreatment: 50_000,
      doctorEarned: 2_500
    });
  });

  it('shows mixed-receipt total once while excluding medicine and service fees from treatment allocation', () => {
    const receiptSnapshot = {
      receiptNumber: 'R-MIXED',
      patient: { name: 'Mya Mya' },
      payment: { method: 'MIXED', serviceFeeAmount: 10_000 },
      treatments: [{ id: 'treatment-1', finalCost: 80_000 }],
      medicines: [{ totalPrice: 10_000 }]
    } as PaymentRecord['receiptSnapshot'];
    const records = [treatment({ doctorEarningEntries: [earning()] })];

    const [row] = buildMaterialCostPaymentHistoryRows(records, [payment({
      amount: 100_000,
      clearedAmount: 100_000,
      receiptSnapshot
    })]);

    expect(row).toMatchObject({ totalPaid: 100_000, appliedToTreatment: 80_000, doctorEarned: 4_000 });
  });

  it('combines a multi-treatment payment into one row and sums only matching ledger earnings', () => {
    const first = treatment({
      id: 'treatment-1',
      description: 'Scaling',
      cost: 30_000,
      doctorEarningEntries: [earning({ treatmentId: 'treatment-1', earnings: 1_500 })]
    });
    const second = treatment({
      id: 'treatment-2',
      description: 'Filling',
      cost: 50_000,
      doctor_id: 'doctor-2',
      doctor_name: 'Su',
      doctorEarningEntries: [earning({ id: 'earning-2', treatmentId: 'treatment-2', doctorId: 'doctor-2', earnings: 2_500 })]
    });

    const [row] = buildMaterialCostPaymentHistoryRows([first, second], [payment({
      treatmentIds: ['treatment-1', 'treatment-2']
    })]);

    expect(row.totalPaid).toBe(80_000);
    expect(row.appliedToTreatment).toBe(80_000);
    expect(row.doctorEarned).toBe(4_000);
    expect(row.treatmentNames).toEqual(['Scaling', 'Filling']);
    expect(row.doctorNames).toEqual(['Aung', 'Su']);
  });

  it('deduplicates the same receipt and its commission entry across payment aliases', () => {
    const records = [treatment({ doctorEarningEntries: [earning({ paymentId: 'database-payment' })] })];
    const payments = [
      payment({ id: 'database-payment', receiptNumber: 'R-DUP' }),
      payment({ id: 'legacy-payment', receiptNumber: 'R-DUP' })
    ];

    const rows = buildMaterialCostPaymentHistoryRows(records, payments);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ paymentId: 'legacy-payment', doctorEarned: 4_000 });
  });

  it('filters by payment date, patient, doctor, and treatment', () => {
    const rows = buildMaterialCostPaymentHistoryRows(
      [treatment({ doctorEarningEntries: [earning()] })],
      [payment()]
    );

    expect(filterMaterialCostPaymentHistoryRows(rows, {
      dateFrom: '2026-09-01',
      dateTo: '2026-09-01',
      patientTerm: 'mya',
      doctorTerm: 'aung',
      treatmentTerm: 'scal'
    })).toHaveLength(1);
    expect(filterMaterialCostPaymentHistoryRows(rows, { dateFrom: '2026-09-02' })).toHaveLength(0);
    expect(filterMaterialCostPaymentHistoryRows(rows, { doctorTerm: 'su' })).toHaveLength(0);
  });
});
