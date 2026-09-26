import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn()
}));

vi.mock('./supabase', () => ({
  supabase: supabaseMock,
  supabaseUrl: '',
  supabaseAnonKey: ''
}));

import { api } from './api';

describe('api.medicines.undoSale', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
    supabaseMock.from.mockReset();
  });

  it('uses the atomic RPC without trusting client price, quantity, or medicine values', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{ new_balance: 2293000, new_points: 3778, restored_stock: 26, reversed_points: 7 }],
      error: null
    });

    await expect(api.medicines.undoSale('sale-1', 'patient-1', 'location-1')).resolves.toEqual({
      new_balance: 2293000,
      new_points: 3778,
      restored_stock: 26,
      reversed_points: 7
    });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('undo_medicine_sale', {
      p_sale_id: 'sale-1',
      p_patient_id: 'patient-1',
      p_location_id: 'location-1'
    });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('surfaces an already-undone response and performs no client-side writes', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Medicine sale has already been undone' }
    });

    await expect(api.medicines.undoSale('sale-1', 'patient-1', 'location-1'))
      .rejects.toThrow('Medicine sale has already been undone');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
