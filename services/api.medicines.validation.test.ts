import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state: any = { calls: [] };

  state.from = vi.fn((table: string) => ({
    insert: vi.fn((payload: any) => {
      state.calls.push({ table, action: 'insert', payload });
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { id: 'medicine-1', ...payload }, error: null }))
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
              single: vi.fn(async () => ({ data: { id: value, ...payload }, error: null }))
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

describe('api.medicines validation', () => {
  beforeEach(() => {
    supabaseMock.calls = [];
    supabaseMock.from.mockClear();
  });

  it('normalizes valid create payloads before insert', async () => {
    await api.medicines.create({
      location_id: ' loc-1 ',
      name: '  Ibuprofen  ',
      description: '  Pain relief  ',
      unit: ' box ',
      item_type: ' Medicine ' as any,
      price: '5.25' as any,
      stock: '10' as any,
      min_stock: '2' as any,
      quantity_step: '1' as any,
      category: '  Analgesic  '
    });

    expect(supabaseMock.calls).toContainEqual({
      table: 'medicines',
      action: 'insert',
      payload: {
        location_id: 'loc-1',
        name: 'Ibuprofen',
        description: 'Pain relief',
        unit: 'box',
        item_type: 'Medicine',
        price: 5.25,
        stock: 10,
        min_stock: 2,
        quantity_step: 1,
        category: 'Analgesic'
      }
    });
  });

  it('rejects blank names before Supabase is called', async () => {
    await expect(api.medicines.create({
      location_id: 'loc-1',
      name: '   ',
      price: 1,
      stock: 1
    })).rejects.toThrow('Medicine name is required.');

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('rejects negative stock and price before Supabase is called', async () => {
    await expect(api.medicines.create({
      location_id: 'loc-1',
      name: 'Ibuprofen',
      price: -1,
      stock: 1
    })).rejects.toThrow('Medicine price must be at least 0.');

    await expect(api.medicines.update('medicine-1', {
      stock: -1
    })).rejects.toThrow('Medicine stock must be at least 0.');

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});