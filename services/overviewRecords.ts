import type { ClinicalRecord, DoctorEarningEntry } from '../types';

export interface OverviewRecordRange {
  dateFrom: string;
  dateTo: string;
}

export interface OverviewRecordsSource {
  loadTreatmentsInRange(locationId: string | undefined, range: OverviewRecordRange): Promise<ClinicalRecord[]>;
  loadCommissionEntriesInRange(locationId: string | undefined, range: OverviewRecordRange): Promise<DoctorEarningEntry[]>;
  loadTreatmentsByIds(locationId: string | undefined, ids: string[]): Promise<ClinicalRecord[]>;
}

const entryKey = (entry: DoctorEarningEntry) => `${entry.paymentId}|${entry.treatmentId}|${entry.doctorId}`;
const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export const loadOverviewRecords = async (
  source: OverviewRecordsSource,
  locationId: string | undefined,
  range: OverviewRecordRange
): Promise<ClinicalRecord[]> => {
  if (!isValidDate(range.dateFrom) || !isValidDate(range.dateTo) || range.dateFrom > range.dateTo) {
    throw new Error('A valid overview date range is required.');
  }

  const [rangeRecords, entries] = await Promise.all([
    source.loadTreatmentsInRange(locationId, range),
    source.loadCommissionEntriesInRange(locationId, range)
  ]);
  const assertBranch = (record: ClinicalRecord) => {
    if (locationId && record.location_id !== locationId) {
      throw new Error('The overview source returned a treatment outside the requested branch.');
    }
  };
  rangeRecords.forEach(assertBranch);
  const records = new Map(rangeRecords.map((record) => [record.id, record]));
  const rangeIds = new Set(records.keys());
  const entriesByTreatment = new Map<string, Map<string, DoctorEarningEntry>>();

  for (const entry of entries) {
    if (!entry.treatmentId || !isValidDate(entry.paymentDate)
      || entry.paymentDate < range.dateFrom || entry.paymentDate > range.dateTo) {
      throw new Error('The overview commission source returned an invalid range entry.');
    }
    const group = entriesByTreatment.get(entry.treatmentId) || new Map<string, DoctorEarningEntry>();
    group.set(entryKey(entry), entry);
    entriesByTreatment.set(entry.treatmentId, group);
  }

  const missingIds = [...entriesByTreatment.keys()].filter((id) => !records.has(id));
  for (let offset = 0; offset < missingIds.length; offset += 50) {
    const ids = missingIds.slice(offset, offset + 50);
    const requested = new Set(ids);
    const olderRecords = await source.loadTreatmentsByIds(locationId, ids);
    for (const record of olderRecords) {
      assertBranch(record);
      if (!requested.has(record.id)) throw new Error('The overview source returned an unexpected treatment.');
      records.set(record.id, record);
    }
    if (ids.some((id) => !records.has(id))) {
      throw new Error('Some commission treatments could not be loaded. Retry the overview.');
    }
  }

  return [...records.values()].map((record) => {
    const authoritative = entriesByTreatment.get(record.id);
    if (!authoritative) return record;
    const merged = new Map<string, DoctorEarningEntry>();
    if (rangeIds.has(record.id)) {
      for (const entry of record.doctorEarningEntries || []) {
        if (!entry.paymentId.startsWith('legacy-')) merged.set(entryKey(entry), entry);
      }
    }
    for (const [key, entry] of authoritative) merged.set(key, entry);
    return { ...record, doctorEarningEntries: [...merged.values()] };
  });
};
