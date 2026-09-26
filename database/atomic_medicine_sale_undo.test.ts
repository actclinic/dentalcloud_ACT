import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const migration = readFileSync(resolve('supabase/migrations/20260923000000_atomic_medicine_sale_undo.sql'), 'utf8');
const locationId = '00000000-0000-0000-0000-000000000001';
const patientId = '00000000-0000-0000-0000-000000000002';
const medicineId = '00000000-0000-0000-0000-000000000003';
const saleId = '00000000-0000-0000-0000-000000000004';
let db: PGlite;

describe('atomic medicine sale undo PostgreSQL migration', () => {
  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  }, 30000);

  afterAll(async () => { await db?.close(); });

  beforeEach(async () => {
    await db.exec(`
      DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      CREATE TABLE locations (id UUID PRIMARY KEY);
      CREATE TABLE patients (
        id UUID PRIMARY KEY, location_id UUID REFERENCES locations(id),
        balance NUMERIC(12,2) DEFAULT 0, loyalty_points INTEGER DEFAULT 0
      );
      CREATE TABLE medicines (
        id UUID PRIMARY KEY, location_id UUID REFERENCES locations(id), name TEXT,
        stock NUMERIC(12,2) DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE medicine_sales (
        id UUID PRIMARY KEY, location_id UUID REFERENCES locations(id),
        patient_id UUID REFERENCES patients(id), medicine_id UUID REFERENCES medicines(id),
        quantity NUMERIC(12,2), unit_price NUMERIC(12,2), total_price NUMERIC(12,2),
        date DATE DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE loyalty_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID REFERENCES patients(id),
        location_id UUID REFERENCES locations(id), points INTEGER, type TEXT,
        description TEXT, date TIMESTAMPTZ DEFAULT NOW()
      );
      INSERT INTO locations VALUES ('${locationId}');
      INSERT INTO patients VALUES ('${patientId}', '${locationId}', 2300000, 7);
      INSERT INTO medicines VALUES ('${medicineId}', '${locationId}', 'Metro 200mg', 24, NOW());
      INSERT INTO medicine_sales
        (id, location_id, patient_id, medicine_id, quantity, unit_price, total_price, created_at)
      VALUES
        ('${saleId}', '${locationId}', '${patientId}', '${medicineId}', 2, 3500, 7000, '2026-09-22T15:22:16Z');
      INSERT INTO loyalty_transactions (patient_id, location_id, points, type, description, date)
      VALUES (
        '${patientId}', '${locationId}', 7, 'EARNED',
        'Earned from medicine purchase: Metro 200mg (Qty: 2)', '2026-09-22T15:22:22Z'
      );
    `);
    await db.exec(migration);
  });

  it('reverses the sale and its legacy loyalty row exactly once', async () => {
    const result = (await db.query<any>(
      'SELECT * FROM undo_medicine_sale($1, $2, $3)',
      [saleId, patientId, locationId]
    )).rows[0];

    expect(result).toMatchObject({
      new_balance: '2293000.00',
      new_points: 0,
      restored_stock: '26.00',
      reversed_points: 7
    });
    expect((await db.query('SELECT * FROM medicine_sales')).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM loyalty_transactions')).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM voided_medicine_sales')).rows).toHaveLength(1);

    await expect(db.query(
      'SELECT * FROM undo_medicine_sale($1, $2, $3)',
      [saleId, patientId, locationId]
    )).rejects.toThrow('Medicine sale has already been undone');

    const patient = (await db.query<any>('SELECT balance, loyalty_points FROM patients')).rows[0];
    expect(patient).toMatchObject({ balance: '2293000.00', loyalty_points: 0 });
  });

  it('rejects a mismatched patient without changing any data', async () => {
    const otherPatientId = '00000000-0000-0000-0000-000000000005';
    await db.query('INSERT INTO patients VALUES ($1, $2, 10, 0)', [otherPatientId, locationId]);

    await expect(db.query(
      'SELECT * FROM undo_medicine_sale($1, $2, $3)',
      [saleId, otherPatientId, locationId]
    )).rejects.toThrow('Medicine sale was not found for this patient and location');

    expect((await db.query('SELECT * FROM medicine_sales')).rows).toHaveLength(1);
    expect((await db.query<any>('SELECT stock FROM medicines')).rows[0].stock).toBe('24.00');
  });
});
