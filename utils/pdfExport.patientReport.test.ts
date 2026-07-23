import { describe, expect, it } from 'vitest';
import type { ClinicalRecord, Patient, PaymentRecord } from '../types';
import { buildAboutPatientPdf } from './pdfExport';

const patient: Patient = {
  id: 'patient-1', location_id: 'location-1', name: 'Mya Mya', email: '', phone: '091234',
  patient_unique_id: 'P-001', balance: 20, loyalty_points: 0
};
const treatment: ClinicalRecord = {
  id: 'treatment-1', location_id: 'location-1', patient_id: patient.id, doctor_name: 'Aung',
  treatment_type_id: null, teeth: [11], description: 'Filling', cost: 100, date: '2026-07-10'
};
const payment: PaymentRecord = {
  id: 'payment-1', location_id: 'location-1', patientId: patient.id, amount: 80, clearedAmount: 80,
  treatmentIds: [treatment.id], date: '2026-07-11', type: 'PARTIAL', remainingBalance: 20,
  paymentMethod: 'CASH', receiptNumber: 'REC-1'
};

describe('buildAboutPatientPdf', () => {
  it('renders a valid paginated PDF document without invoking a browser download', () => {
    const { doc, filename } = buildAboutPatientPdf({
      patient, appointments: [], treatments: [treatment], medicineSales: [], payments: [payment],
      paymentsAvailable: true, doctors: [], currency: 'USD'
    });
    const bytes = new Uint8Array((doc as unknown as { output: (type: 'arraybuffer') => ArrayBuffer }).output('arraybuffer'));
    const header = String.fromCharCode(...bytes.slice(0, 4));

    expect(header).toBe('%PDF');
    expect(bytes.length).toBeGreaterThan(1000);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(filename).toMatch(/^about-Mya-Mya-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});