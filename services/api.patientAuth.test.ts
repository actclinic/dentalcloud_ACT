import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state: any = {
    authRowsByColumnValue: new Map<string, any[]>(),
    patientRowsById: new Map<string, any>()
  };

  const createAuthQuery = () => {
    const query: any = {
      order: vi.fn(() => query),
      limit: vi.fn(async () => ({ data: query.rows || [], error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      eq: vi.fn((column: string, value: string) => {
        if (column === 'patient_id') {
          query.rows = [];
          query.singleRow = null;
          return query;
        }

        query.rows = state.authRowsByColumnValue.get(`${column}:${value}`) || [];
        return query;
      })
    };
    return query;
  };

  const createPatientQuery = () => {
    const query: any = {
      eq: vi.fn((column: string, value: string) => {
        query.singleRow = column === 'id' ? state.patientRowsById.get(value) || null : null;
        return query;
      }),
      maybeSingle: vi.fn(async () => ({ data: query.singleRow || null, error: null }))
    };
    return query;
  };

  state.from = vi.fn((table: string) => ({
    select: vi.fn(() => {
      if (table === 'patient_auth') return createAuthQuery();
      if (table === 'patients') return createPatientQuery();
      return {};
    })
  }));

  return state;
});
const secureAuthMock = vi.hoisted(() => vi.fn());

vi.mock('./secureAuth', () => ({ secureAuthRequest: secureAuthMock }));

vi.mock('./supabase', () => ({
  supabase: { from: supabaseMock.from },
  supabaseUrl: '',
  supabaseAnonKey: ''
}));

import { api } from './api';

describe('patients.authenticate', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    supabaseMock.authRowsByColumnValue = new Map<string, any[]>();
    supabaseMock.patientRowsById = new Map<string, any>();
    supabaseMock.from.mockClear();
  });

  it('delegates password verification to secure auth without reading credential tables', async () => {
    secureAuthMock.mockResolvedValueOnce({ patient: {
      id: 'current-patient-id',
      patient_unique_id: 'P-0001',
      location_id: 'location-1',
      name: 'Patient One',
      email: 'patient@example.com',
      phone: '09123456789',
      balance: 0,
      loyalty_points: 0,
      medical_history: '',
      created_at: '2026-07-08T07:00:00Z'
    }, token: 'patient-session-token' });

    const result = await api.patients.authenticate('patient@example.com', 'correct-password');

    expect(result?.id).toBe('current-patient-id');
    expect(result?.name).toBe('Patient One');
    expect(result?.auth_session_token).toBe('patient-session-token');
    expect(secureAuthMock).toHaveBeenCalledWith('login', {
      kind: 'patient', identifier: 'patient@example.com', password: 'correct-password'
    });
    expect(supabaseMock.from).not.toHaveBeenCalledWith('patient_auth');
  });
});
