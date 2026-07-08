import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state: any = { calls: [] };

  const terminalResult = (row: any) => ({ data: row, error: null });

  state.from = vi.fn((table: string) => ({
    insert: vi.fn((payload: any) => {
      state.calls.push({ table, action: 'insert', payload });
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => terminalResult({ id: 'expense-1', ...payload }))
        }))
      };
    }),
    update: vi.fn((payload: any) => {
      state.calls.push({ table, action: 'update', payload });
      return {
        eq: vi.fn((column: string, value: string) => {
          state.calls.push({ table, action: 'eq', column, value });
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => terminalResult({ id: value, ...payload }))
            }))
          };
        })
      };
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

describe('api.expenses validation', () => {
  beforeEach(() => {
    supabaseMock.calls = [];
    supabaseMock.from.mockClear();
  });

  it('normalizes valid create payloads before insert', async () => {
    await api.expenses.create({
      location_id: '  loc-1  ',
      description: '  Gloves  ',
      amount: '12.50' as any,
      category: '  Supplies  ',
      date: '2026-07-08'
    });

    expect(supabaseMock.calls).toContainEqual({
      table: 'expenses',
      action: 'insert',
      payload: {
        location_id: 'loc-1',
        description: 'Gloves',
        amount: 12.5,
        category: 'Supplies',
        date: '2026-07-08'
      }
    });
  });

  it('rejects negative amounts before Supabase is called', async () => {
    await expect(api.expenses.create({
      location_id: 'loc-1',
      description: 'Gloves',
      amount: -1,
      category: 'Supplies',
      date: '2026-07-08'
    })).rejects.toThrow('Expense amount must be at least 0.01.');

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('rejects invalid dates before Supabase is called', async () => {
    await expect(api.expenses.create({
      location_id: 'loc-1',
      description: 'Gloves',
      amount: 1,
      category: 'Supplies',
      date: '2026-02-30'
    })).rejects.toThrow('Expense date must be a real calendar date.');

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});