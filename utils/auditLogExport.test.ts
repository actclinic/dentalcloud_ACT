import { describe, expect, it } from 'vitest';
import type { Appointment, ClinicalRecord } from '../types';
import { buildAuditLogExportTableRows, buildAuditLogRows, filterAuditLogRowsForExport, formatAuditPatientBalance } from './auditLogExport';

describe('audit log export rows', () => {
  const records: ClinicalRecord[] = [
    {
      id: 'tr-1',
      location_id: 'loc-1',
      patient_id: 'pat-1',
      patient_name: 'Aung Min',
      patient_balance: 15000,
      doctor_name: 'Hnin',
      teeth: [11],
      description: 'Filling',
      cost: 20000,
      doctorEarnings: 8000,
      date: '2026-05-30'
    },
    {
      id: 'tr-2',
      location_id: 'loc-1',
      patient_id: 'pat-1',
      patient_name: 'Aung Min',
      patient_balance: 15000,
      doctor_name: 'Hnin',
      teeth: [12],
      description: 'Scaling',
      cost: 10000,
      doctorEarnings: 4000,
      date: '2026-05-30'
    },
    {
      id: 'tr-3',
      location_id: 'loc-1',
      patient_id: 'pat-2',
      patient_name: 'Mya Mya',
      patient_balance: 0,
      doctor_name: 'Ko Ko',
      teeth: [],
      description: 'Consultation',
      cost: 5000,
      doctorEarnings: 0,
      date: '2026-05-29'
    }
  ];

  const appointments: Appointment[] = [
    {
      id: 'apt-1',
      location_id: 'loc-1',
      patient_id: 'pat-3',
      patient_name: 'Su Su',
      patient_balance: 0,
      doctor_name: 'Hnin',
      date: '2026-05-30',
      time: '09:30',
      type: 'Checkup',
      status: 'Scheduled',
      created_at: '2026-05-30T08:00:00Z',
      created_by_user_name: 'Reception One'
    },
    {
      id: 'apt-2',
      location_id: 'loc-1',
      patient_name: 'Old Appointment',
      date: '2026-05-28',
      time: '10:00',
      type: 'Follow-up',
      status: 'Completed',
      created_at: '2026-05-28T02:00:00Z',
      created_by_user_name: 'Reception Two'
    }
  ];

  it('groups same-patient same-day treatments and includes appointments in audit sort order', () => {
    const rows = buildAuditLogRows(records, appointments, true);

    expect(rows.map((row) => row.kind)).toEqual(['treatment', 'appointment', 'treatment', 'appointment']);

    const groupedTreatment = rows[0];
    expect(groupedTreatment.kind).toBe('treatment');
    if (groupedTreatment.kind === 'treatment') {
      expect(groupedTreatment.record.description).toBe('Filling + Scaling');
      expect(groupedTreatment.record.teeth).toEqual([11, 12]);
      expect(groupedTreatment.record.cost).toBe(30000);
      expect(groupedTreatment.record.doctorEarnings).toBe(12000);
      expect(groupedTreatment.record._groupedRecords).toHaveLength(2);
    }
  });

  it('filters export rows by selected audit tab, date range, and search term', () => {
    const rows = buildAuditLogRows(records, appointments, true);

    const appointmentRows = filterAuditLogRowsForExport(rows, {
      auditFilter: 'appointments',
      dateFrom: '2026-05-30',
      dateTo: '2026-05-30',
      searchTerm: 'Reception One'
    });

    expect(appointmentRows).toHaveLength(1);
    expect(appointmentRows[0].kind).toBe('appointment');
    if (appointmentRows[0].kind === 'appointment') {
      expect(appointmentRows[0].appointment.patient_name).toBe('Su Su');
    }
  });

  it('builds PDF/Excel friendly table rows with balances and recorded-by details', () => {
    const rows = filterAuditLogRowsForExport(buildAuditLogRows(records, appointments, true), {
      dateFrom: '2026-05-30',
      dateTo: '2026-05-30'
    });
    const tableRows = buildAuditLogExportTableRows(rows, 'MMK');

    expect(tableRows).toHaveLength(2);
    expect(tableRows[0]).toMatchObject({
      type: 'Treatment',
      patient: 'Aung Min',
      clinician: 'Dr. Hnin',
      patientBalance: '15,000Ks',
      amount: 30000,
      doctorEarned: 12000
    });
    expect(tableRows[0].activity).toContain('• Filling');
    expect(tableRows[0].activity).toContain('• Scaling');
    expect(tableRows[0].activity).toContain('Teeth:');

    expect(tableRows[1]).toMatchObject({
      type: 'Appointment',
      patient: 'Su Su',
      recordedBy: expect.stringContaining('Reception One'),
      patientBalance: 'Clear',
      amount: null,
      doctorEarned: null
    });
  });

  it('can omit appointment rows for doctor/patient-record exports', () => {
    const rows = buildAuditLogRows(records, appointments, false);

    expect(rows.every((row) => row.kind === 'treatment')).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it('formats missing, clear, and debt balances consistently', () => {
    expect(formatAuditPatientBalance(undefined, 'USD')).toBe('-');
    expect(formatAuditPatientBalance(0, 'USD')).toBe('Clear');
    expect(formatAuditPatientBalance(12.5, 'USD')).toBe('12.50$');
  });

  it('searches primary teeth using the staff-facing labels', () => {
    const primaryRecord: ClinicalRecord = {
      ...records[0],
      id: 'tr-primary',
      teeth: [51]
    };
    const rows = buildAuditLogRows([primaryRecord], [], false);

    expect(filterAuditLogRowsForExport(rows, { searchTerm: '1A' })).toHaveLength(1);
  });
});
