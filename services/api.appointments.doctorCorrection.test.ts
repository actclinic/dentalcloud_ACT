import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: { rpc: supabaseMock.rpc },
  supabaseUrl: '',
  supabaseAnonKey: ''
}));

import { api } from './api';

describe('appointments.correctDoctorAssignment', () => {
  beforeEach(() => supabaseMock.rpc.mockReset());

  it('passes the expected old doctor, explicit treatments, reason, and live session to the secured RPC', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{ correction_id: 'correction-1', patient_id: 'patient-1', request_token: null, corrected_treatment_count: 2 }],
      error: null
    });

    const result = await api.appointments.correctDoctorAssignment({
      appointmentId: 'appointment-1',
      expectedOldDoctorId: 'doctor-old',
      newDoctorId: 'doctor-new',
      treatmentIds: ['treatment-1', 'treatment-2'],
      reason: 'Front desk selected the wrong doctor.',
      adminUserId: 'admin-1',
      sessionToken: 'live-session-token'
    });

    expect(supabaseMock.rpc).toHaveBeenCalledWith('correct_doctor_assignment', {
      p_appointment_id: 'appointment-1',
      p_expected_old_doctor_id: 'doctor-old',
      p_new_doctor_id: 'doctor-new',
      p_treatment_ids: ['treatment-1', 'treatment-2'],
      p_reason: 'Front desk selected the wrong doctor.',
      p_admin_user_id: 'admin-1',
      p_session_token: 'live-session-token'
    });
    expect(result).toEqual({
      correctionId: 'correction-1', patientId: 'patient-1', correctedTreatmentCount: 2,
      commissionRefreshPending: false, commissionRequestToken: undefined
    });
  });

  it('rejects duplicate treatment selection before contacting the database', async () => {
    await expect(api.appointments.correctDoctorAssignment({
      appointmentId: 'appointment-1', expectedOldDoctorId: null, newDoctorId: 'doctor-new',
      treatmentIds: ['treatment-1', 'treatment-1'], reason: 'Correcting an accidental doctor selection.',
      adminUserId: 'admin-1', sessionToken: 'live-session-token'
    })).rejects.toThrow('duplicates');
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('requires a meaningful reason before contacting the database', async () => {
    await expect(api.appointments.correctDoctorAssignment({
      appointmentId: 'appointment-1', expectedOldDoctorId: 'doctor-old', newDoctorId: 'doctor-new',
      treatmentIds: [], reason: 'wrong', adminUserId: 'admin-1', sessionToken: 'live-session-token'
    })).rejects.toThrow('at least 10 characters');
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });
});