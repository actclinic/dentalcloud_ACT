import { describe, expect, it } from 'vitest';
import {
  fdiPrimaryToDisplayLabel,
  formatTeethArray,
  formatTeethWithPosition,
  formatTeethWithType,
  formatTooth,
  parseTeethInput,
  parseToothDisplayLabel
} from './toothNumbering';

describe('primary tooth display labels', () => {
  it.each([
    [51, '1A'],
    [55, '1E'],
    [61, '2A'],
    [65, '2E'],
    [71, '3A'],
    [75, '3E'],
    [81, '4A'],
    [85, '4E']
  ])('maps stored FDI tooth %i to %s', (storedTooth, displayLabel) => {
    expect(fdiPrimaryToDisplayLabel(storedTooth)).toBe(displayLabel);
    expect(formatTooth(storedTooth)).toBe(displayLabel);
    expect(parseToothDisplayLabel(displayLabel)).toBe(storedTooth);
  });

  it('keeps permanent tooth labels unchanged', () => {
    expect(formatTooth(11)).toBe('11');
    expect(formatTooth(48)).toBe('48');
  });

  it('formats mixed permanent and primary tooth lists consistently', () => {
    expect(formatTeethArray([11, 51, 65, 85])).toBe('11, 1A, 2E, 4E');
    expect(formatTeethWithPosition([51])).toBe('1A (Upper Right (Primary))');
  });

  it('uses primary molar anatomy for detailed labels', () => {
    expect(formatTeethWithType([54])).toBe('1D - First Molar (Upper Right (Primary))');
    expect(formatTeethWithType([55])).toBe('1E - Second Molar (Upper Right (Primary))');
  });

  it('accepts labels case-insensitively and rejects invalid labels', () => {
    expect(parseToothDisplayLabel(' 3c ')).toBe(73);
    expect(parseToothDisplayLabel('51')).toBe(51);
    expect(parseToothDisplayLabel('5A')).toBeNull();
    expect(parseToothDisplayLabel('1F')).toBeNull();
  });

  it('parses staff-entered mixed tooth labels and reports invalid values', () => {
    expect(parseTeethInput('11, 1a 2E, invalid')).toEqual({
      teeth: [11, 51, 65],
      invalidLabels: ['invalid']
    });
  });
});
