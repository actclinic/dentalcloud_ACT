import { describe, expect, it } from 'vitest';

import { getNextTreatmentOptionIndex } from './treatmentSelectorKeyboard';

describe('treatment selector keyboard navigation', () => {
  it('starts at the first option with Arrow Down', () => {
    expect(getNextTreatmentOptionIndex(-1, 3, 'down')).toBe(0);
  });

  it('starts at the last option with Arrow Up', () => {
    expect(getNextTreatmentOptionIndex(-1, 3, 'up')).toBe(2);
  });

  it('moves in either direction without passing the list boundaries', () => {
    expect(getNextTreatmentOptionIndex(0, 3, 'down')).toBe(1);
    expect(getNextTreatmentOptionIndex(1, 3, 'up')).toBe(0);
    expect(getNextTreatmentOptionIndex(2, 3, 'down')).toBe(2);
    expect(getNextTreatmentOptionIndex(0, 3, 'up')).toBe(0);
  });

  it('returns no active option for an empty list', () => {
    expect(getNextTreatmentOptionIndex(-1, 0, 'down')).toBe(-1);
  });
});