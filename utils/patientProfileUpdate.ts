import type { Patient } from '../types';

export type PatientProfileUpdatePayload = Partial<Pick<Patient,
  'location_id' | 'name' | 'email' | 'phone' | 'age' | 'address' | 'city' | 'township' | 'patient_type'
>> & { medical_history?: string | null };

export const buildPatientProfileUpdatePayload = (
  data: Partial<Patient>,
  normalizedEmail: string | undefined,
  normalizedPhone: string | undefined
): PatientProfileUpdatePayload => {
  if (data.balance !== undefined || data.loyalty_points !== undefined) {
    throw new Error('Patient profile updates cannot change financial balance or loyalty points. Use the dedicated financial workflow.');
  }

  const payload: PatientProfileUpdatePayload = {};
  if (data.location_id !== undefined) payload.location_id = data.location_id;
  if (data.name !== undefined) payload.name = data.name;
  if (data.email !== undefined) payload.email = normalizedEmail;
  if (data.phone !== undefined) payload.phone = normalizedPhone;
  if (data.age !== undefined) payload.age = data.age;
  if (data.address !== undefined) payload.address = data.address;
  if (data.city !== undefined) payload.city = data.city;
  if (data.township !== undefined) payload.township = data.township;
  if (data.patient_type !== undefined) payload.patient_type = data.patient_type;
  if (data.medicalHistory !== undefined) payload.medical_history = data.medicalHistory;
  return payload;
};
