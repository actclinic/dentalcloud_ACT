import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(fileURLToPath(new URL(
  './20260803135544_guard_payment_receipt_reconciliation.sql',
  import.meta.url
)), 'utf8');

describe('payment receipt reconciliation migration', () => {
  it('rejects unexplained payment value without changing legacy receipts', () => {
    expect(migration).toContain("COALESCE(NEW.receipt_snapshot #>> '{reconciliation,version}', '') <> '1'");
    expect(migration).toContain('Payment details are missing % of billable items');
    expect(migration).toContain('BEFORE INSERT ON public.payments');
    expect(migration).not.toMatch(/\bUPDATE\s+public\.payments\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\s+public\.payments\b/i);
  });
});
