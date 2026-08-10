import type { PaymentRecord } from '../types';
import { dedupePaymentRecords } from './paymentTreatmentAllocation';

export const getPatientPaymentHistory = (
  payments: PaymentRecord[],
  patientId: string
): PaymentRecord[] => dedupePaymentRecords(
  payments.filter((payment) => payment.patientId === patientId)
).sort((left, right) => {
  const dateComparison = String(right.createdAt || right.date || '').localeCompare(String(left.createdAt || left.date || ''));
  return dateComparison !== 0 ? dateComparison : right.id.localeCompare(left.id);
});