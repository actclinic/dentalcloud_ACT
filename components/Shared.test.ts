import { describe, expect, it } from 'vitest';

import { formatTypedTime } from './Shared';

describe('formatTypedTime', () => {
  it('preserves partial colon input while typing', () => {
    expect(formatTypedTime('10:3', 'AM')).toBe('10:3');
    expect(formatTypedTime('10:', 'AM')).toBe('10:');
  });

  it('formats complete 12-hour input once minutes are complete', () => {
    expect(formatTypedTime('10:30', 'AM')).toBe('10:30');
    expect(formatTypedTime('10:30 PM', 'AM')).toBe('22:30');
  });
});
