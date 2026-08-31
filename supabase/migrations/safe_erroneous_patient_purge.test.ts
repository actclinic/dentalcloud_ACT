import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(fileURLToPath(new URL(
  './20260831130000_safe_erroneous_patient_purge.sql', import.meta.url
)), 'utf8');
const completeSetup = readFileSync(fileURLToPath(new URL(
  '../../database/complete_database_setup.sql', import.meta.url
)), 'utf8');

describe('safe erroneous patient purge migration', () => {
  it('requires an active admin, preserves snapshots, and refuses clinical or financial data', () => {
    expect(migration).toContain("app_user.role = 'admin'");
    expect(migration).toContain('staff_session.expires_at > NOW()');
    expect(migration).toContain('INSERT INTO public.erroneous_patient_purges');
    expect(migration).toContain('Only patients without clinical, financial, commission, or audit records may be purged');
    expect(migration).toContain("set_config('app.erroneous_patient_purge', 'allowed', true)");
  });

  it('includes guarded patient purge support in a fresh complete database setup', () => {
    expect(completeSetup).toContain('CREATE TABLE IF NOT EXISTS public.erroneous_patient_purges');
    expect(completeSetup).toContain('CREATE OR REPLACE FUNCTION public.purge_erroneous_patient');
  });
});
