import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { allocateCommissionablePayments, calculateCommissionLedgerEntries } from '../utils/doctorCommissionLedger';

const migration = readFileSync(resolve('supabase/migrations/20260906093058_treatment_commission_snapshots.sql'), 'utf8');
const doctor = '00000000-0000-0000-0000-000000000001';
const otherDoctor = '00000000-0000-0000-0000-000000000002';
const type = '00000000-0000-0000-0000-000000000003';
const patient = '00000000-0000-0000-0000-000000000004';
let db: PGlite;

const insert = async (doctorId: string | null = doctor, typeId: string | null = type) => (
  await db.query<any>(`INSERT INTO treatments (doctor_id, treatment_type_id, patient_id)
    VALUES ($1, $2, $3) RETURNING *`, [doctorId, typeId, patient])
).rows[0];
const get = async (id: string) => (await db.query<any>('SELECT * FROM treatments WHERE id = $1', [id])).rows[0];
const input = (row: any) => ({
  id: row.id, patientId: row.patient_id, doctorId: row.doctor_id,
  date: '2026-09-06', cost: Number(row.cost), commissionType: 'percentage' as const,
  commissionPercentage: 99, commissionPerVisit: 99999,
  commissionTypeSnapshot: row.commission_type_snapshot,
  commissionRateSnapshot: Number(row.commission_rate_snapshot),
  commissionSourceSnapshot: row.commission_source_snapshot
});

describe('treatment commission snapshot PostgreSQL migration', () => {
  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  }, 30000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec(`
      DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      CREATE TABLE doctors (id UUID PRIMARY KEY, specialization TEXT DEFAULT 'General',
        commission_type TEXT DEFAULT 'percentage', commission_percentage NUMERIC DEFAULT 5,
        commission_per_visit NUMERIC DEFAULT 20000);
      CREATE TABLE doctor_treatment_commissions (doctor_id UUID, treatment_id UUID,
        commission_rate NUMERIC, fixed_amount NUMERIC, UNIQUE(doctor_id, treatment_id));
      CREATE TABLE treatments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID REFERENCES doctors(id), treatment_type_id UUID, patient_id UUID,
        date DATE DEFAULT '2026-09-06', cost NUMERIC DEFAULT 80000, doctor_earnings NUMERIC DEFAULT 0);
      CREATE TABLE doctor_commission_entries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        treatment_id UUID REFERENCES treatments(id), doctor_id UUID, patient_id UUID,
        treatment_date DATE DEFAULT '2026-09-06', payment_date DATE DEFAULT '2026-09-06',
        visit_key TEXT, calculation_mode TEXT, commission_rate NUMERIC, earnings NUMERIC,
        updated_at TIMESTAMPTZ DEFAULT now());
      INSERT INTO doctors (id) VALUES ('${doctor}'), ('${otherDoctor}');
    `);
  });

  it('keeps unpaid A at 5% and new B at 10%, including later setting changes', async () => {
    await db.exec(migration);
    const a = await insert();
    await db.exec('UPDATE doctors SET commission_percentage = 10');
    const b = await insert();
    await db.exec('UPDATE doctors SET commission_percentage = 25');
    const treatments = [input(await get(a.id)), input(await get(b.id))];
    const allocations = allocateCommissionablePayments(treatments, treatments.map((t, i) => ({
      id: `p${i}`, patientId: patient, date: '2026-09-07', commissionableAmount: 80000, treatmentIds: [t.id]
    })));
    expect(calculateCommissionLedgerEntries(treatments, allocations).map(e => [e.commissionRate, e.earnings]))
      .toEqual([[5, 4000], [10, 8000]]);
  });

  it('captures custom percentage, including an explicit zero, and defaults without a matching type', async () => {
    await db.exec(migration);
    await db.query('INSERT INTO doctor_treatment_commissions VALUES ($1, $2, 12, NULL)', [doctor, type]);
    const custom = await insert();
    await db.exec('UPDATE doctor_treatment_commissions SET commission_rate = 0');
    expect(await insert()).toMatchObject({ commission_rate_snapshot: '0.00', commission_source_snapshot: 'custom' });
    expect(await get(custom.id)).toMatchObject({ commission_rate_snapshot: '12.00', commission_source_snapshot: 'custom' });
    expect(await insert(doctor, null)).toMatchObject({ commission_rate_snapshot: '5.00', commission_source_snapshot: 'default' });
  });

  it('captures fixed custom/default amounts and preserves the fixed mode after settings change', async () => {
    await db.exec(migration);
    await db.exec("UPDATE doctors SET commission_type = 'flat_visit'");
    const defaultRow = await insert();
    await db.query('INSERT INTO doctor_treatment_commissions VALUES ($1, $2, 50, 30000)', [doctor, type]);
    const custom = await insert();
    await db.exec("UPDATE doctors SET commission_type = 'percentage', commission_per_visit = 90000; UPDATE doctor_treatment_commissions SET fixed_amount = 70000;");
    expect(await get(defaultRow.id)).toMatchObject({ commission_type_snapshot: 'flat_visit', commission_rate_snapshot: '20000.00' });
    const treatment = input(await get(custom.id));
    expect(calculateCommissionLedgerEntries([treatment], [{
      paymentId: 'p1', paymentDate: '2026-09-07', treatmentId: treatment.id, amount: 1000
    }])[0]).toMatchObject({ calculationMode: 'flat_visit', commissionRate: 30000, earnings: 30000 });
  });

  it('backfills paid rates first and leaves every ledger field and stored earnings unchanged', async () => {
    const paid = await insert();
    const unpaid = await insert();
    await db.query(`INSERT INTO doctor_commission_entries
      (treatment_id, doctor_id, patient_id, calculation_mode, commission_rate, earnings)
      VALUES ($1, $2, $3, 'percentage', 5, 4000)`, [paid.id, doctor, patient]);
    await db.query('UPDATE treatments SET doctor_earnings = 4000 WHERE id = $1', [paid.id]);
    await db.exec('UPDATE doctors SET commission_percentage = 10');
    const before = (await db.query('SELECT * FROM doctor_commission_entries')).rows;
    await db.exec(migration);
    expect((await db.query('SELECT * FROM doctor_commission_entries')).rows).toEqual(before);
    expect(await get(paid.id)).toMatchObject({ commission_rate_snapshot: '5.00', commission_source_snapshot: 'ledger', doctor_earnings: '4000' });
    expect(await get(unpaid.id)).toMatchObject({ commission_rate_snapshot: '10.00', commission_source_snapshot: 'legacy_default' });
    await db.exec(migration); // Safe rerun must not recapture rates.
    expect((await db.query('SELECT * FROM doctor_commission_entries')).rows).toEqual(before);
  });

  it('backfills fixed visit siblings from the paid visit rather than the latest doctor method', async () => {
    const paid = await insert();
    const sibling = await insert();
    await db.query(`INSERT INTO doctor_commission_entries
      (treatment_id, doctor_id, patient_id, visit_key, calculation_mode, commission_rate, earnings)
      VALUES ($1, $2, $3, 'visit', 'flat_visit', 15000, 15000)`, [paid.id, doctor, patient]);
    await db.exec(migration);
    expect(await get(sibling.id)).toMatchObject({ commission_type_snapshot: 'flat_visit', commission_rate_snapshot: '15000.00', commission_source_snapshot: 'legacy_visit' });
  });

  it('aborts conflicting paid histories atomically instead of picking a rate', async () => {
    const paid = await insert();
    await db.query(`INSERT INTO doctor_commission_entries (treatment_id, calculation_mode, commission_rate)
      VALUES ($1, 'percentage', 5), ($1, 'percentage', 10)`, [paid.id]);
    await expect(db.exec(migration)).rejects.toThrow('conflicting ledger methods/rates');
    await db.exec('ROLLBACK');
    expect((await db.query('SELECT commission_rate FROM doctor_commission_entries ORDER BY commission_rate')).rows)
      .toEqual([{ commission_rate: '5' }, { commission_rate: '10' }]);
    expect((await get(paid.id)).commission_type_snapshot).toBeUndefined();
  });

  it('resnapshots only when doctor/type actually changes and prevents snapshot tampering', async () => {
    await db.exec(migration);
    const original = await insert();
    await db.exec('UPDATE doctors SET commission_percentage = 10');
    await db.query('UPDATE treatments SET cost = 90000, doctor_id = doctor_id WHERE id = $1', [original.id]);
    expect(await get(original.id)).toMatchObject({ commission_rate_snapshot: '5.00', commission_snapshotted_at: original.commission_snapshotted_at });
    await expect(db.query('UPDATE treatments SET commission_rate_snapshot = 99 WHERE id = $1', [original.id]))
      .rejects.toThrow('snapshot is immutable');
    await db.query('UPDATE treatments SET doctor_id = $1 WHERE id = $2', [otherDoctor, original.id]);
    expect(await get(original.id)).toMatchObject({ commission_rate_snapshot: '10.00' });
    await db.query('INSERT INTO doctor_treatment_commissions VALUES ($1, $2, 15, NULL)', [otherDoctor, type]);
    await db.query('UPDATE treatments SET treatment_type_id = NULL WHERE id = $1', [original.id]);
    await db.query('UPDATE treatments SET treatment_type_id = $1 WHERE id = $2', [type, original.id]);
    expect(await get(original.id)).toMatchObject({ commission_rate_snapshot: '15.00', commission_source_snapshot: 'custom' });
    const unassigned = await insert(null);
    expect(unassigned).toMatchObject({ commission_rate_snapshot: '0.00', commission_source_snapshot: 'no_doctor' });
  });

  it('ignores client-supplied snapshots on insert and works under the application role', async () => {
    await db.exec(migration);
    await db.exec('GRANT USAGE ON SCHEMA public TO anon; GRANT SELECT ON doctors, doctor_treatment_commissions TO anon; GRANT INSERT, SELECT ON treatments TO anon; SET ROLE anon;');
    try {
      const row = (await db.query<any>(`INSERT INTO treatments (doctor_id, commission_type_snapshot, commission_rate_snapshot)
        VALUES ($1, 'flat_visit', 99999) RETURNING *`, [doctor])).rows[0];
      expect(row).toMatchObject({ commission_type_snapshot: 'percentage', commission_rate_snapshot: '5.00' });
    } finally { await db.exec('RESET ROLE'); }
  });

  it('keeps the fresh setup aligned with the snapshot schema and trigger', () => {
    const setup = readFileSync(resolve('database/complete_database_setup.sql'), 'utf8');
    expect(setup).toContain('commission_type_snapshot TEXT NOT NULL');
    expect(setup).toContain('commission_rate_snapshot NUMERIC(12,2) NOT NULL');
    expect(setup).toContain('CREATE OR REPLACE FUNCTION public.resolve_treatment_commission_snapshot');
    expect(setup).toContain('CREATE TRIGGER trg_capture_treatment_commission_snapshot');
  });
});
