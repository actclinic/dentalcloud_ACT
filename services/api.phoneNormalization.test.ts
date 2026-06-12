import { describe, expect, it } from 'vitest';
import { normalizeMyanmarPhoneForLookup } from './api';

describe('normalizeMyanmarPhoneForLookup', () => {
  it('normalizes local Myanmar phone numbers', () => {
    expect(normalizeMyanmarPhoneForLookup('09123456789')).toBe('09123456789');
    expect(normalizeMyanmarPhoneForLookup('9123456789')).toBe('09123456789');
  });

  it('normalizes Myanmar phone numbers with country code', () => {
    expect(normalizeMyanmarPhoneForLookup('+959123456789')).toBe('09123456789');
    expect(normalizeMyanmarPhoneForLookup('959123456789')).toBe('09123456789');
  });

  it('rejects unsupported formats', () => {
    expect(normalizeMyanmarPhoneForLookup('08123456789')).toBeNull();
    expect(normalizeMyanmarPhoneForLookup('')).toBeNull();
  });
});
