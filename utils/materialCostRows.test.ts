import { describe, expect, it } from 'vitest';
import type { ClinicalRecord } from '../types';
import type { AuditExportRow } from './auditLogExport';
import { sortMaterialCostRowsNewestFirst } from './materialCostRows';

type TreatmentAuditRow = Extract<AuditExportRow, { kind: 'treatment' }>;

const treatmentRow = (id: string, date: string, sortDate = `${date}T23:59:59`): TreatmentAuditRow => ({
  kind: 'treatment',
  sortDate,
  record: {
    id,
    location_id: 'location-1',
    patient_id: `patient-${id}`,
    teeth: [],
    description: `Treatment ${id}`,
    cost: 0,
    date
  } satisfies ClinicalRecord
});

describe('material cost row sorting', () => {
  it('sorts the newest treatment dates first without mutating the source rows', () => {
    const rows = [
      treatmentRow('older', '2026-07-18'),
      treatmentRow('newest', '2026-07-20'),
      treatmentRow('middle', '2026-07-19')
    ];

    const sorted = sortMaterialCostRowsNewestFirst(rows);

    expect(sorted.map((row) => row.record.id)).toEqual(['newest', 'middle', 'older']);
    expect(rows.map((row) => row.record.id)).toEqual(['older', 'newest', 'middle']);
  });

  it('uses the audit sort key and record id for deterministic same-day ordering', () => {
    const rows = [
      treatmentRow('a', '2026-07-20', '2026-07-20T09:00:00'),
      treatmentRow('b', '2026-07-20', '2026-07-20T10:00:00'),
      treatmentRow('c', '2026-07-20', '2026-07-20T10:00:00')
    ];

    expect(sortMaterialCostRowsNewestFirst(rows).map((row) => row.record.id)).toEqual(['c', 'b', 'a']);
  });
});