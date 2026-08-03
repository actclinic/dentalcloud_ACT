import type { PaymentRecord } from '../types';
import { getPaymentServiceFeeAmount } from './serviceFee';

const roundMoney = (amount: number): number => Math.round(amount * 100) / 100;

const positiveMoney = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

export const getPaymentTreatmentIds = (payment: PaymentRecord): string[] => Array.from(new Set([
  ...(payment.treatmentIds || []),
  ...(payment.receiptSnapshot?.treatments || []).map((item) => item.id)
].filter(Boolean)));

export const getPaymentDedupeKey = (payment: PaymentRecord): string => {
  const receiptNumber = payment.receiptNumber || payment.receiptSnapshot?.receiptNumber;
  if (receiptNumber) return `receipt:${payment.patientId}|${receiptNumber}`;
  if (payment.id) return `id:${payment.id}`;
  return `legacy:${[
    payment.patientId,
    payment.date,
    payment.clearedAmount ?? payment.amount,
    payment.createdAt || '',
    payment.paymentMethod || ''
  ].join('|')}`;
};

export const dedupePaymentRecords = (payments: PaymentRecord[]): PaymentRecord[] => (
  Array.from(new Map(payments.map((payment) => [getPaymentDedupeKey(payment), payment])).values())
);

export const getPaymentTreatmentShare = (payment: PaymentRecord): number => {
  const collected = positiveMoney(payment.clearedAmount ?? payment.amount);
  const snapshot = payment.receiptSnapshot;
  if (!snapshot) return roundMoney(Math.max(0, collected - getPaymentServiceFeeAmount(payment)));

  const treatmentValue = (snapshot.treatments || []).reduce(
    (sum, item) => sum + positiveMoney(item.finalCost),
    0
  );
  const medicineValue = (snapshot.medicines || []).reduce(
    (sum, item) => sum + positiveMoney(item.totalPrice),
    0
  );
  const serviceFee = positiveMoney(snapshot.payment.serviceFeeAmount);
  const nonServiceFeePayment = Math.max(0, collected - serviceFee);
  const billableValue = treatmentValue + medicineValue;
  const hasPricedReceiptLines = treatmentValue + medicineValue > 0;

  // Service fees are separate charges, never a proportional part of treatment
  // collection. A treatment-only receipt therefore always contributes the full
  // payment remainder to treatment collection.
  if (treatmentValue > 0 && medicineValue === 0) return roundMoney(nonServiceFeePayment);

  // For a receipt that genuinely mixes treatment and medicine, split only the
  // remainder after the service fee across those billable receipt lines.
  // Legacy/partial snapshots without priced lines retain the fee-only fallback.
  return hasPricedReceiptLines && billableValue > 0
    ? roundMoney(nonServiceFeePayment * treatmentValue / billableValue)
    : roundMoney(Math.max(0, collected - serviceFee));
};
