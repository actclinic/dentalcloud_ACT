import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const storedExpenses = [{
    id: 'expense-1',
    location_id: 'loc-1',
    description: 'Clinic rent',
    amount: 500000,
    category: 'Rent',
    date: '2026-09-01'
  }];
  const auditBatchSizes: number[] = [];

  const queryResult = (result: { data: any; error: any }) => {
    const query: any = {
      order: vi.fn(() => query),
      eq: vi.fn(() => query),
      in: vi.fn((_column: string, values: unknown[]) => {
        auditBatchSizes.push(values.length);
        return query;
      }),
      then: (resolve: (value: any) => unknown, reject: (reason: any) => unknown) =>
        Promise.resolve(result).then(resolve, reject)
    };
    return query;
  };

  const from = vi.fn((table: string) => ({
    select: vi.fn(() => {
      if (table === 'expenses') {
        return queryResult({ data: storedExpenses, error: null });
      }
      if (table === 'patient_material_costs') {
        return queryResult({
          data: Array.from({ length: 26 }, (_, index) => ({
            audit_log_id: `audit-${index + 1}`,
            material_name: `Material ${index + 1}`,
            cost_type: 'material',
            total_amount: 1000,
            created_at: '2026-09-01T00:00:00Z',
            updated_at: '2026-09-01T00:00:00Z'
          })),
          error: null
        });
      }
      if (table === 'audit_logs') {
        return queryResult({ data: null, error: { message: 'Failed to fetch (CORS)' } });
      }
      return queryResult({ data: [], error: null });
    })
  }));

  return { from, storedExpenses, auditBatchSizes };
});

vi.mock('./supabase', () => ({
  supabase: { from: supabaseMock.from, rpc: vi.fn() },
  supabaseUrl: '',
  supabaseAnonKey: ''
}));

import { api } from './api';

describe('api.expenses.getAll', () => {
  beforeEach(() => {
    supabaseMock.from.mockClear();
    supabaseMock.auditBatchSizes.length = 0;
  });

  it('keeps stored expenses when optional material-cost enrichment fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await api.expenses.getAll('loc-1');

    expect(result).toEqual(supabaseMock.storedExpenses);
    expect(supabaseMock.auditBatchSizes).toEqual([25, 1]);
    expect(warn).toHaveBeenCalledWith(
      'Error enriching expenses with material/lab costs:',
      expect.objectContaining({ message: 'Failed to fetch (CORS)' })
    );

    warn.mockRestore();
  });
});
