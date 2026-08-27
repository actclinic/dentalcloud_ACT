import type { Patient } from '../types';

export const mergePatientsById = (existing: Patient[], incoming: Patient[]): Patient[] => {
  if (incoming.length === 0) return existing;
  const ids = new Set(existing.map((patient) => patient.id));
  const merged = [...existing];
  for (const patient of incoming) {
    if (!patient?.id || ids.has(patient.id)) continue;
    ids.add(patient.id);
    merged.push(patient);
  }
  return merged;
};