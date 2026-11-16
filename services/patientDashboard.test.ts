import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Patient, TreatmentType } from '../types';
import { loadPatientDashboard, type PatientDashboardSource } from './patientDashboard';

const patient = { id: 'patient-1', name: 'Patient', location_id: 'branch-1', email: '', phone: '' } as Patient;

const makeSource = () => ({
  patients: {
    getById: vi.fn<PatientDashboardSource['patients']['getById']>().mockResolvedValue(patient),
    getAll: vi.fn<PatientDashboardSource['patients']['getAll']>().mockResolvedValue([patient])
  },
  appointments: { getAll: vi.fn<PatientDashboardSource['appointments']['getAll']>().mockResolvedValue([]) },
  treatments: {
    getHistory: vi.fn<PatientDashboardSource['treatments']['getHistory']>().mockResolvedValue([]),
    getTypes: vi.fn<PatientDashboardSource['treatments']['getTypes']>().mockResolvedValue([])
  },
  files: { list: vi.fn<PatientDashboardSource['files']['list']>().mockResolvedValue([]) },
  doctors: { getAll: vi.fn<PatientDashboardSource['doctors']['getAll']>().mockResolvedValue([]) },
  appSettings: {
    getReceiptPreferences: vi.fn<PatientDashboardSource['appSettings']['getReceiptPreferences']>().mockResolvedValue(null),
    getAppName: vi.fn<PatientDashboardSource['appSettings']['getAppName']>().mockResolvedValue('ACT')
  },
  branchReceiptIdentity: { get: vi.fn<PatientDashboardSource['branchReceiptIdentity']['get']>().mockResolvedValue({} as any) }
});

afterEach(() => vi.restoreAllMocks());

describe('loadPatientDashboard', () => {
  it('uses the scoped patient lookup and server-filtered appointments', async () => {
    const source = makeSource();
    await loadPatientDashboard(source, patient.id, patient.location_id);
    expect(source.patients.getById).toHaveBeenCalledExactlyOnceWith(patient.id, patient.location_id);
    expect(source.patients.getAll).not.toHaveBeenCalled();
    expect(source.appointments.getAll).toHaveBeenCalledExactlyOnceWith(patient.location_id, {
      patientId: patient.id,
      throwOnError: true
    });
  });

  it('keeps the missing-location fallback and uses the profile branch afterwards', async () => {
    const source = makeSource();
    const result = await loadPatientDashboard(source, patient.id);
    expect(source.patients.getAll).toHaveBeenCalledExactlyOnceWith();
    expect(source.patients.getById).not.toHaveBeenCalled();
    expect(result.patient).toBe(patient);
    expect(source.doctors.getAll).toHaveBeenCalledWith(patient.location_id);
  });

  it('isolates supplementary file and receipt failures', async () => {
    const source = makeSource();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('supplement unavailable');
    source.files.list.mockRejectedValue(error);
    source.appSettings.getReceiptPreferences.mockRejectedValue(error);
    const result = await loadPatientDashboard(source, patient.id, patient.location_id);
    expect(result.patientFiles).toEqual([]);
    expect(result.receiptConfiguration[0].status).toBe('rejected');
  });

  it('normalizes booking types and rejects an absent session before reads', async () => {
    const source = makeSource();
    source.treatments.getTypes.mockResolvedValue([
      { name: ' Cleaning ' }, { name: 'Extraction' }, { name: 'Cleaning' }, { name: ' ' }
    ] as TreatmentType[]);
    const result = await loadPatientDashboard(source, patient.id, patient.location_id);
    expect(result.treatmentTypeOptions).toEqual(['Cleaning', 'Extraction']);

    const missingSource = makeSource();
    await expect(loadPatientDashboard(missingSource, null, patient.location_id)).rejects.toThrow('No patient session found');
    expect(missingSource.patients.getById).not.toHaveBeenCalled();
  });
});
