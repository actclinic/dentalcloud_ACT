import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(fileURLToPath(new URL(
  './20260813000000_harden_payment_treatment_references.sql',
  import.meta.url
)), 'utf8');

describe('payment treatment reference hardening migration', () => {
  it('validates authoritative ownership and exact receipt sets for inserts and updates', () => {
    expect(migration).toContain('treatment.patient_id IS DISTINCT FROM NEW.patient_id');
    expect(migration).toContain('treatment.location_id IS DISTINCT FROM NEW.location_id');
    expect(migration).toContain('Payment contains duplicate treatment references');
    expect(migration).toContain('Payment treatment links do not exactly match the receipt');
    expect(migration).toContain('BEFORE INSERT OR UPDATE OF');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = pg_catalog, public, pg_temp');
    expect(migration).toContain('mark_payment_commission_recalculation_pending');
    expect(migration).toContain('ON CONFLICT (patient_id) DO UPDATE');
    expect(migration).toContain("app_user.allowed_tabs ? 'finance'");
    expect(migration).toContain('staff_session.session_token = p_staff_session_token');
    expect(migration).toContain('clear_payment_commission_recalculation_pending');
    expect(migration).toContain('DELETE FROM public.pending_commission_recalculations');
  });
});