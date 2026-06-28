import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state: any = { insertPayloads: [], singleResults: [] };
  state.from = vi.fn((table: string) => ({
    insert: vi.fn((payload: any) => {
      state.insertPayloads.push({ table, payload });
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => state.singleResults.shift())
        }))
      };
    })
  }));
  return state;
});

vi.mock('./supabase', () => ({
  supabase: { from: supabaseMock.from },
  supabaseUrl: '',
  supabaseAnonKey: ''
}));

import { api } from './api';

describe('appointmentRescheduleLogs.create', () => {
  beforeEach(() => {
    supabaseMock.insertPayloads = [];
    supabaseMock.singleResults = [];
    supabaseMock.from.mockClear();
  });

  it('drops stale admin_user_id when the optional FK rejects it', async () => {
    supabaseMock.singleResults.push(
      {
        data: null,
        error: { message: 'insert or update on table "appointment_reschedule_logs" violates foreign key constraint "appointment_reschedule_logs_admin_user_id_fkey"' }
      },
      {
        data: {
          id: 'log-1',
          appointment_id: 'apt-1',
          location_id: 'loc-1',
          patient_id: null,
          patient_name: 'Patient',
          doctor_name: null,
          original_date: '2026-06-28',
          new_date: '2026-06-29',
          reason: 'Patient did not arrive',
          admin_user_id: null,
          admin_name: 'Admin',
          created_at: '2026-06-28T00:00:00Z'
        },
        error: null
      }
    );

    const result = await api.appointmentRescheduleLogs.create({
      appointment_id: 'apt-1',
      location_id: 'loc-1',
      patient_name: 'Patient',
      original_date: '2026-06-28',
      new_date: '2026-06-29',
      reason: 'Patient did not arrive',
      admin_user_id: 'deleted-user',
      admin_name: 'Admin'
    });

    expect(supabaseMock.insertPayloads.map((call: any) => call.payload.admin_user_id)).toEqual(['deleted-user', null]);
    expect(result.admin_name).toBe('Admin');
  });
});