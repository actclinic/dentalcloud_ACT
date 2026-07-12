import type { Appointment } from '../types';
import { parseAppointmentClinicalFocus } from './appointmentClinicalFocus';
import { formatDoctorName } from './doctorName';

export const appointmentPatientName = (appointment: Appointment) => appointment.patient_name || appointment.guest_name || 'Unknown';

export type RecallsCancelsCategory = 'Upcoming Recall' | 'Late / No-show' | 'Cancelled';

export interface RecallsCancelsExportRow {
  category: RecallsCancelsCategory;
  date: string;
  time: string;
  patient: string;
  patientType: 'Registered Patient' | 'Lead';
  phone: string;
  source: string;
  appointmentType: string;
  doctor: string;
  clinicalFocus: string;
  notes: string;
}

export const buildRecallsCancelsLists = (appointments: Appointment[], todayKey: string) => ({
  recalls: appointments
    .filter(appointment => appointment.patient_id && appointment.status === 'Scheduled' && appointment.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
  late: appointments
    .filter(appointment => appointment.status === 'Scheduled' && appointment.date < todayKey)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)),
  cancelled: appointments
    .filter(appointment => appointment.status === 'Cancelled')
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
});

const toExportRow = (appointment: Appointment, category: RecallsCancelsCategory): RecallsCancelsExportRow => {
  const { clinicalFocus, notes } = parseAppointmentClinicalFocus(appointment.notes);

  return {
    category,
    date: appointment.date || '',
    time: appointment.time || '',
    patient: appointmentPatientName(appointment),
    patientType: appointment.patient_id ? 'Registered Patient' : 'Lead',
    phone: appointment.guest_phone || '',
    source: appointment.patient_id ? 'Registered Patient' : appointment.guest_source || 'Lead',
    appointmentType: appointment.type || 'Checkup',
    doctor: formatDoctorName(appointment.doctor_name, 'N/A'),
    clinicalFocus,
    notes
  };
};

export const buildRecallsCancelsExportRows = (appointments: Appointment[], todayKey: string) => {
  const lists = buildRecallsCancelsLists(appointments, todayKey);

  return {
    recalls: lists.recalls.map(appointment => toExportRow(appointment, 'Upcoming Recall')),
    late: lists.late.map(appointment => toExportRow(appointment, 'Late / No-show')),
    cancelled: lists.cancelled.map(appointment => toExportRow(appointment, 'Cancelled'))
  };
};