import type { AuditExportRow } from './auditLogExport';

type TreatmentAuditRow = Extract<AuditExportRow, { kind: 'treatment' }>;

export const sortMaterialCostRowsNewestFirst = (rows: TreatmentAuditRow[]): TreatmentAuditRow[] => {
  return [...rows].sort((a, b) => (
    (b.record.date || '').localeCompare(a.record.date || '') ||
    (b.sortDate || '').localeCompare(a.sortDate || '') ||
    (b.record.id || '').localeCompare(a.record.id || '')
  ));
};