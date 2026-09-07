import type { ClinicalRecord, PaymentAllocation, PaymentMethod, PaymentRecord } from '../types';
import { allocateCommissionablePayments } from './doctorCommissionLedger';
import {
  dedupePaymentRecords,
  getPaymentDedupeKey,
  getPaymentTreatmentIds,
  getPaymentTreatmentShare
} from './paymentTreatmentAllocation';

export interface MaterialCostPaymentHistoryRow {
  paymentId: string;
  paymentDate: string;
  createdAt?: string;
  receiptNumber: string;
  patientId: string;
  patientName: string;
  doctorNames: string[];
  treatmentIds: string[];
  treatmentNames: string[];
  paymentMethod?: PaymentMethod;
  paymentAllocations?: PaymentAllocation[];
  paymentStatus: PaymentRecord['type'];
  totalPaid: number;
  appliedToTreatment: number;
  balanceAfter: number;
  doctorEarned: number;
}

export interface MaterialCostPaymentHistoryFilters {
  dateFrom?: string;
  dateTo?: string;
  patientTerm?: string;
  doctorTerm?: string;
  treatmentTerm?: string;
}

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const positiveMoney = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

const distinct = (values: Array<string | null | undefined>): string[] => (
  Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
);

export const buildMaterialCostPaymentHistoryRows = (
  records: ClinicalRecord[],
  paymentRecords: PaymentRecord[]
): MaterialCostPaymentHistoryRow[] => {
  const payments = dedupePaymentRecords(paymentRecords);
  const paymentAliasesByKey = new Map<string, Set<string>>();
  paymentRecords.forEach((payment) => {
    const key = getPaymentDedupeKey(payment);
    const aliases = paymentAliasesByKey.get(key) || new Set<string>();
    if (payment.id) aliases.add(payment.id);
    paymentAliasesByKey.set(key, aliases);
  });

  const allocations = allocateCommissionablePayments(
    records.map((record) => ({
      id: record.id,
      patientId: record.patient_id,
      date: record.date,
      cost: positiveMoney(record.cost)
    })),
    payments.map((payment) => ({
      id: payment.id,
      patientId: payment.patientId,
      date: payment.date,
      createdAt: payment.createdAt,
      commissionableAmount: getPaymentTreatmentShare(payment),
      treatmentIds: getPaymentTreatmentIds(payment)
    }))
  );

  const treatmentById = new Map(records.map((record) => [record.id, record]));
  const allocationsByPaymentId = new Map<string, typeof allocations>();
  allocations.forEach((allocation) => {
    const rows = allocationsByPaymentId.get(allocation.paymentId) || [];
    rows.push(allocation);
    allocationsByPaymentId.set(allocation.paymentId, rows);
  });

  const canonicalPaymentIdByAlias = new Map<string, string>();
  payments.forEach((payment) => {
    const aliases = paymentAliasesByKey.get(getPaymentDedupeKey(payment)) || new Set([payment.id]);
    aliases.forEach((alias) => canonicalPaymentIdByAlias.set(alias, payment.id));
  });

  const uniqueLedgerEntries = new Map<string, NonNullable<ClinicalRecord['doctorEarningEntries']>[number]>();
  records.forEach((record) => {
    (record.doctorEarningEntries || []).forEach((entry) => {
      const canonicalPaymentId = canonicalPaymentIdByAlias.get(entry.paymentId);
      if (!canonicalPaymentId) return;
      uniqueLedgerEntries.set(`${canonicalPaymentId}|${entry.treatmentId}`, entry);
    });
  });

  return payments.flatMap((payment) => {
    const paymentAllocations = allocationsByPaymentId.get(payment.id) || [];
    const appliedToTreatment = roundMoney(paymentAllocations.reduce((sum, allocation) => sum + allocation.amount, 0));
    if (appliedToTreatment <= 0) return [];

    const treatmentIds = distinct(paymentAllocations.map((allocation) => allocation.treatmentId));
    const treatments = treatmentIds
      .map((treatmentId) => treatmentById.get(treatmentId))
      .filter((record): record is ClinicalRecord => Boolean(record));
    const doctorEarned = roundMoney(treatmentIds.reduce((sum, treatmentId) => (
      sum + positiveMoney(uniqueLedgerEntries.get(`${payment.id}|${treatmentId}`)?.earnings)
    ), 0));

    return [{
      paymentId: payment.id,
      paymentDate: payment.date,
      ...(payment.createdAt ? { createdAt: payment.createdAt } : {}),
      receiptNumber: payment.receiptNumber || payment.receiptSnapshot?.receiptNumber || '',
      patientId: payment.patientId,
      patientName: payment.patient_name
        || payment.receiptSnapshot?.patient.name
        || treatments[0]?.patient_name
        || 'Unknown',
      doctorNames: distinct(treatments.map((record) => record.doctor_name || 'Unassigned')),
      treatmentIds,
      treatmentNames: treatments.map((record) => record.description?.trim() || 'Treatment record'),
      paymentMethod: payment.paymentMethod || payment.receiptSnapshot?.payment.method,
      paymentAllocations: payment.allocations || payment.receiptSnapshot?.payment.allocations,
      paymentStatus: payment.type,
      totalPaid: roundMoney(positiveMoney(payment.clearedAmount ?? payment.amount)),
      appliedToTreatment,
      balanceAfter: roundMoney(positiveMoney(payment.remainingBalance ?? payment.receiptSnapshot?.payment.balanceAfter)),
      doctorEarned
    }];
  }).sort((a, b) => (
    b.paymentDate.localeCompare(a.paymentDate)
    || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    || b.paymentId.localeCompare(a.paymentId)
  ));
};

export const filterMaterialCostPaymentHistoryRows = (
  rows: MaterialCostPaymentHistoryRow[],
  filters: MaterialCostPaymentHistoryFilters
): MaterialCostPaymentHistoryRow[] => {
  const patientTerm = filters.patientTerm?.trim().toLowerCase() || '';
  const doctorTerm = filters.doctorTerm?.trim().toLowerCase() || '';
  const treatmentTerm = filters.treatmentTerm?.trim().toLowerCase() || '';

  return rows.filter((row) => (
    (!filters.dateFrom || row.paymentDate >= filters.dateFrom)
    && (!filters.dateTo || row.paymentDate <= filters.dateTo)
    && (!patientTerm || row.patientId.toLowerCase().includes(patientTerm) || row.patientName.toLowerCase().includes(patientTerm))
    && (!doctorTerm || row.doctorNames.some((name) => name.toLowerCase().includes(doctorTerm)))
    && (!treatmentTerm || row.treatmentNames.some((name) => name.toLowerCase().includes(treatmentTerm)))
  ));
};
