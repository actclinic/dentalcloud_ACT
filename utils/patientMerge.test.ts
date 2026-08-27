import { describe, expect, it } from 'vitest';
import type { Patient } from '../types';
import { mergePatientsById } from './patientMerge';

const patient = (id: string): Patient => ({
  id,
  name: `Patient ${id}`,
  email: '',
  phone: '',
  location_id: 'location-1',
  balance: 0,
  loyalty_points: 0
});

describe('mergePatientsById', () => {
  it('appends newly loaded patients in their incoming order', () => {
    expect(mergePatientsById([patient('a')], [patient('b'), patient('c')]).map((row) => row.id))
      .toEqual(['a', 'b', 'c']);
  });

  it('does not duplicate a patient already shown in the first batch', () => {
    expect(mergePatientsById([patient('a'), patient('b')], [patient('b'), patient('c')]).map((row) => row.id))
      .toEqual(['a', 'b', 'c']);
  });

  it('preserves the existing array when a batch is empty', () => {
    const existing = [patient('a')];
    expect(mergePatientsById(existing, [])).toBe(existing);
  });
});