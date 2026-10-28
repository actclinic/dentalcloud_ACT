import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(fileURLToPath(new URL(
  './20260831120000_void_duplicate_payment.sql',
  import.meta.url
)), 'utf8');
const correctedPaymentVoidFix = readFileSync(fileURLToPath(new URL(
  './20261028000000_allow_archived_payment_correction_delete.sql',
  import.meta.url
)), 'utf8');
const completeSetup = readFileSync(fileURLToPath(new URL(
  '../../database/complete_database_setup.sql',
  import.meta.url
)), 'utf8');

describe('void duplicate payment migration', () => {
  it('requires an active admin session, saves an audit snapshot, restores balance, then deletes the payment', () => {
    expect(migration).toContain("app_user.role = 'admin'");
    expect(migration).toContain('staff_session.expires_at > NOW()');
    expect(migration).toContain('INSERT INTO public.voided_payments');
    expect(migration).toContain('SET balance = ROUND(COALESCE(v_current_balance, 0) + v_payment_amount, 2)');
    expect(migration).toContain('DELETE FROM public.payments WHERE id = v_payment.id');
  });

  it('allows corrected payments to cascade-delete only after their correction audit rows are archived', () => {
    expect(correctedPaymentVoidFix).toContain("IF TG_OP = 'DELETE' AND EXISTS");
    expect(correctedPaymentVoidFix).toContain("payment_snapshot -> 'corrections'");
    expect(correctedPaymentVoidFix).toContain('voided_payment.original_payment_id = OLD.payment_id');
    expect(correctedPaymentVoidFix).toContain("archived_correction.value ->> 'id' = OLD.id::TEXT");
    expect(correctedPaymentVoidFix).toContain("RAISE EXCEPTION 'payment_corrections is immutable; update/delete is not allowed'");
  });

  it('includes the safe-void prerequisites in a fresh complete database setup', () => {
    expect(completeSetup).toContain('CREATE TABLE IF NOT EXISTS public.payment_allocations');
    expect(completeSetup).toContain('CREATE TABLE IF NOT EXISTS public.payment_corrections');
    expect(completeSetup).toContain('CREATE TABLE IF NOT EXISTS public.voided_payments');
    expect(completeSetup).toContain('CREATE OR REPLACE FUNCTION public.void_duplicate_payment');
    expect(completeSetup).toContain('CREATE OR REPLACE FUNCTION public.prevent_payment_correction_mutation()');
    expect(completeSetup).toContain("payment_snapshot -> 'corrections'");
  });
});
