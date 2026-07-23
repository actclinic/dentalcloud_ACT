import { describe, expect, it } from 'vitest';
import type { Patient } from '../types';
import type { PatientReportSummary } from './patientReport';
import { buildPatientReportPdfData } from './patientReportExport';

const patient: Patient = {
  id: 'patient-1', location_id: 'location-1', name: 'Mya / Mya?', email: '', phone: '091234',
  patient_unique_id: 'P-001', patient_type: 'Returning', balance: 20, loyalty_points: 0
};

const report = (restricted = false): PatientReportSummary => ({
  visitDates: ['2026-07-10'], firstVisitDate: '2026-07-10', lastVisitDate: '2026-07-10',
  totalPaid: restricted ? null : 80, treatmentValue: 100, medicineValue: 0, serviceFeeValue: 0, careValue: 100, currentDebt: 20,
  treatments: [], medicines: [], doctors: [], appointmentStatus: [], appointments: [], timeline: [],
  treatmentLedger: [{
    id: 'treatment-1', date: '2026-07-10', name: 'Filling', teeth: [11], doctorName: 'Aung', amount: 100,
    paid: restricted ? null : 80, balance: restricted ? null : 20,
    payments: restricted ? [] : [{ id: 'payment-1', date: '2026-07-11', amount: 80, paymentMethod: 'CASH', receiptNumber: 'REC-1', balanceAfter: 20 }]
  }],
  paymentHistory: restricted ? null : [{ id: 'payment-1', patientId: patient.id, amount: 80, date: '2026-07-11', type: 'PARTIAL', remainingBalance: 20, paymentMethod: 'CASH', receiptNumber: 'REC-1' }]
});

describe('buildPatientReportPdfData', () => {
  it('builds printable treatment and payment tables with a safe filename', () => {
    const data = buildPatientReportPdfData(patient, report(), 'USD', '2026-07-21');

    expect(data.filename).toBe('about-Mya-Mya-2026-07-21.pdf');
    expect(data.patientLines).toContain('Patient ID: P-001');
    expect(data.treatmentRows[0]).toEqual(expect.arrayContaining(['Filling', '100.00$', '80.00$', '20.00$']));
    expect(data.treatmentRows[0][7]).toContain('REC-1');
    expect(data.paymentRows?.[0]).toEqual(expect.arrayContaining(['2026-07-11', 'Cash', 'REC-1', '80.00$', '20.00$']));
  });

  it('does not expose payment values when access is restricted', () => {
    const data = buildPatientReportPdfData(patient, report(true), 'USD', '2026-07-21');

    expect(data.summaryRows).toContainEqual(['Amount paid', 'Restricted']);
    expect(data.treatmentRows[0][5]).toBe('Restricted');
    expect(data.treatmentRows[0][6]).toBe('Restricted');
    expect(data.treatmentRows[0][7]).toBe('Restricted');
    expect(data.paymentRows).toBeNull();
  });
});