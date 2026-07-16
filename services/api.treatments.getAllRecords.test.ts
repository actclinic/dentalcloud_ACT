import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state: any = { calls: [], rows: [], commissionEntriesError: null as any };

  const createTreatmentQuery = () => {
    const query: any = {
      order: vi.fn((column: string, options?: any) => {
        state.calls.push({ action: 'order', column, options });
        return query;
      }),
      limit: vi.fn((count: number) => {
        state.calls.push({ action: 'limit', count });
        return query;
      }),
      eq: vi.fn((column: string, value: string) => {
        state.calls.push({ action: 'eq', column, value });
        return query;
      }),
      then: (resolve: any) => Promise.resolve({ data: state.rows, error: null }).then(resolve)
    };
    return query;
  };

  const createCommissionEntriesQuery = () => {
    const query: any = {
      in: vi.fn((column: string, values: string[]) => {
        state.calls.push({ table: 'doctor_commission_entries', action: 'in', column, values });
        return Promise.resolve(
          state.commissionEntriesError
            ? { data: null, error: state.commissionEntriesError }
            : { data: [], error: null }
        );
      })
    };
    return query;
  };

  state.from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      state.calls.push({ table, action: 'select', columns });
      return table === 'doctor_commission_entries' ? createCommissionEntriesQuery() : createTreatmentQuery();
    })
  }));

  return state;
});

vi.mock('./supabase', () => ({
  supabase: { from: supabaseMock.from, rpc: vi.fn() },
  supabaseUrl: '',
  supabaseAnonKey: ''
}));

import { api } from './api';

describe('treatments.getAllRecords', () => {
  beforeEach(() => {
    supabaseMock.calls = [];
    supabaseMock.rows = [];
    supabaseMock.commissionEntriesError = null;
    supabaseMock.from.mockClear();
  });

  it('keeps the default recent-record limit for performance', async () => {
    await api.treatments.getAllRecords('location-1');

    expect(supabaseMock.calls).toContainEqual({ action: 'limit', count: 50 });
  });

  it('does not apply the recent-record limit when audit log asks for all records', async () => {
    await api.treatments.getAllRecords('location-1', { limit: null });

    expect(supabaseMock.calls).toContainEqual({
      table: 'treatments',
      action: 'select',
      columns: '*, patients(name, balance, patient_type), doctors(name, specialization, commission_percentage, commission_per_visit)'
    });
    expect(supabaseMock.calls).not.toContainEqual({ action: 'limit', count: 50 });
    expect(supabaseMock.calls).toContainEqual({ action: 'eq', column: 'location_id', value: 'location-1' });
  });

  it('still returns treatment records when the commission-ledger enrichment query fails', async () => {
    supabaseMock.rows = [
      {
        id: 'treatment-1',
        location_id: 'location-1',
        patient_id: 'patient-1',
        doctor_id: 'doctor-1',
        cost: 50000,
        doctor_earnings: 5000,
        date: '2026-07-16',
        patients: { name: 'Aung Min', balance: 0, patient_type: 'Marketing' },
        doctors: { name: 'Hnin', specialization: 'General', commission_percentage: 10, commission_per_visit: 0 }
      }
    ];
    supabaseMock.commissionEntriesError = { message: 'canceling statement due to statement timeout', code: '57014' };

    const records = await api.treatments.getAllRecords('location-1', { limit: null });

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('treatment-1');
    expect(records[0].doctorEarnings).toBe(5000);
  });
});
