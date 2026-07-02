import { Appointment } from '../types';
import { formatDoctorName } from './doctorName';

export type VerificationStatus = 'passed' | 'failed' | 'uncertain';

export interface VerificationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity?: 'info' | 'warning' | 'critical';
}

export interface VerificationResult {
  status: VerificationStatus;
  confidence: number;
  summary: string;
  checks: VerificationCheck[];
  evidence: string[];
  issues: string[];
  nextAction?: 'none' | 'retry' | 'ask_user' | 'human_review';
}

export interface ExpectedAppointmentState {
  id?: string;
  location_id?: string;
  patient_id?: string;
  doctor_id?: string | null;
  date?: string;
  time?: string;
  type?: string;
  status?: Appointment['status'];
}

const normalize = (value: unknown): string => String(value ?? '').trim();

const normalizeTime = (value: unknown): string => {
  const raw = normalize(value);
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

const sameOptionalValue = (actual: unknown, expected: unknown): boolean => {
  if (expected === undefined) return true;
  return normalize(actual) === normalize(expected);
};

const sameOptionalTime = (actual: unknown, expected: unknown): boolean => {
  if (expected === undefined) return true;
  return normalizeTime(actual) === normalizeTime(expected);
};

const createCheck = (
  name: string,
  passed: boolean,
  message: string,
  severity: VerificationCheck['severity'] = 'critical'
): VerificationCheck => ({ name, passed, message, severity });

const buildResult = (
  summary: string,
  checks: VerificationCheck[],
  evidence: string[],
  nextAction: VerificationResult['nextAction'] = 'none'
): VerificationResult => {
  const blockingIssues = checks.filter(check => !check.passed && check.severity !== 'info');
  const warningIssues = checks.filter(check => !check.passed && check.severity === 'warning');
  const passedCount = checks.filter(check => check.passed).length;
  const confidence = checks.length === 0 ? 0 : Math.round((passedCount / checks.length) * 100) / 100;

  return {
    status: blockingIssues.length > 0 ? 'failed' : warningIssues.length > 0 ? 'uncertain' : 'passed',
    confidence,
    summary,
    checks,
    evidence,
    issues: checks.filter(check => !check.passed).map(check => check.message),
    nextAction: blockingIssues.length > 0 ? nextAction : warningIssues.length > 0 ? 'human_review' : 'none'
  };
};

const findAppointment = (
  appointments: Appointment[],
  expected: ExpectedAppointmentState,
  created?: Appointment | null
): Appointment | undefined => {
  if (created?.id) {
    const byCreatedId = appointments.find(appointment => appointment.id === created.id);
    if (byCreatedId) return byCreatedId;
  }

  if (expected.id) {
    const byExpectedId = appointments.find(appointment => appointment.id === expected.id);
    if (byExpectedId) return byExpectedId;
  }

  return appointments.find(appointment =>
    sameOptionalValue(appointment.location_id, expected.location_id) &&
    sameOptionalValue(appointment.patient_id, expected.patient_id) &&
    sameOptionalValue(appointment.doctor_id || null, expected.doctor_id) &&
    sameOptionalValue(appointment.date, expected.date) &&
    sameOptionalTime(appointment.time, expected.time) &&
    sameOptionalValue(appointment.status, expected.status)
  );
};

const appointmentStateChecks = (
  appointment: Appointment | undefined,
  expected: ExpectedAppointmentState
): VerificationCheck[] => {
  if (!appointment) {
    return [createCheck('appointment_exists', false, 'No appointment matching the expected outcome was found.')];
  }

  return [
    createCheck('appointment_exists', true, `Appointment ${appointment.id} exists.`),
    createCheck('location_matches', sameOptionalValue(appointment.location_id, expected.location_id), 'Appointment branch does not match the requested branch.'),
    createCheck('patient_matches', sameOptionalValue(appointment.patient_id, expected.patient_id), 'Appointment patient does not match the requested patient.'),
    createCheck('doctor_matches', sameOptionalValue(appointment.doctor_id || null, expected.doctor_id), 'Appointment doctor does not match the requested doctor.'),
    createCheck('date_matches', sameOptionalValue(appointment.date, expected.date), 'Appointment date does not match the requested date.'),
    createCheck('time_matches', sameOptionalTime(appointment.time, expected.time), 'Appointment time does not match the requested time.'),
    createCheck('type_matches', sameOptionalValue(appointment.type, expected.type), 'Appointment type does not match the requested type.', 'warning'),
    createCheck('status_matches', sameOptionalValue(appointment.status, expected.status), 'Appointment status does not match the expected status.')
  ];
};

const conflictChecks = (
  appointments: Appointment[],
  appointment: Appointment | undefined
): VerificationCheck[] => {
  if (!appointment || appointment.status === 'Cancelled') return [];

  const activeMatches = appointments.filter(other =>
    other.id !== appointment.id &&
    other.status !== 'Cancelled' &&
    other.date === appointment.date &&
    normalizeTime(other.time) === normalizeTime(appointment.time)
  );

  const doctorConflicts = appointment.doctor_id
    ? activeMatches.filter(other => other.doctor_id === appointment.doctor_id)
    : [];
  const patientConflicts = activeMatches.filter(other => other.patient_id === appointment.patient_id);

  return [
    createCheck(
      'doctor_double_booking',
      doctorConflicts.length === 0,
      'Another active appointment exists for the same doctor at the same date and time.'
    ),
    createCheck(
      'patient_double_booking',
      patientConflicts.length === 0,
      'Another active appointment exists for the same patient at the same date and time.'
    )
  ];
};

const appointmentEvidence = (appointment: Appointment | undefined): string[] => {
  if (!appointment) return [];

  return [
    `Appointment ID: ${appointment.id}`,
    `Patient: ${appointment.patient_name || appointment.patient_id}`,
    `Date/time: ${appointment.date} ${appointment.time}`,
    `Status: ${appointment.status}`,
    appointment.doctor_name ? `Doctor: ${formatDoctorName(appointment.doctor_name)}` : 'Doctor: unassigned'
  ];
};

export const verifyAppointmentCreated = (
  appointments: Appointment[],
  expected: ExpectedAppointmentState,
  created?: Appointment | null
): VerificationResult => {
  const appointment = findAppointment(appointments, expected, created);
  const checks = [
    ...appointmentStateChecks(appointment, expected),
    ...conflictChecks(appointments, appointment)
  ];

  return buildResult(
    'Appointment creation verification completed.',
    checks,
    appointmentEvidence(appointment),
    'human_review'
  );
};

export const verifyAppointmentUpdated = (
  appointments: Appointment[],
  expected: ExpectedAppointmentState
): VerificationResult => {
  const appointment = findAppointment(appointments, expected);
  const checks = [
    ...appointmentStateChecks(appointment, expected),
    ...conflictChecks(appointments, appointment)
  ];

  return buildResult(
    'Appointment update verification completed.',
    checks,
    appointmentEvidence(appointment),
    'human_review'
  );
};

export const verifyAppointmentDeleted = (
  appointments: Appointment[],
  appointmentId: string
): VerificationResult => {
  const appointmentStillExists = appointments.some(appointment => appointment.id === appointmentId);
  const checks = [
    createCheck(
      'appointment_removed',
      !appointmentStillExists,
      `Appointment ${appointmentId} still exists after deletion.`
    )
  ];

  return buildResult(
    'Appointment deletion verification completed.',
    checks,
    [`Appointment ID checked: ${appointmentId}`],
    'retry'
  );
};

export const renderVerificationResult = (result: VerificationResult): string => {
  const heading = result.status === 'passed'
    ? '[Verified]'
    : result.status === 'uncertain'
      ? '[Needs review]'
      : '[Verification failed]';

  const evidence = result.evidence.length > 0
    ? `\nEvidence:\n${result.evidence.map(item => `- ${item}`).join('\n')}`
    : '';

  const issues = result.issues.length > 0
    ? `\nIssues:\n${result.issues.map(item => `- ${item}`).join('\n')}`
    : '';

  const nextAction = result.nextAction && result.nextAction !== 'none'
    ? `\nNext action: ${result.nextAction.replace('_', ' ')}.`
    : '';

  return `${heading} ${result.summary} Confidence: ${Math.round(result.confidence * 100)}%.${evidence}${issues}${nextAction}`;
};
