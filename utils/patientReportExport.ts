import type { Patient, PaymentAllocation, PaymentMethod } from '../types';
import type { Currency } from './currency';
import { formatCurrency } from './currency';
import { formatDoctorName } from './doctorName';
import { formatPaymentAllocations, formatPaymentMethod } from './paymentMethods';
import type { PatientReportSummary } from './patientReport';
import { formatTeethWithPosition } from './toothNumbering';

export interface PatientReportPdfData {
  filename: string;
  patientLines: string[];
  summaryRows: string[][];
  treatmentRows: string[][];
  paymentRows: string[][] | null;
  appointmentRows: string[][];
  medicineRows: string[][];
  accessNote: string;
}

const displayDate = (value?: string | null): string => value || 'Not recorded';
const safeFilenamePart = (value: string): string => value
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'patient';

const paymentMethodLabel = (payment: { paymentMethod?: PaymentMethod; allocations?: PaymentAllocation[] }): string =>
  payment.allocations?.length
    ? formatPaymentAllocations(payment.allocations)
    : formatPaymentMethod(payment.paymentMethod);

export const buildPatientReportPdfData = (
  patient: Patient,
  report: PatientReportSummary,
  currency: Currency,
  exportDate = new Date().toISOString().slice(0, 10)
): PatientReportPdfData => ({
  filename: `about-${safeFilenamePart(patient.name)}-${exportDate}.pdf`,
  patientLines: [
    `Patient: ${patient.name}`,
    `Patient ID: ${patient.patient_unique_id || patient.id}`,
    `Phone: ${patient.phone || 'Not recorded'}   Type: ${patient.patient_type || 'Not assigned'}`
  ],
  summaryRows: [
    ['First visit', displayDate(report.firstVisitDate)],
    ['Latest visit', displayDate(report.lastVisitDate)],
    ['Unique care dates', String(report.visitDates.length)],
    ['Treatment value', formatCurrency(report.treatmentValue, currency)],
    ['Medicine value', formatCurrency(report.medicineValue, currency)],
    ['Service fees', formatCurrency(report.serviceFeeValue, currency)],
    ['Care value', formatCurrency(report.careValue, currency)],
    ['Amount paid', report.totalPaid === null ? 'Restricted' : formatCurrency(report.totalPaid, currency)],
    ['Current patient debt', formatCurrency(report.currentDebt, currency)]
  ],
  treatmentRows: report.treatmentLedger.map((item) => [
    displayDate(item.date),
    item.name,
    item.teeth.length ? formatTeethWithPosition(item.teeth) : 'Not recorded',
    formatDoctorName(item.doctorName),
    formatCurrency(item.amount, currency),
    item.paid === null ? 'Restricted' : formatCurrency(item.paid, currency),
    item.balance === null ? 'Restricted' : formatCurrency(item.balance, currency),
    item.paid === null
      ? 'Restricted'
      : item.payments.map((payment) => [
          displayDate(payment.date),
          formatCurrency(payment.amount, currency),
          payment.allocations?.length
            ? payment.allocations.map((allocation) => formatPaymentMethod(allocation.method)).join(' + ')
            : formatPaymentMethod(payment.paymentMethod),
          payment.receiptNumber || 'No receipt number'
        ].join(' | ')).join('\n') || 'No linked payment'
  ]),
  paymentRows: report.paymentHistory?.map((payment) => [
    displayDate(payment.date),
    paymentMethodLabel(payment),
    payment.receiptNumber || payment.receiptSnapshot?.receiptNumber || 'Not recorded',
    formatCurrency(payment.clearedAmount ?? payment.amount, currency),
    formatCurrency(payment.patientCurrentBalance ?? payment.remainingBalance, currency)
  ]) ?? null,
  appointmentRows: report.appointments.map((appointment) => [
    displayDate(appointment.date),
    appointment.time || 'Not recorded',
    appointment.type || 'Appointment',
    formatDoctorName(appointment.doctor_name),
    appointment.status,
    appointment.notes || '-'
  ]),
  medicineRows: report.medicines.map((medicine) => [
    medicine.name,
    `${medicine.quantity}${medicine.unit ? ` ${medicine.unit}` : ''}`,
    formatCurrency(medicine.total, currency),
    medicine.dates.join(', ') || 'Not recorded'
  ]),
  accessNote: 'This report reflects records currently available to the exporting user and branch.'
});