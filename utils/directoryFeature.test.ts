import { describe, expect, it } from 'vitest';
import { parseDatabaseFilteredDirectories } from './directoryFeature';

describe('database-filtered directory rollout', () => {
  it('requires the exact true opt-in value', () => {
    expect(parseDatabaseFilteredDirectories('true')).toBe(true);
    expect(parseDatabaseFilteredDirectories('TRUE')).toBe(false);
    expect(parseDatabaseFilteredDirectories(true)).toBe(false);
    expect(parseDatabaseFilteredDirectories(undefined)).toBe(false);
  });
});
