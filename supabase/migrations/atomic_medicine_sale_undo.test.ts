import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(fileURLToPath(new URL(
  './20260923000000_atomic_medicine_sale_undo.sql',
  import.meta.url
)), 'utf8');

describe('atomic medicine sale undo migration', () => {
  it('locks and validates the live sale before making any reversal', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.undo_medicine_sale');
    expect(migration).toContain('sale.patient_id = p_patient_id');
    expect(migration).toContain('sale.location_id = p_location_id');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('Medicine sale has already been undone');
  });

  it('reverses stock, balance, and linked loyalty in one database transaction', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.voided_medicine_sales');
    expect(migration).toContain('stock = ROUND((COALESCE(stock, 0) + v_sale.quantity)::NUMERIC, 2)');
    expect(migration).toContain('COALESCE(balance, 0) - v_sale.total_price');
    expect(migration).toContain('loyalty_points = GREATEST');
    expect(migration).toContain('DELETE FROM public.loyalty_transactions');
    expect(migration).toContain('DELETE FROM public.medicine_sales');
  });
});
