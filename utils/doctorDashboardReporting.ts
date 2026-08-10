import type { Appointment, ClinicalRecord, DoctorEarningEntry } from '../types';

export interface DoctorReportingRange {
  startDate: string;
  endDate: string;
}

export interface DoctorReportingSummary {
  appointments: Appointment[];
  treatmentRecords: ClinicalRecord[];
  commissionEntries: DoctorEarningEntry[];
  treatedPatientCount: number;
  completedAppointmentCount: number;
  treatmentCount: number;
  production: number;
  commission: number;
  legacyCommissionEntryCount: number;
}

export const toLocalISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayReportingRange = (now = new Date()): DoctorReportingRange => {
  const today = toLocalISODate(now);
  return { startDate: today, endDate: today };
};

export const getThisWeekReportingRange = (now = new Date()): DoctorReportingRange => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { startDate: toLocalISODate(start), endDate: toLocalISODate(end) };
};

export const getThisMonthReportingRange = (now = new Date()): DoctorReportingRange => ({
  startDate: toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
  endDate: toLocalISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
});

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isValidISOCalendarDate = (value: string): boolean => {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};

export const validateDoctorReportingRange = (range: DoctorReportingRange): string | null => {
  if (!range.startDate || !range.endDate) return 'Select both a start date and an end date.';
  if (!isValidISOCalendarDate(range.startDate) || !isValidISOCalendarDate(range.endDate)) {
    return 'Select valid start and end dates.';
  }
  if (range.startDate > range.endDate) return 'Start date cannot be after end date.';
  return null;
};

export const isDateInDoctorReportingRange = (date: string | null | undefined, range: DoctorReportingRange): boolean => (
  Boolean(date && date >= range.startDate && date <= range.endDate)
);

export const buildDoctorReportingSummary = (
  appointments: Appointment[],
  treatmentRecords: ClinicalRecord[],
  range: DoctorReportingRange
): DoctorReportingSummary => {
  const rangedAppointments = appointments.filter((appointment) => isDateInDoctorReportingRange(appointment.date, range));
  const rangedTreatmentRecords = treatmentRecords.filter((record) => isDateInDoctorReportingRange(record.date, range));
  const commissionEntries = treatmentRecords
    .flatMap((record) => record.doctorEarningEntries || [])
    .filter((entry) => isDateInDoctorReportingRange(entry.paymentDate, range));

  return {
    appointments: rangedAppointments,
    treatmentRecords: rangedTreatmentRecords,
    commissionEntries,
    treatedPatientCount: new Set(rangedTreatmentRecords.map((record) => record.patient_id).filter(Boolean)).size,
    completedAppointmentCount: rangedAppointments.filter((appointment) => appointment.status === 'Completed').length,
    treatmentCount: rangedTreatmentRecords.length,
    production: rangedTreatmentRecords.reduce((sum, record) => sum + Number(record.cost || 0), 0),
    commission: commissionEntries.reduce((sum, entry) => sum + Number(entry.earnings || 0), 0),
    legacyCommissionEntryCount: commissionEntries.filter((entry) => entry.paymentId.startsWith('legacy-')).length
  };
};

export const formatDoctorReportingRange = (range: DoctorReportingRange): string => {
  const format = (value: string) => {
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  return range.startDate === range.endDate
    ? format(range.startDate)
    : `${format(range.startDate)} – ${format(range.endDate)}`;
};