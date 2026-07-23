import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state: any = { calls: [], rows: [], error: null };

  const createQuery = () => {
    let rangeFrom = 0;
    let rangeTo = 999;
    const query: any = {
      gte: vi.fn((column: string, value: string) => {
        state.calls.push({ action: 'gte', column, value });
        return query;
      }),
      lte: vi.fn((column: string, value: string) => {
        state.calls.push({ action: 'lte', column, value });
        return query;
      }),
      order: vi.fn((column: string, options?: any) => {
        state.calls.push({ action: 'order', column, options });
        return query;
      }),
      range: vi.fn((from: number, to: number) => {
        rangeFrom = from;
        rangeTo = to;
        state.calls.push({ action: 'range', from, to });
        return query;
      }),
      eq: vi.fn((column: string, value: string) => {
        state.calls.push({ action: 'eq', column, value });
        return query;
      }),
      then: (resolve: any, reject: any) => Promise.resolve({
        data: state.error ? null : state.rows.slice(rangeFrom, rangeTo + 1),
        error: state.error
      }).then(resolve, reject)
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

describe('treatments.getAnalysisRecords', () => {
  beforeEach(() => {
    supabaseMock.calls = [];
    supabaseMock.rows = [];
    supabaseMock.error = null;
    supabaseMock.from.mockClear();
  });

  it('loads only the selected branch and date range without commission enrichment', async () => {
    supabaseMock.rows = [{
      id: 'record-1', location_id: 'location-1', patient_id: 'patient-1', doctor_id: 'doctor-1',
      treatment_type_id: 'type-1', teeth: [11], description: 'Filling', cost: 90,
      standard_cost: 100, discount_amount: 10, pricing_note: 'DISCOUNT', date: '2026-07-20',
      doctors: { name: 'Doctor One' }
    }];

    const records = await api.treatments.getAnalysisRecords({
      locationId: 'location-1', dateFrom: '2026-07-01', dateTo: '2026-07-31'
    });

    expect(supabaseMock.calls).toContainEqual({ action: 'gte', column: 'date', value: '2026-07-01' });
    expect(supabaseMock.calls).toContainEqual({ action: 'lte', column: 'date', value: '2026-07-31' });
    expect(supabaseMock.calls).toContainEqual({ action: 'eq', column: 'location_id', value: 'location-1' });
    expect(supabaseMock.calls).not.toEqual(expect.arrayContaining([expect.objectContaining({ table: 'doctor_commission_entries' })]));
    expect(records[0]).toMatchObject({ standardCost: 100, discountAmount: 10, pricingNote: 'DISCOUNT', doctor_name: 'Doctor One' });
  });

  it('paginates beyond the Supabase 1,000-row response cap', async () => {
    supabaseMock.rows = Array.from({ length: 1001 }, (_, index) => ({
      id: `record-${index}`, location_id: 'location-1', patient_id: `patient-${index}`,
      teeth: [], description: 'Cleaning', cost: 10, date: '2026-07-20'
    }));

    const records = await api.treatments.getAnalysisRecords({ dateFrom: '2026-07-01', dateTo: '2026-07-31' });

    expect(records).toHaveLength(1001);
    expect(supabaseMock.calls).toContainEqual({ action: 'range', from: 0, to: 999 });
    expect(supabaseMock.calls).toContainEqual({ action: 'range', from: 1000, to: 1999 });
  });

  it('rejects invalid ranges before querying the database', async () => {
    await expect(api.treatments.getAnalysisRecords({ dateFrom: '2026-08-01', dateTo: '2026-07-01' }))
      .rejects.toThrow('valid treatment analysis date range');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('surfaces database failures instead of presenting them as empty data', async () => {
    supabaseMock.error = { message: 'Network unavailable' };
    await expect(api.treatments.getAnalysisRecords({ dateFrom: '2026-07-01', dateTo: '2026-07-31' }))
      .rejects.toThrow('Network unavailable');
  });
});