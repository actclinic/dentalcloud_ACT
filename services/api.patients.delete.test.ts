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

  return state;
});

vi.mock('./supabase', () => ({
  supabase: { from: supabaseMock.from },
  supabaseUrl: '',
  supabaseAnonKey: ''
}));

import { api } from './api';

describe('patients.delete', () => {
  beforeEach(() => {
    supabaseMock.calls = [];
    supabaseMock.from.mockClear();
  });

  it('deletes restricted patient child rows before deleting the patient record', async () => {
    await api.patients.delete('patient-1');

    const deleteOrder = supabaseMock.calls
      .filter((call: any) => call.action === 'delete')
      .map((call: any) => call.table);

    expect(deleteOrder).toEqual([
      'patient_auth',
      'payments',
      'medicine_sales',
      'loyalty_transactions',
      'treatments',
      'conversations',
      'patients'
    ]);

    expect(supabaseMock.calls).toContainEqual({
      table: 'appointments',
      action: 'update',
      payload: {
        guest_name: 'Patient One',
        guest_phone: '09123456789'
      }
    });

    expect(supabaseMock.calls).toContainEqual({
      table: 'payments',
      action: 'deleteEq',
      column: 'patient_id',
      value: 'patient-1'
    });
    expect(supabaseMock.calls.at(-1)).toEqual({
      table: 'patients',
      action: 'deleteEq',
      column: 'id',
      value: 'patient-1'
    });
  });
});