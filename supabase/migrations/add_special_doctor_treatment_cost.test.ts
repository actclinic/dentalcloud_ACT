import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('./20260906000000_add_special_doctor_treatment_cost.sql', import.meta.url), 'utf8');

describe('special doctor treatment cost migration', () => {
  it('is additive, transactional, idempotent, and preserves stable RPC/permission identifiers', () => {
    expect(migration).toContain('BEGIN;');
    expect(migration).toContain('COMMIT;');
    expect(migration).toContain("SET LOCAL lock_timeout = '5s';");
    expect(migration).toContain("SET LOCAL statement_timeout = '120s';");
    expect(migration).toContain("to_regclass('public.pending_commission_recalculations')");
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS');
    expect(migration.match(/NOT VALID/g)?.length).toBe(2);
    expect(migration.match(/VALIDATE CONSTRAINT/g)?.length).toBe(2);
    expect(migration).toContain("u.allowed_tabs ? 'material-cost'");
    expect(migration).toContain('public.replace_treatment_costs');
    expect(migration).toContain('public.replace_material_lab_cost_presets');
  });

  it('accepts, syncs, and cleans up the third category', () => {
    expect(migration).toContain("cost_type IN ('material', 'lab', 'special_doctor')");
    expect(migration).toContain("item.cost_type NOT IN ('material', 'lab', 'special_doctor')");
    expect(migration).toContain("'Special Doctor Cost'");
    expect(migration).toContain("'special_doctor_cost'");
    expect(migration).toContain("source_type IN ('material_cost', 'lab_cost', 'special_doctor_cost')");
    expect(migration).toContain('pending_commission_recalculations');
  });
});