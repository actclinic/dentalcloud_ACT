import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state: any = { calls: [] };

  state.from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      state.calls.push({ table, action: 'select', columns });
      return {
        eq: vi.fn((column: string, value: string) => {
          state.calls.push({ table, action: 'eq', column, value });
          if (table === 'patients') {
            return {
              single: vi.fn(async () => ({
                data: { name: 'Patient One', phone: '09123456789' },
                error: null
              }))
            };
          }

          if (table === 'appointments') {
            return Promise.resolve({
              data: [{ id: 'appointment-1', guest_name: null, guest_phone: null }],
              error: null
            });
          }

          return Promise.resolve({ data: [], error: null });
        })
      };
    }),
    update: vi.fn((payload: any) => {
      state.calls.push({ table, action: 'update', payload });
      return {
        in: vi.fn(async (column: string, values: string[]) => {
          state.calls.push({ table, action: 'in', column, values });
          return { error: null };
        })
      };
    }),
    delete: vi.fn(() => {
      state.calls.push({ table, action: 'delete' });
      return {
        eq: vi.fn(async (column: string, value: string) => {
          state.calls.push({ table, action: 'deleteEq', column, value });
          return { error: null };
        })
      };
    })
  }));
  state.rpc = vi.fn(async () => ({ data: 'purge-1', error: null }));

  return state;
});

vi.mock('./supabase', () => ({
  supabase: { from: supabaseMock.from, rpc: supabaseMock.rpc },
  supabaseUrl: '',
  supabaseAnonKey: ''
}));

import { api } from './api';

describe('patients.delete', () => {
  beforeEach(() => {
    supabaseMock.calls = [];
    supabaseMock.from.mockClear();
  });

  it('rejects the old direct deletion path', async () => {
    await expect(api.patients.delete('patient-1')).rejects.toThrow('Direct patient deletion is disabled');
  });

  it('uses the guarded purge RPC for an erroneous patient', async () => {
    await api.patients.purgeErroneous({
      patientId: 'patient-1', reason: 'Created by mistake during registration.',
      purgedByUserId: 'admin-1', staffSessionToken: 'session-1'
    });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('purge_erroneous_patient', {
      p_patient_id: 'patient-1',
      p_reason: 'Created by mistake during registration.',
      p_purged_by_user_id: 'admin-1',
      p_staff_session_token: 'session-1'
    });
  });
});
