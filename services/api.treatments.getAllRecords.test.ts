import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state: any = { calls: [], rows: [], ledgerError: null };

  const createTreatmentQuery = (table: string) => {
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
      in: vi.fn((column: string, value: string[]) => {
        state.calls.push({ action: 'in', column, value });
        return query;
      }),
      then: (resolve: any) => Promise.resolve(
        table === 'doctor_commission_entries'
          ? { data: null, error: state.ledgerError }
          : { data: state.rows, error: null }
      ).then(resolve)
    };
    return query;
  };

  state.from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      state.calls.push({ table, action: 'select', columns });
      return createTreatmentQuery(table);
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
    supabaseMock.ledgerError = null;
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

  it('keeps audit treatments visible when optional commission ledger enrichment fails', async () => {
    supabaseMock.rows = [{
      id: 'treatment-1',
      location_id: 'location-1',
      patient_id: 'patient-1',
      doctor_id: 'doctor-1',
      teeth: [11],
      description: 'Crown',
      cost: 500_000,
      doctor_earnings: 20_000,
      date: '2026-07-16',
      patients: { name: 'Patient One', balance: 300_000, patient_type: 'Returning' },
      doctors: { name: 'Doctor One', specialization: 'General', commission_percentage: 10, commission_per_visit: 0 }
    }];
    supabaseMock.ledgerError = { message: '<!DOCTYPE html> 502 Bad gateway' };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const records = await api.treatments.getAllRecords('location-1', { limit: null });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: 'treatment-1',
      date: '2026-07-16',
      doctorEarnings: 20_000,
      doctorEarningEntries: [{ earnings: 20_000 }]
    });
    expect(warn).toHaveBeenCalledWith(
      'Unable to load doctor commission ledger entries; using stored treatment earnings.',
      '<!DOCTYPE html> 502 Bad gateway'
    );
    warn.mockRestore();
  });
});
