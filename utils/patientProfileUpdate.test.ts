import { describe, expect, it } from 'vitest';
import { buildPatientProfileUpdatePayload } from './patientProfileUpdate';

describe('buildPatientProfileUpdatePayload', () => {
  it('allows profile fields without adding financial fields', () => {
    expect(buildPatientProfileUpdatePayload(
      { name: 'Updated Patient', email: 'RAW@EXAMPLE.COM', phone: '09123' },
      'raw@example.com',
      '09123'
    )).toEqual({ name: 'Updated Patient', email: 'raw@example.com', phone: '09123' });
  });

  it('rejects stale patient objects that could overwrite the live balance', () => {
    expect(() => buildPatientProfileUpdatePayload(
      { name: 'Updated Patient', balance: 135000 },
      undefined,
      undefined
    )).toThrow(/cannot change financial balance/i);
  });

  it('rejects direct loyalty point changes through the profile API', () => {
    expect(() => buildPatientProfileUpdatePayload(
      { loyalty_points: 1230 },
      undefined,
      undefined
    )).toThrow(/cannot change financial balance or loyalty points/i);
  });
});
