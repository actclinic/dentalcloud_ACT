import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state: any = { calls: [], result: { data: [], error: null } };
  state.from = vi.fn((table: string) => {
    const query: any = {
      select: vi.fn((columns: string) => { state.calls.push({ table, action: 'select', columns }); return query; }),
      eq: vi.fn((column: string, value: string) => { state.calls.push({ table, action: 'eq', column, value }); return query; }),
      order: vi.fn((column: string, options: any) => { state.calls.push({ table, action: 'order', column, options }); return query; }),
      then: (resolve: any, reject: any) => Promise.resolve(state.result).then(resolve, reject)
    };
    return query;
  });
  return state;
});

vi.mock('./supabase', () => ({
  supabase: { from: supabaseMock.from },
  supabaseUrl: '',
  supabaseAnonKey: ''
}));

import { api } from './api';

describe('finance.getPatientPayments', () => {
  beforeEach(() => {
    supabaseMock.calls = [];
    supabaseMock.result = { data: [], error: null };
    supabaseMock.from.mockClear();
  });

  it('filters payment rows by both patient and location before returning data', async () => {
    await api.finance.getPatientPayments('patient-1', 'location-1');
    expect(supabaseMock.calls).toContainEqual({ table: 'payments', action: 'eq', column: 'patient_id', value: 'patient-1' });
    expect(supabaseMock.calls).toContainEqual({ table: 'payments', action: 'eq', column: 'location_id', value: 'location-1' });
    expect(supabaseMock.calls).toContainEqual({ table: 'payments', action: 'order', column: 'created_at', options: { ascending: false } });
  });

  it('rejects a missing patient before querying Supabase', async () => {
    await expect(api.finance.getPatientPayments('', 'location-1')).rejects.toThrow('Patient is required');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});