import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state: any = { calls: [], rows: [] };
  const createQuery = () => {
    const query: any = {
      order: vi.fn((column: string) => {
        state.calls.push({ action: 'order', column });
        return query;
      }),
      eq: vi.fn((column: string, value: string) => {
        state.calls.push({ action: 'eq', column, value });
        return query;
      }),
      then: (resolve: any, reject: any) => Promise.resolve({ data: state.rows, error: null }).then(resolve, reject)
    };
    return query;
  };
  state.from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      state.calls.push({ table, action: 'select', columns });
      return createQuery();
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

describe('appointments.getAll', () => {
  beforeEach(() => {
    supabaseMock.calls = [];
    supabaseMock.rows = [];
    supabaseMock.from.mockClear();
  });

  it('constrains a doctor request by both branch and doctor ID', async () => {
    await api.appointments.getAll('location-1', { doctorId: 'doctor-1' });

    expect(supabaseMock.calls).toContainEqual({ action: 'eq', column: 'location_id', value: 'location-1' });
    expect(supabaseMock.calls).toContainEqual({ action: 'eq', column: 'doctor_id', value: 'doctor-1' });
  });

  it('keeps a non-doctor branch request free of a doctor filter', async () => {
    await api.appointments.getAll('location-1');

    expect(supabaseMock.calls).toContainEqual({ action: 'eq', column: 'location_id', value: 'location-1' });
    expect(supabaseMock.calls).not.toContainEqual(expect.objectContaining({ action: 'eq', column: 'doctor_id' }));
  });
});