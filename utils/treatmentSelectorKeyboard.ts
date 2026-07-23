export type TreatmentSelectorDirection = 'up' | 'down';

export const getNextTreatmentOptionIndex = (
  currentIndex: number,
  optionCount: number,
  direction: TreatmentSelectorDirection
): number => {
  if (optionCount <= 0) return -1;

  if (currentIndex < 0 || currentIndex >= optionCount) {
    return direction === 'down' ? 0 : optionCount - 1;
  }

  const offset = direction === 'down' ? 1 : -1;
  return Math.min(optionCount - 1, Math.max(0, currentIndex + offset));
};