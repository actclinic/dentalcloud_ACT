import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationPath = fileURLToPath(new URL('../supabase/migrations/20260810000000_add_doctor_assignment_correction.sql', import.meta.url));
const migration = readFileSync(migrationPath, 'utf8');

describe('doctor assignment correction migration', () => {
  it('fails clearly when required session, audit, or commission infrastructure is missing', () => {
    expect(migration).toContain("to_regclass('public.staff_auth_sessions')");
    expect(migration).toContain("to_regclass('public.doctor_commission_entries')");
    expect(migration).toContain("to_regprocedure('public.acknowledge_commission_recalculation(uuid,uuid,uuid,text)')");
  });

  it('adds an explicit optional appointment link without guessing historical visits', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS appointment_id UUID');
    expect(migration).toContain('FOREIGN KEY (appointment_id)');
    expect(migration).not.toMatch(/UPDATE public\.treatments[\s\S]*SET appointment_id/);
  });

  it('requires a live admin session and locks the appointment', () => {
    expect(migration).toContain("u.role = 'admin'");
    expect(migration).toContain('s.revoked_at IS NULL');
    expect(migration).toContain('s.expires_at > NOW()');
    expect(migration).toMatch(/FROM public\.appointments[\s\S]*FOR UPDATE/);
    expect(migration).toContain('REVOKE ALL ON public.doctor_assignment_corrections FROM PUBLIC, anon, authenticated');
    expect(migration).not.toContain('FORCE ROW LEVEL SECURITY');
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain('guard_doctor_assignment_columns()');
    expect(migration).toContain("current_setting('app.doctor_assignment_correction', true)");
    expect(migration).toContain("set_config('app.doctor_assignment_correction', 'allowed', true)");
  });

  it('validates every explicitly selected treatment before changing ownership', () => {
    expect(migration).toContain('COUNT(DISTINCT selected_id)');
    expect(migration).toContain('t.patient_id = v_appointment.patient_id');
    expect(migration).toContain('t.location_id = v_appointment.location_id');
    expect(migration).toContain('t.doctor_id IS NOT DISTINCT FROM v_appointment.doctor_id');
    expect(migration).toContain('(t.appointment_id IS NULL OR t.appointment_id = v_appointment.id)');
  });

  it('resets dependent commission state and preserves immutable correction history', () => {
    expect(migration).toContain('DELETE FROM public.doctor_commission_entries');
    expect(migration).toContain('doctor_earnings = 0');
    expect(migration).toContain('pending_commission_recalculations');
    expect(migration).toContain('Doctor assignment correction history is immutable.');
    expect(migration).toContain('BETWEEN 10 AND 1000');
    expect(migration).toMatch(/NOTIFY pgrst, 'reload schema';\r?\n\r?\nCOMMIT;/);
  });
});