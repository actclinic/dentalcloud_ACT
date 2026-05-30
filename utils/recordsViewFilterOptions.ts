import type { AuditFilter, AuditLogFilterOptions } from './auditLogExport';

interface RecordsViewFilterOptionsInput {
  isDoctor: boolean;
  auditFilter: AuditFilter;
  dateFrom: string;
  dateTo: string;
  searchTerm: string;
}

export const buildRecordsViewFilterOptions = ({
  isDoctor,
  auditFilter,
  dateFrom,
  dateTo,
  searchTerm
}: RecordsViewFilterOptionsInput): AuditLogFilterOptions => ({
  auditFilter,
  dateFrom: isDoctor ? undefined : dateFrom,
  dateTo: isDoctor ? undefined : dateTo,
  searchTerm: isDoctor ? undefined : searchTerm
});