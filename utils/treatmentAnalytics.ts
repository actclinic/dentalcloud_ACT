import type { ClinicalRecord } from '../types';

export interface TreatmentAnalysisRow {
  key: string;
  name: string;
  count: number;
  uniquePatients: number;
  production: number;
  averageValue: number;
  discountTotal: number;
  discountedCount: number;
  focCount: number;
  doctorCount: number;
  latestDate: string;
  share: number;
}

export interface TreatmentTrendDatum {
  date: string;
  label: string;
  count: number;
  production: number;
}

export interface TreatmentDoctorDatum {
  key: string;
  name: string;
  count: number;
  production: number;
}

export interface TreatmentToothDatum {
  tooth: string;
  count: number;
}

export interface TreatmentAnalysis {
  totalTreatments: number;
  uniquePatients: number;
  repeatPatients: number;
  production: number;
  averageValue: number;
  discountTotal: number;
  discountedCount: number;
  focCount: number;
  rows: TreatmentAnalysisRow[];
  trend: TreatmentTrendDatum[];
  doctors: TreatmentDoctorDatum[];
  teeth: TreatmentToothDatum[];
}

const safeNonNegativeAmount = (value: number | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const cleanLabel = (value: string | null | undefined, fallback: string): string => {
  const cleaned = String(value ?? '').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
};

const treatmentKey = (record: ClinicalRecord, name: string): string => (
  record.treatment_type_id
    ? `type:${record.treatment_type_id}`
    : `legacy:${name.toLocaleLowerCase()}`
);

const shortDateLabel = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const buildTreatmentAnalysis = (
  records: ClinicalRecord[],
  options: { combineAcrossLocations?: boolean } = {}
): TreatmentAnalysis => {
  const validRecords = Array.isArray(records) ? records.filter(Boolean) : [];
  const patientCounts = new Map<string, number>();
  const treatmentGroups = new Map<string, {
    names: Map<string, number>;
    count: number;
    patients: Set<string>;
    production: number;
    discountTotal: number;
    discountedCount: number;
    focCount: number;
    doctors: Set<string>;
    latestDate: string;
  }>();
  const dailyGroups = new Map<string, { count: number; production: number }>();
  const doctorGroups = new Map<string, { name: string; count: number; production: number }>();
  const toothCounts = new Map<string, number>();

  let production = 0;
  let discountTotal = 0;
  let discountedCount = 0;
  let focCount = 0;

  validRecords.forEach((record) => {
    const name = cleanLabel(record.description, 'Unspecified treatment');
    // Catalog IDs are branch-local. In an organization-wide report, normalized names
    // are the only cross-branch identity currently available in the data model.
    const key = options.combineAcrossLocations
      ? `organization:${name.toLocaleLowerCase()}`
      : treatmentKey(record, name);
    const cost = safeNonNegativeAmount(record.cost);
    const discount = safeNonNegativeAmount(record.discountAmount);
    const patientId = cleanLabel(record.patient_id, '');
    const rawDoctorName = cleanLabel(record.doctor_name, '');
    const hasAssignedDoctor = Boolean(record.doctor_id || rawDoctorName);
    const doctorName = rawDoctorName || (record.doctor_id ? `Unknown doctor (${record.doctor_id.slice(0, 8)})` : 'Unassigned');
    const doctorKey = record.doctor_id
      ? `doctor:${record.doctor_id}`
      : rawDoctorName
        ? `name:${rawDoctorName.toLocaleLowerCase()}`
        : 'unassigned';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(record.date || '') ? record.date : '';
    const isFoc = record.pricingNote === 'FOC';
    const isDiscounted = !isFoc && (record.pricingNote === 'DISCOUNT' || discount > 0);

    production += cost;
    if (!isFoc) discountTotal += discount;
    if (isDiscounted) discountedCount += 1;
    if (isFoc) focCount += 1;

    if (patientId) patientCounts.set(patientId, (patientCounts.get(patientId) || 0) + 1);

    const group = treatmentGroups.get(key) || {
      names: new Map<string, number>(),
      count: 0,
      patients: new Set<string>(),
      production: 0,
      discountTotal: 0,
      discountedCount: 0,
      focCount: 0,
      doctors: new Set<string>(),
      latestDate: ''
    };
    group.names.set(name, (group.names.get(name) || 0) + 1);
    group.count += 1;
    if (patientId) group.patients.add(patientId);
    group.production += cost;
    if (!isFoc) group.discountTotal += discount;
    if (isDiscounted) group.discountedCount += 1;
    if (isFoc) group.focCount += 1;
    if (hasAssignedDoctor) group.doctors.add(doctorKey);
    if (date > group.latestDate) group.latestDate = date;
    treatmentGroups.set(key, group);

    if (date) {
      const daily = dailyGroups.get(date) || { count: 0, production: 0 };
      daily.count += 1;
      daily.production += cost;
      dailyGroups.set(date, daily);
    }

    const doctor = doctorGroups.get(doctorKey) || { name: doctorName, count: 0, production: 0 };
    doctor.count += 1;
    doctor.production += cost;
    doctorGroups.set(doctorKey, doctor);

    const uniqueTeeth = new Set(
      (Array.isArray(record.teeth) ? record.teeth : [])
        .map((tooth) => String(tooth).trim())
        .filter(Boolean)
    );
    uniqueTeeth.forEach((tooth) => toothCounts.set(tooth, (toothCounts.get(tooth) || 0) + 1));
  });

  const totalTreatments = validRecords.length;
  const rows = Array.from(treatmentGroups.entries())
    .map(([key, group]) => {
      // Map preserves insertion order, so equal-frequency spelling variants keep
      // the first recorded display casing rather than unexpectedly changing case.
      const name = Array.from(group.names.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unspecified treatment';
      return {
        key,
        name,
        count: group.count,
        uniquePatients: group.patients.size,
        production: group.production,
        averageValue: group.count > 0 ? group.production / group.count : 0,
        discountTotal: group.discountTotal,
        discountedCount: group.discountedCount,
        focCount: group.focCount,
        doctorCount: group.doctors.size,
        latestDate: group.latestDate,
        share: totalTreatments > 0 ? (group.count / totalTreatments) * 100 : 0
      };
    })
    .sort((a, b) => b.count - a.count || b.production - a.production || a.name.localeCompare(b.name));

  return {
    totalTreatments,
    uniquePatients: patientCounts.size,
    repeatPatients: Array.from(patientCounts.values()).filter((count) => count > 1).length,
    production,
    averageValue: totalTreatments > 0 ? production / totalTreatments : 0,
    discountTotal,
    discountedCount,
    focCount,
    rows,
    trend: Array.from(dailyGroups.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, totals]) => ({ date, label: shortDateLabel(date), ...totals })),
    doctors: Array.from(doctorGroups.entries())
      .map(([key, totals]) => ({ key, ...totals }))
      .sort((a, b) => b.count - a.count || b.production - a.production || a.name.localeCompare(b.name)),
    teeth: Array.from(toothCounts.entries())
      .map(([tooth, count]) => ({ tooth, count }))
      .sort((a, b) => b.count - a.count || a.tooth.localeCompare(b.tooth, undefined, { numeric: true }))
  };
};