import { describe, expect, it } from 'vitest';
import { buildRecordsViewFilterOptions } from './recordsViewFilterOptions';

describe('records view filter options', () => {
  it('keeps admin audit log date and search filters active', () => {
    expect(buildRecordsViewFilterOptions({
      isDoctor: false,
      auditFilter: 'appointments',
      dateFrom: '2026-05-30',
      dateTo: '2026-05-30',
      searchTerm: 'alice'
    })).toEqual({
      auditFilter: 'appointments',
      dateFrom: '2026-05-30',
      dateTo: '2026-05-30',
      searchTerm: 'alice'
    });
  });

  it('does not apply hidden date or search filters to doctor patient records', () => {
    expect(buildRecordsViewFilterOptions({
      isDoctor: true,
      auditFilter: 'all',
      dateFrom: '2026-05-30',
      dateTo: '2026-05-30',
      searchTerm: 'alice'
    })).toEqual({
      auditFilter: 'all',
      dateFrom: undefined,
      dateTo: undefined,
      searchTerm: undefined
    });
  });
});