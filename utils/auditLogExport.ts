import type { Appointment, ClinicalRecord } from '../types';
import { Currency, formatCurrency } from './currency';
import { filterAuditRowsByDateRange } from './auditLogFilters';
import { formatTeethWithPosition } from './toothNumbering';

export type AuditFilter = 'all' | 'appointments' | 'treatments';

export type AuditExportRow =
  | { kind: 'treatment'; sortDate: string; record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] } }
  | { kind: 'appointment'; sortDate: string; appointment: Appointment };

export interface AuditLogFilterOptions {
  auditFilter?: AuditFilter;
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
}

export interface AuditLogExportTableRow {
  type: 'Appointment' | 'Treatment';
  dateTime: string;
  patient: string;
  clinician: string;
  activity: string;
  recordedBy: string;
  patientBalance: string;
  amount: number | null;
  doctorEarned: number | null;
}

export const formatAuditCreatedAt = (value?: string | null): string => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export const formatAuditPatientBalance = (balance: number | null | undefined, currency: Currency): string => {
  if (balance === null || balance === undefined) return '-';
  const numericBalance = Number(balance || 0);
  return numericBalance > 0 ? formatCurrency(numericBalance, currency) : 'Clear';
};

export const buildAuditLogRows = (
  records: ClinicalRecord[],
  appointments: Appointment[] = [],
  includeAppointments = true
): AuditExportRow[] => {
  const groupedTreatmentMap = new Map<string, ClinicalRecord[]>();

  records.forEach((record) => {
    const key = `${record.patient_id || ''}|${record.date || ''}`;
    if (!groupedTreatmentMap.has(key)) {
      groupedTreatmentMap.set(key, []);
    }
    groupedTreatmentMap.get(key)!.push(record);
  });

  const treatmentRows: AuditExportRow[] = [];
  groupedTreatmentMap.forEach((group) => {
    const sorted = [...group].sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      return dateCmp || (a.description || '').localeCompare(b.description || '');
    });
    const base: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] } = { ...sorted[0] };
    const allDescriptions = sorted.map((record) => record.description).filter(Boolean);
    const allTeeth = sorted.flatMap((record) => record.teeth || []);
    const totalCost = sorted.reduce((sum, record) => sum + (record.cost || 0), 0);
    const totalEarnings = sorted.reduce((sum, record) => sum + (record.doctorEarnings || 0), 0);

    base.description = allDescriptions.join(' + ');
    base.teeth = [...new Set(allTeeth)].sort((a, b) => a - b);
    base.cost = totalCost;
    base.doctorEarnings = totalEarnings > 0 ? totalEarnings : base.doctorEarnings;
    base._groupedRecords = sorted;

    treatmentRows.push({
      kind: 'treatment',
      sortDate: `${base.date || ''}T23:59:59`,
      record: base
    });
  });

  const appointmentRows: AuditExportRow[] = includeAppointments
    ? appointments.map((appointment) => ({
        kind: 'appointment',
        sortDate: appointment.created_at || `${appointment.date || ''}T${appointment.time || '00:00:00'}`,
        appointment
      }))
    : [];

  return [...treatmentRows, ...appointmentRows].sort((a, b) => b.sortDate.localeCompare(a.sortDate));
};

export const filterAuditLogRowsForExport = <T extends AuditExportRow>(rows: T[], options: AuditLogFilterOptions): T[] => {
  const scopedRows = rows.filter((row) => {
    if (options.auditFilter === 'appointments') return row.kind === 'appointment';
    if (options.auditFilter === 'treatments') return row.kind === 'treatment';
    return true;
  });

  const dateScopedRows = options.dateFrom && options.dateTo
    ? filterAuditRowsByDateRange(scopedRows, options.dateFrom, options.dateTo)
    : scopedRows;

  const term = (options.searchTerm || '').trim().toLowerCase();
  if (!term) return dateScopedRows;

  return dateScopedRows.filter((row) => {
    if (row.kind === 'treatment') {
      const record = row.record;
      return (
        (record.patient_name || '').toLowerCase().includes(term) ||
        (record.doctor_name || '').toLowerCase().includes(term) ||
        (record.description || '').toLowerCase().includes(term) ||
        (record.date || '').toLowerCase().includes(term) ||
        (record.teeth || []).some((tooth) => tooth.toString().includes(term))
      );
    }

    const appointment = row.appointment;
    return (
      (appointment.patient_name || '').toLowerCase().includes(term) ||
      (appointment.doctor_name || '').toLowerCase().includes(term) ||
      (appointment.created_by_user_name || '').toLowerCase().includes(term) ||
      (appointment.type || '').toLowerCase().includes(term) ||
      (appointment.status || '').toLowerCase().includes(term) ||
      (appointment.date || '').toLowerCase().includes(term) ||
      (appointment.time || '').toLowerCase().includes(term) ||
      (appointment.created_at || '').toLowerCase().includes(term)
    );
  });
};

export const buildAuditLogExportTableRows = (rows: AuditExportRow[], currency: Currency): AuditLogExportTableRow[] => {
  return rows.map((row) => {
    if (row.kind === 'appointment') {
      const appointment = row.appointment;
      return {
        type: 'Appointment',
        dateTime: `${appointment.date || '-'} ${appointment.time || ''}`.trim(),
        patient: appointment.patient_name || 'Unknown',
        clinician: appointment.doctor_name ? `Dr. ${appointment.doctor_name}` : '-',
        activity: `Appointment made for ${appointment.date || '-'} at ${appointment.time || '-'} (${appointment.type || 'Checkup'}, ${appointment.status || '-'})`,
        recordedBy: `${appointment.created_by_user_name || 'Unknown'}\n${formatAuditCreatedAt(appointment.created_at)}`,
        patientBalance: formatAuditPatientBalance(appointment.patient_balance, currency),
        amount: null,
        doctorEarned: null
      };
    }

    const record = row.record;
    const groupedRecords = record._groupedRecords && record._groupedRecords.length > 0 ? record._groupedRecords : [record];
    const activityLines = groupedRecords.map((groupedRecord) => `• ${groupedRecord.description}`).join('\n');
    const teethLabel = record.teeth && record.teeth.length > 0 ? formatTeethWithPosition(record.teeth) : 'General';

    return {
      type: 'Treatment',
      dateTime: record.date || '-',
      patient: record.patient_name || 'Unknown',
      clinician: record.doctor_name ? `Dr. ${record.doctor_name}` : '-',
      activity: `${activityLines}\nTeeth: ${teethLabel}`,
      recordedBy: 'Clinical record',
      patientBalance: formatAuditPatientBalance(record.patient_balance, currency),
      amount: record.cost || 0,
      doctorEarned: record.doctorEarnings || null
    };
  });
};
