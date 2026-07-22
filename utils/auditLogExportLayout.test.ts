import { describe, expect, it } from 'vitest';
import { AUDIT_LOG_PDF_COLUMN_WIDTHS, AUDIT_LOG_PDF_TABLE_WIDTH } from './pdfExport';

describe('audit log export table layout', () => {
  it('keeps every PDF column within the declared landscape table width', () => {
    expect(AUDIT_LOG_PDF_COLUMN_WIDTHS).toHaveLength(11);
    expect(AUDIT_LOG_PDF_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0)).toBe(AUDIT_LOG_PDF_TABLE_WIDTH);
    expect(AUDIT_LOG_PDF_TABLE_WIDTH).toBeLessThanOrEqual(269);
    expect(AUDIT_LOG_PDF_COLUMN_WIDTHS[10]).toBeGreaterThanOrEqual(20);
  });
});
