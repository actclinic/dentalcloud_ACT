import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repair = readFileSync(fileURLToPath(new URL(
  './manual_20260813_01_repair_pat00064_stale_treatment_commission.sql',
  import.meta.url
)), 'utf8');

describe('PAT-00064 commission repair', () => {
  it('is guarded, audited, and leaves financial balance fields unchanged', () => {
    expect(repair).toContain("'REC-20260813-000141'");
    expect(repair).toContain("'7c6078bd-3461-4cae-9e86-baffbcf210fc'");
    expect(repair).toContain("'02684334-53b7-48f6-aa71-25945c85c50d'");
    expect(repair).toContain('payment_treatment_reference_repairs');
    expect(repair).toContain("'percentage', 1500000.00, 0, 1500000.00, 40.00, 600000.00");
    expect(repair).toContain('FOR UPDATE');
    expect(repair).not.toMatch(/SET\s+(amount|cleared_amount|remaining_balance|balance_before|payment_method)\s*=/i);
    expect(repair).not.toMatch(/UPDATE\s+public\.patients/i);
  });
});