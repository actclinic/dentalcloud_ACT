import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(fileURLToPath(new URL('./20260915000000_payment_based_mls.sql', import.meta.url)), 'utf8');

describe('payment-based MLS migration', () => {
  it('is transactional and validates a payment audit parent', () => {
    expect(sql).toMatch(/^--[\s\S]*\nBEGIN;/);
    expect(sql).toContain("audit.source_type = 'payment'");
    expect(sql).toContain('JOIN public.payments AS pay ON pay.id = audit.source_id');
    expect(sql).toContain("NOTIFY pgrst, 'reload schema';\nCOMMIT;");
  });

  it('uses a secured RPC and queues commission recalculation', () => {
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('staff_auth_sessions');
    expect(sql).toContain('pending_commission_recalculations');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.replace_payment_costs');
  });
});
