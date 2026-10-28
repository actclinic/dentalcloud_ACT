import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  'supabase/migrations/20261028000000_allow_archived_payment_correction_delete.sql'
), 'utf8');
const paymentId = '00000000-0000-0000-0000-000000000001';
const correctionId = '00000000-0000-0000-0000-000000000002';
let db: PGlite;

describe('corrected payment void PostgreSQL migration', () => {
  beforeAll(async () => { db = await PGlite.create(); }, 30000);
  afterAll(async () => { await db?.close(); });

  beforeEach(async () => {
    await db.exec(`
      DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      CREATE TABLE payments (id UUID PRIMARY KEY);
      CREATE TABLE payment_corrections (
        id UUID PRIMARY KEY,
        payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        old_amount NUMERIC NOT NULL,
        new_amount NUMERIC NOT NULL
      );
      CREATE TABLE voided_payments (
        original_payment_id UUID PRIMARY KEY,
        payment_snapshot JSONB NOT NULL
      );

      CREATE FUNCTION prevent_payment_correction_mutation()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'payment_corrections is immutable; update/delete is not allowed';
      END;
      $$;
      CREATE TRIGGER trg_prevent_payment_correction_update
        BEFORE UPDATE ON payment_corrections
        FOR EACH ROW EXECUTE FUNCTION prevent_payment_correction_mutation();
      CREATE TRIGGER trg_prevent_payment_correction_delete
        BEFORE DELETE ON payment_corrections
        FOR EACH ROW EXECUTE FUNCTION prevent_payment_correction_mutation();

      INSERT INTO payments VALUES ('${paymentId}');
      INSERT INTO payment_corrections VALUES ('${correctionId}', '${paymentId}', 370000, 170000);
    `);
    await db.exec(migration);
  });

  it('still rejects direct correction updates and deletes', async () => {
    await expect(db.query(
      'UPDATE payment_corrections SET new_amount = 1 WHERE id = $1',
      [correctionId]
    )).rejects.toThrow('payment_corrections is immutable');

    await expect(db.query(
      'DELETE FROM payment_corrections WHERE id = $1',
      [correctionId]
    )).rejects.toThrow('payment_corrections is immutable');
  });

  it('rejects a payment cascade when its correction has not been archived', async () => {
    await expect(db.query('DELETE FROM payments WHERE id = $1', [paymentId]))
      .rejects.toThrow('payment_corrections is immutable');

    expect((await db.query('SELECT id FROM payments')).rows).toHaveLength(1);
    expect((await db.query('SELECT id FROM payment_corrections')).rows).toHaveLength(1);
  });

  it('allows the payment cascade after the exact correction is archived', async () => {
    await db.query(
      `INSERT INTO voided_payments (original_payment_id, payment_snapshot)
       VALUES ($1, jsonb_build_object('corrections', jsonb_build_array(jsonb_build_object('id', $2::TEXT))))`,
      [paymentId, correctionId]
    );

    await db.query('DELETE FROM payments WHERE id = $1', [paymentId]);

    expect((await db.query('SELECT id FROM payments')).rows).toHaveLength(0);
    expect((await db.query('SELECT id FROM payment_corrections')).rows).toHaveLength(0);
    expect((await db.query('SELECT original_payment_id FROM voided_payments')).rows).toHaveLength(1);
  });
});
