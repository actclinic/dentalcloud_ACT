import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('./supabase', () => ({ supabase: { rpc, from: vi.fn() }, supabaseUrl: '', supabaseAnonKey: '' }));

import { api } from './api';

describe('patient directory summaries', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: [{
      patient_id: 'patient-1', last_visit: '2026-10-20',
      next_appointment: { id: 'appointment-1', date: '2026-10-30', time: '09:30', status: 'Scheduled' },
      treatments: [{ id: 'treatment-1', date: '2026-10-20', description: 'Cleaning', doctor_id: 'doctor-1', doctor_name: 'Doctor' }],
      doctor_names: ['Doctor', null]
    }], error: null });
  });

  it('deduplicates, branch-scopes and maps the bounded RPC response', async () => {
    const result = await api.patients.getDirectorySummaries('branch-1', ['patient-1', 'patient-1', 'patient-2']);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('patient_directory_summaries', {
      p_location_id: 'branch-1', p_patient_ids: ['patient-1', 'patient-2']
    });
    expect(result[0]).toMatchObject({ patientId: 'patient-1', lastVisit: '2026-10-20', doctorNames: ['Doctor'] });
  });

  it('caps requests at 100 IDs and skips empty pages', async () => {
    await api.patients.getDirectorySummaries(undefined, Array.from({ length: 130 }, (_, index) => `patient-${index}`));
    expect(rpc.mock.calls[0][1].p_patient_ids).toHaveLength(100);
    rpc.mockClear();
    await expect(api.patients.getDirectorySummaries('branch-1', [])).resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('surfaces RPC failures so the UI can retain its existing fallback data', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'summary failed' } });
    await expect(api.patients.getDirectorySummaries('branch-1', ['patient-1'])).rejects.toThrow('summary failed');
  });
});
